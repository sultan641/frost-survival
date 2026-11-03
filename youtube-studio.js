const SUPABASE_URL="https://xnixsavppmmvbzfnybus.supabase.co";
const SUPABASE_KEY="sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";
const ADMIN_UID="9cd04a06-6937-474a-9b13-ea39b2c3bd35";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const say=(id,msg)=>$(id).textContent=msg;

// Keep the selected video in IndexedDB so Android/Chrome can restore it
// if the page is suspended or reloaded while another app is open.
let restoredUpload=null;
let uploadWakeLock=null;
const UPLOAD_DB="frost-youtube-upload";
function openUploadDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(UPLOAD_DB,1);
    req.onupgradeneeded=()=>req.result.createObjectStore("pending",{keyPath:"id"});
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function savePendingUpload(file,path,notes){
  const database=await openUploadDb();
  await new Promise((resolve,reject)=>{
    const tx=database.transaction("pending","readwrite");
    tx.objectStore("pending").put({id:"current",blob:file,name:file.name,type:file.type,lastModified:file.lastModified,path,notes,savedAt:Date.now()});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  database.close();
}
async function readPendingUpload(){
  const database=await openUploadDb();
  const record=await new Promise((resolve,reject)=>{
    const req=database.transaction("pending","readonly").objectStore("pending").get("current");
    req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
  });
  database.close();
  if(!record)return null;
  const file=new File([record.blob],record.name,{type:record.type,lastModified:record.lastModified});
  return {...record,file};
}
async function clearPendingUpload(){
  const database=await openUploadDb();
  await new Promise((resolve,reject)=>{
    const tx=database.transaction("pending","readwrite");
    tx.objectStore("pending").delete("current");
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  database.close();
}
async function restorePendingUpload(){
  try{
    restoredUpload=await readPendingUpload();
    if(restoredUpload){
      $("uploadBtn").textContent="Resume saved upload";
      $("videoFile").required=false;
      say("uploadStatus","Saved video found: "+restoredUpload.name+" ("+(restoredUpload.file.size/1048576).toFixed(1)+" MB). Tap Resume saved upload. Your previous upload position will be checked.");
    }
  }catch(err){console.warn("Could not restore saved upload:",err);}
}
async function keepScreenAwake(){
  try{if("wakeLock" in navigator)uploadWakeLock=await navigator.wakeLock.request("screen");}catch(_){}
}
async function releaseScreenAwake(){
  try{await uploadWakeLock?.release();}catch(_){}
  uploadWakeLock=null;
}

async function checkYouTube(){
  const {data:{session}}=await db.auth.getSession();
  const btn=$("connectYoutubeBtn");
  if(!session||session.user.id!==ADMIN_UID){btn.textContent="Connect YouTube with Google";say("youtubeStatus","Sign in as the administrator to check YouTube.");return;}
  try{
    const res=await fetch(SUPABASE_URL+"/functions/v1/youtube-oauth-status",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:"{}"});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||"Status check failed");
    if(data.connected){btn.textContent="YouTube Connected ✓";say("youtubeStatus","Connected to YouTube. Authorization saved"+(data.updated_at?" on "+new Date(data.updated_at).toLocaleString():"")+".");}
    else{btn.textContent="Connect YouTube with Google";say("youtubeStatus","YouTube is not connected yet. Select Connect YouTube with Google.");}
  }catch(err){btn.textContent="Connect YouTube with Google";say("youtubeStatus","Could not verify connection: "+err.message);}
}

let tusLibraryPromise;
function loadTusLibrary(){
  if(window.tus)return Promise.resolve(window.tus);
  if(!tusLibraryPromise)tusLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/tus-js-client@4/dist/tus.min.js";
    script.onload=()=>window.tus?resolve(window.tus):reject(new Error("Resumable upload library did not load."));
    script.onerror=()=>reject(new Error("Could not load resumable upload support. Check your connection."));
    document.head.appendChild(script);
  });
  return tusLibraryPromise;
}
async function uploadFileWithProgress(path,file,accessToken){
  const tus=await loadTusLibrary();
  const retryWait=[3000,10000,20000,30000,60000,120000];
  let lastError;
  for(let attempt=0;attempt<retryWait.length+1;attempt++){
    try{
      await new Promise((resolve,reject)=>{
        const upload=new tus.Upload(file,{
          endpoint:"https://xnixsavppmmvbzfnybus.storage.supabase.co/storage/v1/upload/resumable",
          retryDelays:[0,3000,5000,10000,20000,30000,60000],
          headers:{authorization:"Bearer "+accessToken,apikey:SUPABASE_KEY,"x-upsert":"false"},
          uploadDataDuringCreation:false,removeFingerprintOnSuccess:true,chunkSize:6*1024*1024,
          metadata:{bucketName:"youtube-studio-private",objectName:path,contentType:file.type,cacheControl:"3600"},
          onError:reject,
          onProgress:(uploaded,total)=>{
            const percent=Math.min(100,Math.round(uploaded/total*100));
            const mb=n=>(n/1048576).toFixed(1);
            $("progressBar").style.width=percent+"%";
            say("uploadStatus","Uploading: "+percent+"% • "+mb(uploaded)+" MB / "+mb(total)+" MB");
          },
          onSuccess:resolve
        });
        upload.findPreviousUploads().then(previous=>{
          if(previous.length)upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        }).catch(reject);
      });
      return;
    }catch(error){
      lastError=error;
      if(attempt>=retryWait.length)break;
      const seconds=Math.round(retryWait[attempt]/1000);
      say("uploadStatus","Upload interrupted. Auto-retrying in "+seconds+" seconds… Your saved video is safe.");
      await new Promise(resolve=>setTimeout(resolve,retryWait[attempt]));
    }
  }
  throw new Error("Upload could not finish after automatic retries. Your video is saved on this device; reopen Studio and tap Resume saved upload. "+(lastError?.message||""));
}

async function checkAdmin(){const {data,error}=await db.auth.getSession();if(error){say("loginStatus",error.message);return;}const user=data.session?.user;if(user&&user.id!==ADMIN_UID){await db.auth.signOut();say("loginStatus","Access denied. Administrator only.");return;}const ok=!!user;$("loginBox").hidden=ok;$("studio").hidden=!ok;if(ok){await loadJobs();await checkYouTube();await restorePendingUpload();}}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();say("loginStatus","Signing in…");const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){say("loginStatus","Sign in failed: "+error.message);return;}await checkAdmin();});
$("connectYoutubeBtn").addEventListener("click",async()=>{const {data:{session}}=await db.auth.getSession();if(!session||session.user.id!==ADMIN_UID){say("youtubeStatus","Admin session expired. Sign in again.");return;}const btn=$("connectYoutubeBtn");btn.disabled=true;say("youtubeStatus","Opening Google authorization…");try{const res=await fetch(SUPABASE_URL+"/functions/v1/youtube-oauth-start",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:"{}"});const data=await res.json();if(!res.ok||!data.url)throw new Error(data.message||"Could not start Google authorization.");window.location.href=data.url;}catch(err){say("youtubeStatus","Connection failed: "+err.message);btn.disabled=false;}});
$("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();$("studio").hidden=true;$("loginBox").hidden=false;say("loginStatus","Signed out.");});
$("uploadForm").addEventListener("submit",async e=>{e.preventDefault();const file=$("videoFile").files[0]||restoredUpload?.file;if(!file)return;if(file.size>524288000){say("uploadStatus","File is larger than 500 MB.");return;}if(!["video/mp4","video/quicktime","video/webm"].includes(file.type)){say("uploadStatus","Please choose an MP4, MOV or WebM video.");return;}const {data:{session}}=await db.auth.getSession();if(!session||session.user.id!==ADMIN_UID){say("uploadStatus","Admin session expired. Sign in again.");return;}const btn=$("uploadBtn");btn.disabled=true;$( "progressBar").style.width="5%";say("uploadStatus","Starting secure upload…");let path=null;try{const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");path=restoredUpload?.path||session.user.id+"/"+crypto.randomUUID()+"-"+safeName;const savedNotes=$("editNotes").value.trim()||restoredUpload?.notes||"";await savePendingUpload(file,path,savedNotes);restoredUpload={file,path,notes:savedNotes};$("uploadBtn").textContent="Resume saved upload";await keepScreenAwake();say("uploadStatus","Uploading securely… Your video is saved on this device and can be resumed if Chrome is interrupted.");await uploadFileWithProgress(path,file,session.access_token);$("progressBar").style.width="95%";say("uploadStatus","Upload complete. Saving to your queue…");const ins=await db.from("youtube_studio_jobs").insert({owner_id:session.user.id,original_path:path,original_name:file.name,mime_type:file.type,file_size:file.size,status:"uploaded",description:$("editNotes").value.trim()||restoredUpload?.notes||null,approval_required:!$("autoPublish").checked,publish_privacy:$("publishPrivacy").value});if(ins.error){await db.storage.from("youtube-studio-private").remove([path]);path=null;throw new Error("Video uploaded, but queue registration failed: "+ins.error.message);} $("progressBar").style.width="100%";say("uploadStatus","Video uploaded and saved privately. AI editing is queued. Your Auto Mode choice will control upload.");await clearPendingUpload();restoredUpload=null;$("uploadBtn").textContent="Upload video";$("videoFile").required=true;e.target.reset();await loadJobs();}catch(err){console.error("Frost Survival video upload error:",err);$("progressBar").style.width="0%";const msg=err?.message||String(err);say("uploadStatus",msg==="Failed to fetch"?"Network/CORS error: the browser could not reach private storage. Try another network or Chrome, then retry.": "Upload failed: "+msg);}finally{await releaseScreenAwake();btn.disabled=false;if(restoredUpload)btn.textContent="Resume saved upload";}});
async function loadJobs(){const {data,error}=await db.from("youtube_studio_jobs").select("id,original_name,file_size,status,title,youtube_video_id,error_message,created_at,approval_required").order("created_at",{ascending:false}).limit(30);const el=$("jobs");if(error){el.textContent="Could not load queue: "+error.message;return;}if(!data?.length){el.innerHTML='<p class="yt-muted">No uploads yet.</p>';return;}el.innerHTML=data.map(j=>'<div class="yt-job"><strong>'+esc(j.original_name)+'</strong><p class="yt-muted">'+(j.file_size/1048576).toFixed(1)+' MB • '+new Date(j.created_at).toLocaleString()+'</p><b>Status: '+esc(j.status)+'</b>'+(j.title?'<p>'+esc(j.title)+'</p>':'')+(j.youtube_video_id?'<p>YouTube ID: '+esc(j.youtube_video_id)+'</p>':'')+(j.error_message?'<p>'+esc(j.error_message)+'</p>':'')+(j.status==="ready"?'<p class="yt-muted">Edited video ready for approval.</p><button class="yt-btn" type="button" onclick="approveVideoJob(\''+j.id+\'\')">Approve & upload</button>':"")+(j.status==="failed"?'<button class="yt-btn" type="button" onclick="retryVideoJob(\''+j.id+'\')">Retry processing</button>':'')+'</div>').join("");}
async function retryVideoJob(id){
  const {data:{session}}=await db.auth.getSession();
  if(!session||session.user.id!==ADMIN_UID){say("uploadStatus","Admin session expired. Sign in again.");return;}
  const {error}=await db.from("youtube_studio_jobs").update({status:"uploaded",error_message:null,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",ADMIN_UID);
  if(error){say("uploadStatus","Could not retry this video: "+error.message);return;}
  say("uploadStatus","Video queued again. The automatic worker will check it within 15 minutes.");
  await loadJobs();
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
db.auth.onAuthStateChange(()=>setTimeout(checkAdmin,0));checkAdmin();
async function approveVideoJob(id){const {data:{session}}=await db.auth.getSession();if(!session||session.user.id!==ADMIN_UID){say("uploadStatus","Admin session expired. Sign in again.");return;}const {error}=await db.from("youtube_studio_jobs").update({status:"queued",approval_required:false,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",ADMIN_UID).eq("status","ready");if(error){say("uploadStatus","Could not approve: "+error.message);return;}say("uploadStatus","Approved. Upload will start on the next worker run.");await loadJobs();}
