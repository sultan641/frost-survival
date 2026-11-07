const SUPABASE_URL="https://xnixsavppmmvbzfnybus.supabase.co";
const SUPABASE_KEY="sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";
const ADMIN_UID="9cd04a06-6937-474a-9b13-ea39b2c3bd35";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const say=(id,msg)=>$(id).textContent=msg;

const SETTINGS_KEY="frost-youtube-studio-settings-v1";
function loadStudioSettings(){
  let saved={};try{saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");}catch(_){}
  if(saved.publishPrivacy&&["private","unlisted","public"].includes(saved.publishPrivacy))$("publishPrivacy").value=saved.publishPrivacy;
  if(saved.contentType&&$("contentType"))$("contentType").value=saved.contentType;
  if(typeof saved.autoPublish==="boolean")$("autoPublish").checked=saved.autoPublish;
  if(typeof saved.voiceoverEnabled==="boolean")$("voiceoverEnabled").checked=saved.voiceoverEnabled;
  if(typeof saved.backgroundMusicEnabled==="boolean")$("backgroundMusicEnabled").checked=saved.backgroundMusicEnabled;
}
function saveStudioSettings(){
  try{
    const settings={publishPrivacy:$("publishPrivacy").value,contentType:$("contentType")?.value||"other",autoPublish:$("autoPublish").checked,voiceoverEnabled:$("voiceoverEnabled").checked,backgroundMusicEnabled:$("backgroundMusicEnabled").checked};
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
    const check=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"null");
    if(!check||check.publishPrivacy!==settings.publishPrivacy)throw new Error("Saved value could not be verified.");
    return true;
  }catch(err){console.warn("Could not save Studio settings:",err);return false;}
}


// Multi-file resumable upload queue. Each pending video has its own IndexedDB recovery record.
let restoredUploads=[];
let uploadWakeLock=null;
let uploadInProgress=false;
let autoResumeStarted=false;
let autoResumeTimer=null;
const UPLOAD_DB="frost-youtube-upload";
function openUploadDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(UPLOAD_DB,2);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains("pending"))req.result.createObjectStore("pending",{keyPath:"id"});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function savePendingUpload(file,path,metadata){
  const database=await openUploadDb();
  await new Promise((resolve,reject)=>{
    const tx=database.transaction("pending","readwrite");
    tx.objectStore("pending").put({id:path,blob:file,name:file.name,type:file.type,lastModified:file.lastModified,path,...metadata,savedAt:Date.now()});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  database.close();
}
async function readPendingUploads(){
  const database=await openUploadDb();
  const rows=await new Promise((resolve,reject)=>{
    const req=database.transaction("pending","readonly").objectStore("pending").getAll();
    req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
  });
  database.close();
  return rows.map(record=>({...record,file:new File([record.blob],record.name,{type:record.type,lastModified:record.lastModified})}));
}
async function clearPendingUpload(id){
  const database=await openUploadDb();
  await new Promise((resolve,reject)=>{
    const tx=database.transaction("pending","readwrite");
    tx.objectStore("pending").delete(id);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
  database.close();
}
function renderBatchStatus(records){
  const area=$("batchStatus");if(!area)return;
  area.hidden=!records.length;area.replaceChildren();
  const title=document.createElement("strong");title.textContent="Upload progress";area.append(title);
  records.forEach(record=>{
    const row=document.createElement("div");row.className="yt-job";row.dataset.uploadId=record.path;
    const name=document.createElement("strong");name.textContent=record.name;
    const info=document.createElement("p");info.className="yt-muted";info.textContent=(record.file.size/1048576).toFixed(1)+" MB · "+(record.contentType||"other").replaceAll("_"," ");
    const progress=document.createElement("div");progress.className="yt-progress";
    const bar=document.createElement("span");bar.style.width="0%";progress.append(bar);
    const state=document.createElement("p");state.className="yt-status";state.textContent=record.state||"Saved for upload";
    row.append(name,info,progress,state);
    if(String(record.state||"").toLowerCase().includes("error")){const retry=document.createElement("button");retry.type="button";retry.className="yt-btn";retry.textContent="Retry this video";retry.onclick=async()=>{const {data:{session}}=await db.auth.getSession();if(!session||session.user.id!==ADMIN_UID)return say("uploadStatus","Admin session expired. Sign in again.");await uploadBatchRecords([record],session,true);};row.append(retry);}
    area.append(row);
  });
}
function setBatchFileStatus(path,message,percent){
  const row=$("batchStatus")?.querySelector('[data-upload-id="'+CSS.escape(path)+'"]');
  if(!row)return;
  const state=row.querySelector(".yt-status");if(state)state.textContent=message;
  if(typeof percent==="number"){const bar=row.querySelector(".yt-progress span");if(bar)bar.style.width=Math.max(0,Math.min(100,percent))+"%";}
}
function scheduleAutoResume(){
  if(!restoredUploads.length||uploadInProgress||autoResumeStarted||$("studio").hidden||!navigator.onLine)return;
  autoResumeStarted=true;clearTimeout(autoResumeTimer);
  autoResumeTimer=setTimeout(async()=>{
    autoResumeStarted=false;
    if(!restoredUploads.length||uploadInProgress||$("studio").hidden||!navigator.onLine)return;
    const {data:{session}}=await db.auth.getSession();
    if(session?.user?.id===ADMIN_UID)await uploadBatchRecords(restoredUploads.slice(),session,true);
  },1500);
}
async function restorePendingUpload(){
  try{
    restoredUploads=await readPendingUploads();
    if(restoredUploads.length){
      restoredUploads.forEach(x=>x.state="Saved · waiting to resume");
      renderBatchStatus(restoredUploads);
      say("uploadStatus",restoredUploads.length+" saved upload(s) found. Resuming automatically when the connection is ready.");
      scheduleAutoResume();
    }
  }catch(err){console.warn("Could not restore saved uploads:",err);}
}
async function keepScreenAwake(){
  try{if(navigator.storage && navigator.storage.persist)await navigator.storage.persist();}catch(_){}
  try{if("wakeLock" in navigator)uploadWakeLock=await navigator.wakeLock.request("screen");}catch(_){}
}
async function releaseScreenAwake(){
  try{await uploadWakeLock?.release();}catch(_){}
  uploadWakeLock=null;
}
document.addEventListener("visibilitychange",()=>{
  if(uploadInProgress){
    if(document.visibilityState==="hidden")say("uploadStatus","Uploads are running. Android may pause Chrome in the background; each file has its own saved recovery point.");
    else say("uploadStatus","Studio active again. Uploads continue or resume from their saved positions.");
  }else if(document.visibilityState==="visible")scheduleAutoResume();
});
window.addEventListener("online",()=>{if(restoredUploads.length){say("uploadStatus","Internet restored. Resuming saved uploads…");scheduleAutoResume();}});
window.addEventListener("beforeunload",event=>{if(uploadInProgress){event.preventDefault();event.returnValue="Video uploads are still running. Leave this page?";}});
async function uploadBatchRecords(records,session,fromRecovery=false){
  if(uploadInProgress){renderBatchStatus(restoredUploads);return;}
  if(!restoredUploads.length)return;
  records=restoredUploads;
  uploadInProgress=true;autoResumeStarted=false;
  await keepScreenAwake();
  const outcomes=[];
  let next=0;
  const worker=async()=>{
    while(next<records.length){
      const record=records[next++];
      try{
        setBatchFileStatus(record.path,"Uploading…",0);
        await uploadFileWithProgress(record.path,record.file,session.access_token,pct=>setBatchFileStatus(record.path,"Uploading "+pct+"%",pct));
        setBatchFileStatus(record.path,"Registering in AI queue…",98);
        const existing=await db.from("youtube_studio_jobs").select("id").eq("owner_id",ADMIN_UID).eq("original_path",record.path).maybeSingle();
        if(existing.error)throw existing.error;
        if(!existing.data){
          const ins=await db.from("youtube_studio_jobs").insert({
            owner_id:session.user.id,original_path:record.path,original_name:record.name,mime_type:record.type,file_size:record.file.size,
            status:"uploaded",description:record.notes||null,title:record.title||null,content_type:record.contentType||"other",
            approval_required:!!record.approvalRequired,voiceover_enabled:record.voiceoverEnabled!==false,
            background_music_enabled:record.backgroundMusicEnabled!==false,publish_privacy:record.publishPrivacy||"private"
          });
          if(ins.error)throw ins.error;
        }
        await clearPendingUpload(record.id||record.path);
        restoredUploads=restoredUploads.filter(x=>x.path!==record.path);
        record.state="Uploaded · AI editing queued";
        setBatchFileStatus(record.path,"Uploaded · AI editing queued",100);
        outcomes.push({ok:true,name:record.name});
      }catch(error){
        record.state="Upload error · saved for retry";
        setBatchFileStatus(record.path,"Error: "+(error?.message||String(error))+" · kept for retry",0);
        outcomes.push({ok:false,name:record.name,error:error?.message||String(error)});
      }
    }
  };
  try{
    renderBatchStatus(records);
    const concurrency=Math.min(2,records.length);
    await Promise.all(Array.from({length:concurrency},()=>worker()));
    renderBatchStatus(records);
    const ok=outcomes.filter(x=>x.ok).length,failed=outcomes.length-ok;
    say("uploadStatus",ok+" of "+outcomes.length+" video(s) uploaded to the private AI queue."+(failed?" "+failed+" upload(s) remain saved and will retry when possible.":" AI processing will start automatically."));
    await loadJobs();
  }finally{
    uploadInProgress=false;await releaseScreenAwake();
    if(restoredUploads.length && !outcomes.some(x=>!x.ok)) scheduleAutoResume();
  }
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
async function uploadFileWithProgress(path,file,accessToken,onProgress){
  const tus=await loadTusLibrary();
  const retryWait=[3000,10000,20000,30000,60000,120000];
  let lastError;
  for(let attempt=0;attempt<retryWait.length+1;attempt++){
    try{
      await new Promise((resolve,reject)=>{
        const upload=new tus.Upload(file,{
          endpoint:"https://xnixsavppmmvbzfnybus.storage.supabase.co/storage/v1/upload/resumable",
          retryDelays:[0,2000,4000,8000,15000,30000,60000],
          headers:{authorization:"Bearer "+accessToken,apikey:SUPABASE_KEY,"x-upsert":"false"},
          uploadDataDuringCreation:false,removeFingerprintOnSuccess:true,chunkSize:8*1024*1024,
          metadata:{bucketName:"youtube-studio-private",objectName:path,contentType:file.type,cacheControl:"3600"},
          onError:reject,
          onProgress:(uploaded,total)=>{
            const percent=Math.min(100,Math.round(uploaded/total*100));
            if(onProgress)onProgress(percent,uploaded,total);
            const mb=n=>(n/1048576).toFixed(1);
            say("uploadStatus","Uploading "+file.name+": "+percent+"% · "+mb(uploaded)+" / "+mb(total)+" MB");
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
      say("uploadStatus","Connection interrupted. Retrying "+file.name+" in "+Math.round(retryWait[attempt]/1000)+" seconds. Its saved upload point is retained.");
      await new Promise(resolve=>setTimeout(resolve,retryWait[attempt]));
    }
  }
  throw new Error("Could not finish "+file.name+". "+(lastError?.message||"Upload failed."));
}
async function checkAdmin(){const {data,error}=await db.auth.getSession();if(error){say("loginStatus",error.message);return;}const user=data.session?.user;if(user&&user.id!==ADMIN_UID){await db.auth.signOut();say("loginStatus","Access denied. Administrator only.");return;}const ok=!!user;$("loginBox").hidden=ok;$("studio").hidden=!ok;if(ok){await loadJobs();await checkYouTube();await restorePendingUpload();startLiveMonitor();}}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();say("loginStatus","Signing in…");const {error}=await db.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});if(error){say("loginStatus","Sign in failed: "+error.message);return;}await checkAdmin();});
$("connectYoutubeBtn").addEventListener("click",async()=>{const {data:{session}}=await db.auth.getSession();if(!session||session.user.id!==ADMIN_UID){say("youtubeStatus","Admin session expired. Sign in again.");return;}const btn=$("connectYoutubeBtn");btn.disabled=true;say("youtubeStatus","Opening Google authorization…");try{const res=await fetch(SUPABASE_URL+"/functions/v1/youtube-oauth-start",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:"{}"});const data=await res.json();if(!res.ok||!data.url)throw new Error(data.message||"Could not start Google authorization.");window.location.href=data.url;}catch(err){say("youtubeStatus","Connection failed: "+err.message);btn.disabled=false;}});
$("logoutBtn").addEventListener("click",async()=>{await db.auth.signOut();$("studio").hidden=true;$("loginBox").hidden=false;say("loginStatus","Signed out.");});
$("uploadForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const files=[...($("videoFile").files||[])];
  if(!files.length){say("uploadStatus","Choose one or more videos first.");return;}
  if(files.length>10){say("uploadStatus","Select up to 10 videos per batch.");return;}
  for(const file of files){
    if(file.size>524288000){say("uploadStatus",file.name+" is larger than 500 MB.");return;}
    if(!["video/mp4","video/quicktime","video/webm"].includes(file.type)){say("uploadStatus","Unsupported file type: "+file.name);return;}
  }
  const {data:{session}}=await db.auth.getSession();
  if(!session||session.user.id!==ADMIN_UID){say("uploadStatus","Admin session expired. Sign in again.");return;}
  const batchType=$("contentType").value||"other";
  const notes=$("editNotes").value.trim();
  const customTitle=$("customTitle").value.trim();
  const records=files.map(file=>{
    const path=session.user.id+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    return {id:path,path,file,name:file.name,type:file.type,notes,title:files.length===1?customTitle:null,contentType:batchType,
      approvalRequired:!$("autoPublish").checked,voiceoverEnabled:$("voiceoverEnabled").checked,
      backgroundMusicEnabled:$("backgroundMusicEnabled").checked,publishPrivacy:$("publishPrivacy").value,
      state:"Saving secure recovery copy…"};
  });
  const btn=$("uploadBtn");btn.disabled=true;
  try{
    await Promise.all(records.map(record=>savePendingUpload(record.file,record.path,{
      name:record.name,type:record.type,notes:record.notes,title:record.title,contentType:record.contentType,
      approvalRequired:record.approvalRequired,voiceoverEnabled:record.voiceoverEnabled,
      backgroundMusicEnabled:record.backgroundMusicEnabled,publishPrivacy:record.publishPrivacy
    })));
    restoredUploads.push(...records);
    renderBatchStatus(records);
    $("videoFile").value="";
    await uploadBatchRecords(records,session);
    $("editNotes").value="";$("customTitle").value="";
  }catch(error){
    say("uploadStatus","Could not prepare upload batch: "+(error?.message||String(error)));
  }finally{btn.disabled=false;await loadJobs();}
});
async function loadJobs(){
  const {data,error}=await db.from("youtube_studio_jobs").select("id,original_name,file_size,status,title,content_type,output_path,youtube_video_id,error_message,created_at,approval_required,progress_stage,progress_percent,progress_message").order("created_at",{ascending:false}).limit(30);
  const el=$("jobs");
  if(error){el.textContent="Could not load queue: "+error.message;return;}
  if(!data?.length){el.innerHTML='<p class="yt-muted">No uploads yet.</p>';return;}
  const cards=await Promise.all(data.map(async j=>{
    let preview="";
    if(j.status==="ready"&&j.output_path){
      const {data:signed,error:signError}=await db.storage.from("youtube-studio-private").createSignedUrl(j.output_path,3600);
      if(!signError&&signed?.signedUrl){const url=esc(signed.signedUrl);preview='<video controls playsinline preload="metadata" style="width:100%;max-height:420px;border-radius:10px;margin-top:10px" src="'+url+'"></video><p><a href="'+url+'" target="_blank" rel="noopener">Open edited video</a></p>';}
      else preview='<p class="yt-muted">Preview link unavailable: '+esc(signError?.message||"Unknown error")+'</p>';
    }
    const actions=j.status==="ready"?'<p class="yt-muted">Review the edited video above, then approve it for YouTube upload.</p><button class="yt-btn" type="button" onclick="approveVideoJob(\''+j.id+'\')">Approve & upload</button>':(j.status==="failed"?'<button class="yt-btn" type="button" onclick="retryVideoJob(\''+j.id+'\')">Retry processing</button>':"");
    const pct=Math.max(0,Math.min(100,Number(j.progress_percent)||0));
    const live=(j.status==="processing"||j.status==="uploaded"||j.status==="queued")?'<div class="yt-progress" style="height:12px;margin:12px 0"><span style="width:'+pct+'%"></span></div><p class="yt-status">'+pct+'% • '+esc(j.progress_message||j.progress_stage||"Waiting for worker")+'</p>':"";
    return '<div class="yt-job"><strong>'+esc(j.original_name)+'</strong><p class="yt-muted">'+(j.file_size/1048576).toFixed(1)+' MB • '+new Date(j.created_at).toLocaleString()+'</p><b>Status: '+esc(j.status)+'</b>'+live+(j.content_type?'<p class="yt-muted">Category: '+esc(j.content_type.replaceAll('_',' '))+'</p>':"")+(j.title?'<p>'+esc(j.title)+'</p>':"")+preview+(j.youtube_video_id?'<p>YouTube ID: '+esc(j.youtube_video_id)+'</p>':"")+(j.error_message?'<p>'+esc(j.error_message)+'</p>':"")+actions+'</div>';
  }));
  el.innerHTML=cards.join("");
}
async function retryVideoJob(id){
  const {data:{session}}=await db.auth.getSession();
  if(!session||session.user.id!==ADMIN_UID){say("uploadStatus","Admin session expired. Sign in again.");return;}
  const {error}=await db.from("youtube_studio_jobs").update({status:"uploaded",retry_count:0,error_message:null,progress_stage:"queued",progress_percent:0,progress_message:"Manual retry queued",updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",ADMIN_UID);
  if(error){say("uploadStatus","Could not retry this video: "+error.message);return;}
  say("uploadStatus","Video queued again. The automatic worker will check it within 15 minutes.");
  await loadJobs();
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("saveSettingsBtn").addEventListener("click",()=>{
  const btn=$("saveSettingsBtn");btn.disabled=true;btn.textContent="Saving…";say("settingsStatus","Saving…");
  requestAnimationFrame(()=>{
    const ok=saveStudioSettings();btn.disabled=false;btn.textContent="Save settings";
    say("settingsStatus",ok?"✓ Successfully saved on this device. Visibility: "+$("publishPrivacy").value.toUpperCase()+".":"⚠ Save failed. Browser storage may be blocked.");
  });
});
["publishPrivacy","contentType","autoPublish","voiceoverEnabled","backgroundMusicEnabled"].forEach(id=>$(id).addEventListener("change",()=>{
  const ok=saveStudioSettings();say("settingsStatus",ok?"✓ Changes saved automatically.":"⚠ Could not save in this browser.");
}));loadStudioSettings();
db.auth.onAuthStateChange(()=>setTimeout(checkAdmin,0));checkAdmin();
async function approveVideoJob(id){const {data:{session}}=await db.auth.getSession();if(!session||session.user.id!==ADMIN_UID){say("uploadStatus","Admin session expired. Sign in again.");return;}const {error}=await db.from("youtube_studio_jobs").update({status:"queued",approval_required:false,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",ADMIN_UID).eq("status","ready");if(error){say("uploadStatus","Could not approve: "+error.message);return;}say("uploadStatus","Approved. Upload will start on the next worker run.");await loadJobs();}

let liveMonitor=null;
function startLiveMonitor(){if(liveMonitor)clearInterval(liveMonitor);liveMonitor=setInterval(()=>{if(!$("studio").hidden)loadJobs();},8000);}
