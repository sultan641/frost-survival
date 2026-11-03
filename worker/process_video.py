import os, re, json, base64, hashlib, tempfile, subprocess
from pathlib import Path
from datetime import datetime, timezone, timedelta
import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request
from faster_whisper import WhisperModel

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ENC_KEY = os.environ["GOOGLE_TOKEN_ENCRYPTION_KEY"]
ADMIN = os.environ["ADMIN_UID"]
HEADERS = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
BUCKET = "youtube-studio-private"

def db(path, method="GET", **kwargs):
    r = requests.request(method, URL + "/rest/v1/" + path, headers={**HEADERS, **kwargs.pop("headers", {})}, timeout=60, **kwargs)
    if not r.ok:
        # Include Supabase's response message so permission/key/schema errors are diagnosable.
        detail = (r.text or "").strip().replace("\\n", " ")[:1200]
        raise RuntimeError(f"Supabase REST {method} failed ({r.status_code}) for {path.split('?')[0]}: {detail or 'No error details returned'}")
    return r

def decrypt(value):
    raw = base64.b64decode(value)
    key = hashlib.sha256(ENC_KEY.encode()).digest()
    return AESGCM(key).decrypt(raw[:12], raw[12:], None).decode()

def encrypt(value):
    key = hashlib.sha256(ENC_KEY.encode()).digest()
    iv = os.urandom(12)
    return base64.b64encode(iv + AESGCM(key).encrypt(iv, value.encode(), None)).decode()

def get_youtube_credentials():
    rows = db(f"youtube_oauth_tokens?owner_id=eq.{ADMIN}&select=access_token,refresh_token,expires_at").json()
    if not rows:
        raise RuntimeError("YouTube is not connected. Reconnect it in YouTube Studio.")
    row = rows[0]
    refresh_token = decrypt(row["refresh_token"])
    token = decrypt(row["access_token"]) if row.get("access_token") else None
    expiry = datetime.now(timezone.utc) - timedelta(minutes=1)
    if row.get("expires_at"):
        expiry = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
        # Google auth compares expiry against a naive UTC datetime.
        if expiry.tzinfo is not None:
            expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)
    creds = Credentials(token=token, refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        scopes=["https://www.googleapis.com/auth/youtube.upload"],
        expiry=expiry)
    if not creds.valid:
        creds.refresh(Request())
        db(f"youtube_oauth_tokens?owner_id=eq.{ADMIN}", "PATCH",
           json={"access_token": encrypt(creds.token), "expires_at": creds.expiry.isoformat(),
                 "updated_at": datetime.now(timezone.utc).isoformat()},
           headers={"Prefer": "return=minimal"})
    return creds

def safe_title(name, notes):
    stem = Path(name).stem.replace("_", " ").replace("-", " ")
    stem = re.sub(r"\s+", " ", stem).strip()
    title = (stem or "Whiteout Survival Gameplay")[:85]
    if "whiteout" not in title.lower() and "kingshot" not in title.lower():
        title = "Whiteout Survival | " + title
    return title[:100]

def main():
    jobs = db(f"youtube_studio_jobs?owner_id=eq.{ADMIN}&status=in.(uploaded,queued)&select=*&order=created_at.asc&limit=1").json()
    if not jobs:
        print("No uploaded jobs waiting.")
        return
    job = jobs[0]
    job_id = job["id"]
    patch = lambda values: db(f"youtube_studio_jobs?id=eq.{job_id}&owner_id=eq.{ADMIN}", "PATCH", json=values, headers={"Prefer":"return=minimal"})
    patch({"status":"processing", "error_message":None, "updated_at":datetime.now(timezone.utc).isoformat()})
    print(f"Processing job {job_id}: {job.get('original_name', 'video')} ({job.get('file_size', 0)} bytes)")
    try:
        signed_response = requests.post(URL + f"/storage/v1/object/sign/{BUCKET}/{job['original_path']}", headers=HEADERS, json={"expiresIn":3600}, timeout=60)
        signed_response.raise_for_status()
        signed = signed_response.json()
        signed_url = signed.get("signedURL") or signed.get("signedUrl")
        if not signed_url:
            raise RuntimeError("Could not create a private download link.")
        if signed_url.startswith("/"):
            signed_url = URL + "/storage/v1" + signed_url
        source = requests.get(signed_url, timeout=180)
        source.raise_for_status()
        with tempfile.TemporaryDirectory() as td:
            input_file = Path(td) / "source.mp4"
            output_file = Path(td) / "frost-survival-short.mp4"
            input_file.write_bytes(source.content)
            # Local speech transcription and vertical Shorts output (maximum 3 minutes).
            model = WhisperModel("base", device="cpu", compute_type="int8")
            segments, _ = model.transcribe(str(input_file), vad_filter=True)
            subtitle_file = Path(td) / "captions.srt"
            transcript_parts = []
            def stamp(seconds):
                ms = int(seconds * 1000)
                hours, ms = divmod(ms, 3600000)
                minutes, ms = divmod(ms, 60000)
                secs, ms = divmod(ms, 1000)
                return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"
            with subtitle_file.open("w", encoding="utf-8") as captions:
                count = 0
                for segment in segments:
                    if segment.start >= 180: break
                    start, end = max(0, segment.start), min(180, segment.end)
                    caption_text = re.sub(r"\s+", " ", segment.text).strip()
                    if not caption_text or end <= start: continue
                    transcript_parts.append(caption_text)
                    count += 1
                    captions.write(f"{count}\n{stamp(start)} --> {stamp(end)}\n{caption_text}\n\n")
            vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,subtitles=captions.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV=100'"
            cmd = ["ffmpeg","-y","-i",str(input_file),"-t","180","-vf",vf,
                "-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","128k",
                "-movflags","+faststart",str(output_file)]
            subprocess.run(cmd, check=True, capture_output=True, text=True, cwd=td)
            output_path = f"{ADMIN}/processed/{job_id}-{int(datetime.now(timezone.utc).timestamp())}.mp4"
            with output_file.open("rb") as f:
                up = requests.post(URL + f"/storage/v1/object/{BUCKET}/{output_path}",
                    headers={**HEADERS,"Content-Type":"video/mp4","x-upsert":"false"},
                    data=f, timeout=600)
                up.raise_for_status()
            notes = (job.get("description") or "").strip()
            transcript = " ".join(transcript_parts)
            title = job.get("title") or safe_title(job["original_name"], notes)
            if transcript and not notes and Path(job["original_name"]).stem.lower() in ("video","recording","screenrecording"):
                words = re.findall(r"[A-Za-z0-9']+", transcript)
                if words:
                    title = ("Whiteout Survival | " + " ".join(words[:9])).strip()[:100]
            tags = ["WhiteoutSurvival","Gaming","FrostSurvival","Sultan","Shorts"]
            if "kingshot" in (job["original_name"]+" "+notes).lower():
                tags = ["KingShot","Gaming","FrostSurvival","Sultan","Shorts"]
            hashtags = " ".join("#"+x for x in tags)
            description = (notes + "\\n\\n" if notes else "") + "Frost Survival gaming • Sultan\\n" + hashtags
            thumbnail_file = Path(td) / "thumbnail.jpg"
            thumb_title = title.replace("'", "").replace(":", " ").replace("%", "")
            thumb_filter = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,drawbox=x=0:y=500:w=iw:h=220:color=black@0.68:t=fill,drawtext=text='" + thumb_title[:48] + "':fontcolor=white:fontsize=44:x=50:y=555:box=0"
            subprocess.run(["ffmpeg","-y","-ss","2","-i",str(input_file),"-frames:v","1","-vf",thumb_filter,"-q:v","2",str(thumbnail_file)],check=True,capture_output=True,text=True)

            if job.get("approval_required", False):
                patch({"status":"ready","title":title,"output_path":output_path,"error_message":None,"updated_at":datetime.now(timezone.utc).isoformat()})
                print("Edited video is ready for your approval; not uploaded yet.")
                return
            creds = get_youtube_credentials()
            youtube = build("youtube","v3",credentials=creds,cache_discovery=False)
            media = MediaFileUpload(str(output_file), mimetype="video/mp4", resumable=True, chunksize=8*1024*1024)
            request = youtube.videos().insert(part="snippet,status", body={
                "snippet":{"title":title,"description":description[:5000],"categoryId":"20",
                           "tags":tags},
                "status":{"privacyStatus":job.get("publish_privacy") if job.get("publish_privacy") in ("private","unlisted","public") else "private","selfDeclaredMadeForKids":False}
            }, media_body=media)
            response = None
            while response is None:
                _, response = request.next_chunk()
            try:
                thumb_media = MediaFileUpload(str(thumbnail_file), mimetype="image/jpeg", resumable=False)
                youtube.thumbnails().set(videoId=response["id"], media_body=thumb_media).execute()
                print("Custom thumbnail uploaded.")
            except Exception as thumb_error:
                print("Thumbnail upload failed:", str(thumb_error)[:400])
            patch({"status":"published","title":title,"output_path":output_path,
                   "youtube_video_id":response["id"],"error_message":None,
                   "updated_at":datetime.now(timezone.utc).isoformat()})
            print("Processed and uploaded privately:", response["id"])
            print("Private YouTube URL: https://www.youtube.com/watch?v=" + response["id"])
    except Exception as e:
        patch({"status":"failed","error_message":str(e)[:1000],
               "updated_at":datetime.now(timezone.utc).isoformat()})
        raise

if __name__ == "__main__":
    main()
