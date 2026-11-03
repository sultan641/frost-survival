const FROST_URL="https://xnixsavppmmvbzfnybus.supabase.co";
const FROST_KEY="sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";
const client=window.supabase?.createClient(FROST_URL,FROST_KEY);

function withTimeout(promise,ms=25000){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("The request timed out. Check your connection and try again.")),ms))
  ]);
}

async function submitForm(form,table,mapper){
  const status=document.getElementById("formStatus");
  const button=form.querySelector('button[type="submit"]');
  if(button)button.disabled=true;
  if(status)status.textContent="Submitting…";
  let uploadedPath=null;
  try{
    if(!client)throw Error("Supabase SDK did not load. Refresh the page and try again.");
    const payload=await mapper(new FormData(form),path=>uploadedPath=path);
    const {error}=await withTimeout(client.from(table).insert(payload));
    if(error)throw error;
    if(status)status.textContent="Submitted successfully. Thank you!";
    form.reset();
  }catch(e){
    console.error("Form submission failed:",e);
    if(uploadedPath&&client){
      try{
        const {error:removeError}=await withTimeout(client.storage.from("bug-screenshots").remove([uploadedPath]),8000);
        if(removeError)console.error("Screenshot cleanup failed:",removeError);
      }catch(cleanupError){
        console.error("Screenshot cleanup failed:",cleanupError);
      }
    }
    if(status)status.textContent="Submission failed: "+(e?.message||"Please check your connection and try again.");
  }finally{
    if(button)button.disabled=false;
  }
}

const app=document.getElementById("applicationForm");
if(app)app.addEventListener("submit",e=>{
  e.preventDefault();
  submitForm(app,"team_applications",async f=>({
    name:f.get("name"),
    role:f.get("role"),
    contact:f.get("discord"),
    social_links:f.get("channel")||null,
    experience:[f.get("live")||"",f.get("experience")||""].filter(Boolean).join(" | ")||null,
    message:f.get("message")
  }));
});

const bug=document.getElementById("bugForm");
if(bug){
  const gameSelect=bug.querySelector("#game");
  const requestedGame=new URLSearchParams(window.location.search).get("game");
  if(requestedGame&&gameSelect&&[...gameSelect.options].some(option=>option.value===requestedGame||option.text===requestedGame)){
    gameSelect.value=requestedGame;
    gameSelect.disabled=true;
    const fixedGame=document.createElement("input");
    fixedGame.type="hidden";
    fixedGame.name="game";
    fixedGame.value=requestedGame;
    bug.appendChild(fixedGame);
    const heading=bug.querySelector("h2");
    if(heading)heading.textContent=requestedGame+" Bug Report";
  }
  bug.addEventListener("submit",e=>{
  e.preventDefault();
  submitForm(bug,"bug_reports",async(f,setUploadedPath)=>{
    let screenshot_path=null;
    const file=f.get("screenshot");
    if(file&&file.size){
      if(file.size>5*1024*1024)throw Error("Screenshot must be 5 MB or smaller.");
      if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Please use PNG, JPG, or WebP.");
      const extension={"image/png":"png","image/jpeg":"jpg","image/webp":"webp"}[file.type];
      const randomId=window.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2);
      screenshot_path="reports/"+randomId+"."+extension;
      const {error}=await withTimeout(client.storage.from("bug-screenshots").upload(screenshot_path,file,{contentType:file.type,upsert:false}));
      if(error)throw error;
      setUploadedPath(screenshot_path);
    }
    const issue=[
      "Location: "+f.get("location"),
      "Problem: "+f.get("description"),
      f.get("solution")?"Suggested solution: "+f.get("solution"):"",
      f.get("ideas")?"Improvement ideas: "+f.get("ideas"):""
    ].filter(Boolean).join("\n\n");
    return {
      game_name:f.get("game")||bug.querySelector("#game")?.value,
      player_name:f.get("name"),
      issue,
      steps_to_reproduce:null,
      screenshot_path
    };
  });
  });
}
