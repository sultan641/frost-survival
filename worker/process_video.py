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
import asyncio
try:
    import edge_tts
except ImportError:
    edge_tts = None

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

def make_original_music(path, duration=180, sample_rate=22050):
    # Procedurally composed ambient synth bed; no samples or copyrighted melodies.
    import math, struct, wave
    chords = [(110.00, 130.81, 164.81), (98.00, 123.47, 146.83),
              (87.31, 110.00, 130.81), (98.00, 123.47, 164.81)]
    frames = duration * sample_rate
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(sample_rate)
        chunk = 8192
        for base in range(0, frames, chunk):
            samples = bytearray()
            for n in range(base, min(base + chunk, frames)):
                t = n / sample_rate
                chord = chords[int(t // 15) % len(chords)]
                fade = min(1.0, t / 2.5, max(0.0, (duration - t) / 3.0))
                pad = sum(math.sin(2 * math.pi * f * t) for f in chord) / 3
                shimmer = math.sin(2 * math.pi * (chord[1] * 2) * t) * 0.12
                pulse = 0.78 + 0.22 * math.sin(2 * math.pi * 0.12 * t)
                value = int(max(-1, min(1, (pad * 0.62 + shimmer) * pulse * fade * 0.18)) * 32767)
                samples.extend(struct.pack("<h", value))
            out.writeframesraw(samples)

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
            segments, transcription_info = model.transcribe(str(input_file), vad_filter=True)
            # Choose the 45-second window with the most spoken words.
            # This is a first-pass highlight heuristic, not visual game-event AI.
            all_segments = [seg for seg in segments if seg.start < 180]
            duration = min(180.0, max(1.0, all_segments[-1].end if all_segments else 45.0))
            clip_length = min(45.0, duration)
            starts = [float(x) for x in range(0, max(1, int(duration - clip_length) + 1), 5)] or [0.0]
            def score_window(window_start):
                window_end = window_start + clip_length
                score = 0
                for seg in all_segments:
                    overlap = max(0.0, min(window_end, seg.end) - max(window_start, seg.start))
                    if overlap:
                        score += len(re.findall(r"\w+", seg.text)) * overlap / max(0.25, seg.end - seg.start)
                return score
            highlight_start = max(starts, key=score_window)
            highlight_end = highlight_start + clip_length
            selected_segments = [seg for seg in all_segments if seg.end > highlight_start and seg.start < highlight_end]
            transcript_parts = [re.sub(r"\s+", " ", seg.text).strip() for seg in selected_segments if seg.text.strip()]
            clip_file = Path(td) / "selected-highlight.mp4"
            subprocess.run(["ffmpeg", "-y", "-ss", str(highlight_start), "-i", str(input_file), "-t", str(clip_length), "-c", "copy", str(clip_file)], check=True, capture_output=True, text=True)
            input_file = clip_file
            subtitle_file = Path(td) / "captions.srt"
            def stamp(seconds):
                ms = int(max(0, seconds) * 1000)
                hours, ms = divmod(ms, 3600000)
                minutes, ms = divmod(ms, 60000)
                secs, ms = divmod(ms, 1000)
                return f"{hours:02}:{minutes:02}:{secs:02},{ms:03}"
            with subtitle_file.open("w", encoding="utf-8") as captions:
                count = 0
                for segment in selected_segments:
                    start_time = max(0.0, segment.start - highlight_start)
                    end_time = min(clip_length, segment.end - highlight_start)
                    caption_text = re.sub(r"\s+", " ", segment.text).strip()
                    if not caption_text or end_time <= start_time:
                        continue
                    count += 1
                    captions.write(f"{count}\n{stamp(start_time)} --> {stamp(end_time)}\n{caption_text}\n\n")
            print(f"Auto-selected highlight: {highlight_start:.1f}s to {highlight_end:.1f}s")
            vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,subtitles=captions.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV=100'"
            voiceover_file = Path(td) / "voiceover.mp3"
            music_file = Path(td) / "original-ambient-music.wav"
            voiceover_enabled = bool(job.get("voiceover_enabled", True)) and bool(transcript_parts) and edge_tts is not None
            music_enabled = bool(job.get("background_music_enabled", True))
            if music_enabled:
                make_original_music(music_file)
            if voiceover_enabled:
                # Neural narration reads the detected speech transcript over quieter game audio.
                narration_text = re.sub(r"\s+", " ", " ".join(transcript_parts)).strip()[:4500]
                voice_map = {"en":"en-US-GuyNeural","ur":"ur-PK-AsadNeural","es":"es-ES-AlvaroNeural","pt":"pt-BR-AntonioNeural","fr":"fr-FR-HenriNeural","de":"de-DE-ConradNeural","ru":"ru-RU-DmitryNeural","ar":"ar-SA-HamedNeural","tr":"tr-TR-AhmetNeural","id":"id-ID-ArdiNeural","zh":"zh-CN-YunxiNeural","ja":"ja-JP-KeitaNeural","ko":"ko-KR-InJoonNeural"}
                voice = voice_map.get(getattr(transcription_info, "language", "en"), "en-US-GuyNeural")
                try:
                    asyncio.run(edge_tts.Communicate(narration_text, voice).save(str(voiceover_file)))
                except Exception as tts_error:
                    print("Neural voiceover unavailable; keeping original game audio:", str(tts_error)[:300])
                    voiceover_enabled = False
            has_voice = voiceover_enabled and voiceover_file.exists() and voiceover_file.stat().st_size
            if music_enabled and has_voice:
                cmd = ["ffmpeg","-y","-i",str(input_file),"-i",str(voiceover_file),"-i",str(music_file),"-t","180","-vf",vf,
                    "-filter_complex","[0:a]volume=0.18[game];[1:a]volume=0.95[narration];[2:a]volume=0.12[music];[game][narration][music]amix=inputs=3:duration=first:dropout_transition=2[a]",
                    "-map","0:v:0","-map","[a]","-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","160k","-movflags","+faststart",str(output_file)]
            elif music_enabled:
                cmd = ["ffmpeg","-y","-i",str(input_file),"-i",str(music_file),"-t","180","-vf",vf,
                    "-filter_complex","[0:a]volume=0.48[game];[1:a]volume=0.12[music];[game][music]amix=inputs=2:duration=first:dropout_transition=2[a]",
                    "-map","0:v:0","-map","[a]","-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","160k","-movflags","+faststart",str(output_file)]
            elif has_voice:
                cmd = ["ffmpeg","-y","-i",str(input_file),"-i",str(voiceover_file),"-t","180","-vf",vf,
                    "-filter_complex","[0:a]volume=0.22[game];[1:a]volume=1.0[narration];[game][narration]amix=inputs=2:duration=first:dropout_transition=2[a]",
                    "-map","0:v:0","-map","[a]","-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","160k","-movflags","+faststart",str(output_file)]
            else:
                cmd = ["ffmpeg","-y","-i",str(input_file),"-t","180","-vf",vf,
                    "-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","128k","-movflags","+faststart",str(output_file)]
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
            if transcript and not notes:
                words = re.findall(r"[A-Za-z0-9']+", transcript)
                if words:
                    title = ("Whiteout Survival | " + " ".join(words[:9])).strip()[:100]
            is_kingshot = "kingshot" in (job["original_name"]+" "+notes).lower()
            tags = (["KingShot","KingShotV4","KingShotGameplay","Gaming","FrostSurvival","Sultan","Shorts"]
                    if is_kingshot else
                    ["WhiteoutSurvival","WOS","WOSPrivateServer","WhiteoutPrivateServer","WOSGaming","WOSCommunity","WOSUpdates","WOSHeroes","WOSTroops","WOSBuildings","WOSFC10","WOSGameplay","WOSGuide","WOSTips","WOSRewards","WOSAlliance","WOSBattle","WOSRally","WhiteoutGameplay","WhiteoutStrategy","WhiteoutSurvivalGuide","WhiteoutSurvivalTips","FrostSurvival","FrostFamily","FrostGaming","FrostCommunity","SurvivalGaming","StrategyGaming","MobileGaming","PrivateServer","PrivateServerGaming","GamingCommunity","MobileStrategy","StrategyGame","SurvivalGame","GamingShorts","YouTubeShorts","DiscordGaming","SultanGaming","GamingPakistan","PakistaniGamer"])
            hashtags = " ".join("#"+x for x in tags[:60])
            game_links = (
                "Whiteout Survival V4: https://landing.jkqwio.com/?invite=92lKnzFdINCXVccIz65\n"
                "Whiteout Survival V5 China: https://passport.wjdr2.top/ops-register?promo=sultaan\n"
                "Whiteout Survival V5 Europe: http://europeeu1.com/ (Promo code: 16365)\n"
                "KingShot V4: https://landing.yunxiaoze.com/?id=YqZv76nI"
            )
            description_parts = [
                notes,
                "❄ FROST SURVIVAL | Sultan",
                "Join our Discord community: https://discord.gg/NVf6zsb35",
                "Download our games:\n" + game_links,
                hashtags
            ]
            description = "\n\n".join(part for part in description_parts if part).strip()
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
