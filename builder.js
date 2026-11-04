const SB_URL="https://xnixsavppmmvbzfnybus.supabase.co",SB_KEY="sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";
const db=window.supabase.createClient(SB_URL,SB_KEY);
let user=null,site=null,sites=[],plan="free",premiumActive=false,aiMessages=[];
const $=id=>document.getElementById(id),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const builderInviteUrl="https://sultan641.github.io/frost-survival/builder.html";
async function shareBuilderLink(copyOnly=false){const status=$("inviteStatus");try{if(!copyOnly&&navigator.share){await navigator.share({title:"Frost Survival Website Builder",text:"Create your own gaming community website.",url:builderInviteUrl});status.textContent="Share menu opened.";}else{await navigator.clipboard.writeText(builderInviteUrl);status.textContent="Registration link copied."}}catch(e){if(e.name!=="AbortError")status.textContent="Copy this link: "+builderInviteUrl}}
$("shareBuilder").onclick=()=>shareBuilderLink(false);$("copyBuilder").onclick=()=>shareBuilderLink(true);
function entry(type,item={}){const box=document.createElement("div");box.className="entry";box.dataset.entry=type;const fields=type==="game"?[["name","Game name"],["url","Download URL"],["promo","Promo code"],["description","Short description"]]:type==="social"?[["label","Platform"],["url","Profile / invite URL"]]:type==="gift"?[["game","Game"],["code","Gift code"],["expires","Expiry (optional)"]]:type==="page"?[["title","Page title"],["slug","Page ID (letters/numbers/hyphens)"],["body","Page content"]]:[["title","Announcement title"],["message","Announcement text"]];
box.innerHTML=fields.map(([k,l])=>'<label>'+l+(k==="body"?'<textarea data-field="'+k+'" maxlength="5000" rows="4">'+esc(item[k]||"")+'</textarea>':'<input data-field="'+k+'" maxlength="500" value="'+esc(item[k]||"")+'" placeholder="'+l+'">')+'</label>').join("")+'<button type="button" class="builder-btn danger remove">Remove</button>';box.querySelector(".remove").onclick=()=>box.remove();return box}
function add(type,item){const id=type==="game"?"games":type==="social"?"socials":type==="gift"?"giftCodes":type==="page"?"customPages":"announcements";$(id).append(entry(type,item))}
function getRows(id){return [...$(id).querySelectorAll(".entry")].map(e=>Object.fromEntries([...e.querySelectorAll("[data-field]")].map(x=>[x.dataset.field,x.value.trim()]))).filter(o=>Object.values(o).some(Boolean))}

function showMediaPreview(kind,url){const img=$(kind+"Preview");if(url){img.src=url;img.hidden=false}else{img.hidden=true;img.removeAttribute("src")}}
async function uploadSiteImage(kind,file){
 if(!user)throw new Error("Please sign in first.");
 if(!file) return;
 if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Choose a PNG, JPG or WEBP image.");
 if(file.size>5*1024*1024)throw new Error("Image must be 5 MB or smaller.");
 const slug=$( "slug").value.trim().toLowerCase();
 if(!site&&!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug))throw new Error("Enter your website address and save or upload again.");
 const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
 const folder=site?.id||("draft-"+slug);
 const path=user.id+"/"+folder+"/"+kind+"-"+Date.now()+"."+ext;
 const {error}=await db.storage.from("customer-site-media").upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw error;
 const {data}=db.storage.from("customer-site-media").getPublicUrl(path);
 $(kind+"Url").value=data.publicUrl;showMediaPreview(kind,data.publicUrl);
}
["logo","banner"].forEach(kind=>{$("choose"+kind.charAt(0).toUpperCase()+kind.slice(1)).onclick=()=>$(kind+"File").click();$(kind+"File").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;const status=$("saveStatus");status.textContent="Uploading "+kind+"…";e.target.disabled=true;try{await uploadSiteImage(kind,file);status.textContent=kind+" uploaded. Save your website to publish the change."}catch(err){status.textContent="Upload failed: "+err.message;e.target.value=""}finally{e.target.disabled=false}})});


const DRAFT_KEY_PREFIX="frost_builder_draft_v1:";let draftTimer=null;
function draftKey(){return DRAFT_KEY_PREFIX+(user?.id||"guest");}
function collectDraft(){const val=id=>$(id)?.value??"";return {siteName:val("siteName"),slug:val("slug"),description:val("description"),websiteTier:val("websiteTier"),heroTitle:val("heroTitle"),heroText:val("heroText"),logoUrl:val("logoUrl"),bannerUrl:val("bannerUrl"),aboutText:val("aboutText"),published:!!$("published")?.checked,games:getRows("games"),socials:getRows("socials"),giftCodes:getRows("giftCodes"),announcements:getRows("announcements"),customPages:getRows("customPages"),savedAt:new Date().toISOString()};}
function saveLocalDraft(){if(!user||$("editor").hidden)return;try{localStorage.setItem(draftKey(),JSON.stringify(collectDraft()));$("draftStatus").textContent="Draft saved automatically on this device."}catch(e){$("draftStatus").textContent="Automatic draft storage unavailable."}}
function scheduleDraftSave(){clearTimeout(draftTimer);draftTimer=setTimeout(saveLocalDraft,200)}
function restoreLocalDraft(){if(!user)return;try{const raw=localStorage.getItem(draftKey());if(!raw)return;const d=JSON.parse(raw);if(!d?.savedAt)return;$("siteName").value=d.siteName||"";$("slug").value=d.slug||"";$("description").value=d.description||"";$("websiteTier").value=d.websiteTier||"free";$("heroTitle").value=d.heroTitle||"";$("heroText").value=d.heroText||"";$("logoUrl").value=d.logoUrl||"";$("bannerUrl").value=d.bannerUrl||"";showMediaPreview("logo",d.logoUrl||"");showMediaPreview("banner",d.bannerUrl||"");$("aboutText").value=d.aboutText||"";$("published").checked=!!d.published;["games","socials","giftCodes","announcements","customPages"].forEach(id=>$(id).innerHTML="");(d.games||[]).forEach(x=>add("game",x));(d.socials||[]).forEach(x=>add("social",x));(d.giftCodes||[]).forEach(x=>add("gift",x));(d.announcements||[]).forEach(x=>add("announcement",x));(d.customPages||[]).forEach(x=>add("page",x));$("draftStatus").textContent="Recovered unsaved draft from this device. Press Save Website to sync it online."}catch(e){$("draftStatus").textContent="Could not restore local draft."}}
document.addEventListener("input",e=>{if(e.target.closest("#editor"))scheduleDraftSave()});document.addEventListener("change",e=>{if(e.target.closest("#editor"))scheduleDraftSave()});

function validUrl(v){try{return ["https:","http:"].includes(new URL(v).protocol)}catch{return false}}
function clearEditor(){["siteName","slug","description","heroTitle","heroText","logoUrl","bannerUrl","aboutText"].forEach(id=>$(id).value="");["logoFile","bannerFile"].forEach(id=>$(id).value="");["logoPreview","bannerPreview"].forEach(id=>{const p=$(id);p.hidden=true;p.removeAttribute("src")});["games","socials","giftCodes","announcements","customPages"].forEach(id=>$(id).innerHTML="");$("published").checked=false;$("slug").disabled=false;$("saveStatus").textContent="";$("websiteTier").value="free";$("websiteTier").disabled=false;$("premiumAiPanel").hidden=true;$("premiumAiChat").textContent="";$("premiumAiStatus").textContent="";aiMessages=[];site=null}
function fillEditor(s){clearEditor();site=s;if(!s){$("websiteTier").disabled=false;return}$("siteName").value=s.site_name||"";$("websiteTier").value=s.website_tier||"free";$("websiteTier").disabled=true;$("premiumAiPanel").hidden=!(premiumActive&&s.website_tier==="premium");$("slug").value=s.slug||"";$("slug").disabled=true;$("description").value=s.description||"";const c=s.content||{};$("heroTitle").value=c.hero_title||"";$("heroText").value=c.hero_text||"";$("logoUrl").value=c.logo_url||"";$("bannerUrl").value=c.banner_url||"";showMediaPreview("logo",c.logo_url||"");showMediaPreview("banner",c.banner_url||"");$("aboutText").value=c.about_text||"";$("published").checked=!!s.published;for(const x of c.games||[])add("game",x);for(const x of c.socials||[])add("social",x);for(const x of c.gift_codes||[])add("gift",x);for(const x of c.announcements||[])add("announcement",x);for(const x of c.custom_pages||[])add("page",x)}
async function refreshSites(selectId=null){const {data,error}=await db.from("builder_sites").select("*").eq("owner_id",user.id).order("created_at");if(error){$("saveStatus").textContent=error.message;return}sites=data||[];$("siteSelect").innerHTML='<option value="">Create a new website</option>'+sites.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.site_name)+'</option>').join("");if(selectId){$("siteSelect").value=selectId;fillEditor(sites.find(s=>s.id===selectId)||null)}else if(sites.length){$("siteSelect").value=sites[0].id;fillEditor(sites[0])}else{ $("siteSelect").value="";fillEditor(null)}}
async function load(){const {data:{session}}=await db.auth.getSession();user=session?.user||null;if(!user){$("authPanel").hidden=false;$("editor").hidden=true;return}
$("authPanel").hidden=true;$("editor").hidden=false;
const {data:sub}=await db.from("builder_subscriptions").select("plan,status,current_period_end,billing_cycle").eq("owner_id",user.id).maybeSingle();
plan=sub?.plan||"free";premiumActive=plan==="premium"&&sub?.status==="active"&&(!sub.current_period_end||new Date(sub.current_period_end)>new Date());$("websiteTier").querySelector('option[value="premium"]').disabled=!premiumActive;
$("planStatus").textContent=premiumActive?"PREMIUM ACTIVE · Up to 2 websites"+(sub.current_period_end?" · Renews/expires "+new Date(sub.current_period_end).toLocaleDateString():""):"FREE PLAN · 1 website · Upgrade to Premium for 2 websites and custom pages.";
$("addCustomPage").disabled=!premiumActive;$("addCustomPage").title=premiumActive?"":"Premium feature — upgrade to add pages";
await refreshSites();restoreLocalDraft();}
async function authAction(buttonId,action){
 const button=$(buttonId),status=$("authStatus"),email=$("email").value.trim(),password=$("password").value;
 status.textContent="";
 if(!email||!email.includes("@")){status.textContent="Enter a valid email address.";return}
 if(!password||password.length<8){status.textContent="Password must be at least 8 characters.";return}
 button.disabled=true;button.textContent=action==="signup"?"Creating account…":"Signing in…";
 try{
  if(action==="signup"){
   const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
   if(error)throw error;
   if(data.session){status.textContent="Account created successfully. Opening your website dashboard…";await load()}
   else if(data.user?.identities?.length===0){status.textContent="This email already has an account. Please use Sign In instead."}
   else{status.textContent="Account created. Check your email inbox (and spam folder) and confirm your email, then return here and sign in."}
  }else{
   const {error}=await db.auth.signInWithPassword({email,password});
   if(error)throw error;
   status.textContent="Signed in. Loading your dashboard…";await load();
  }
 }catch(error){status.textContent=error?.message||"Authentication failed. Please try again."}
 finally{button.disabled=false;button.textContent=action==="signup"?"Create Account":"Sign In"}
}
$("signIn").type="button";$("signUp").type="button";
$("signIn").onclick=()=>authAction("signIn","signin");
$("signUp").onclick=()=>authAction("signUp","signup");
$("siteSelect").onchange=()=>{const s=sites.find(x=>x.id===$("siteSelect").value);fillEditor(s||null)};
$("newSite").onclick=()=>{if(sites.length>=(premiumActive?2:1)){$("saveStatus").textContent=premiumActive?"You already have the 2 websites included in Premium.":"Free plan allows one website. Upgrade to Premium to create a second.";return}$("siteSelect").value="";fillEditor(null);$("saveStatus").textContent="New website: enter its name and a unique address, then save."};
$("addGame").onclick=()=>add("game");$("addSocial").onclick=()=>add("social");$("addGiftCode").onclick=()=>add("gift");$("addAnnouncement").onclick=()=>add("announcement");$("addCustomPage").onclick=()=>{if(!premiumActive){$("saveStatus").textContent="Custom pages require active Premium.";return}add("page")};
$("save").onclick=async()=>{if(!user){$("saveStatus").textContent="Please sign in first.";return;} $("save").disabled=true;$("save").textContent="Saving…";try{const slug=$("slug").value.trim().toLowerCase(),name=$("siteName").value.trim();if(!site&&$("websiteTier").value==="premium"&&!premiumActive){$("saveStatus").textContent="Premium Website requires an active Premium subscription. Upgrade first.";return}if(!site&&!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)){$("saveStatus").textContent="Use 3–40 lowercase letters, numbers or hyphens for the address.";return}if(name.length<2){$("saveStatus").textContent="Enter a website name.";return}
const games=getRows("games"),socials=getRows("socials"),gift_codes=getRows("giftCodes"),announcements=getRows("announcements"),custom_pages=getRows("customPages");
if(custom_pages.length&&!premiumActive){$("saveStatus").textContent="Custom pages require active Premium.";return}
if(custom_pages.some(p=>!p.title||!/^[a-z0-9][a-z0-9-]{1,39}$/i.test(p.slug)||!p.body)||games.some(x=>!x.name||!validUrl(x.url))||socials.some(x=>!x.label||!validUrl(x.url))||[$("logoUrl").value.trim(),$("bannerUrl").value.trim()].some(v=>v&&!validUrl(v))){$("saveStatus").textContent="Check page title/ID/content and ensure every game/social link has a valid http/https URL.";return}
const payload={owner_id:user.id,website_tier:site?.website_tier||$("websiteTier").value,slug,site_name:name,description:$("description").value.trim(),content:{games,socials,gift_codes,announcements,custom_pages,theme:"frost",hero_title:$("heroTitle").value.trim(),hero_text:$("heroText").value.trim(),logo_url:$("logoUrl").value.trim(),banner_url:$("bannerUrl").value.trim(),about_text:$("aboutText").value.trim()},published:$("published").checked,updated_at:new Date().toISOString()};
const q=site?db.from("builder_sites").update(payload).eq("id",site.id).eq("owner_id",user.id).select().single():db.from("builder_sites").insert(payload).select().single();const {data,error}=await q;if(error){$("saveStatus").textContent="Save failed: "+error.message;return}site=data;$("slug").disabled=true;$("saveStatus").textContent="Saved. "+(site.published?"Website is public.":"Website is private until published.");await refreshSites(site.id);try{localStorage.removeItem(draftKey())}catch{}$("draftStatus").textContent="Website saved to your account.";}catch(e){$("saveStatus").textContent="Save failed: "+(e?.message||"Unknown error")+". Your local draft is kept.";}finally{$("save").disabled=false;$("save").textContent="Save Website";}};
$("preview").onclick=()=>{const slug=site?.slug||$("slug").value.trim();if(!slug){$("saveStatus").textContent="Save your website first.";return}window.open("site.html?site="+encodeURIComponent(slug),"_blank","noopener")};
$("share").onclick=async()=>{if(!site?.slug){$("saveStatus").textContent="Save your website first.";return}if(!site.published){$("saveStatus").textContent="Publish your website first, then share its public link.";return}const url=new URL("site.html?site="+encodeURIComponent(site.slug),location.href).href;try{if(navigator.share)await navigator.share({title:site.site_name||"My Gaming Website",text:site.description||"Visit my gaming website",url});else{await navigator.clipboard.writeText(url);$("saveStatus").textContent="Website link copied: "+url}}catch(e){if(e.name!=="AbortError")$("saveStatus").textContent="Copy this link: "+url}};
$("logout").onclick=async()=>{await db.auth.signOut();user=null;site=null;location.reload()};load();
async function askPremiumAI(){
 if(!user||!site||site.website_tier!=="premium"||!premiumActive){$("premiumAiStatus").textContent="Premium AI requires an active Premium Website.";return}
 const prompt=$("premiumAiInput").value.trim();if(!prompt)return;
 $("premiumAiInput").value="";aiMessages.push({role:"user",content:prompt});$("premiumAiChat").textContent=aiMessages.map(m=>(m.role==="user"?"You: ":"Premium AI: ")+m.content).join("\n\n");$("premiumAiStatus").textContent="Thinking…";$("premiumAiSend").disabled=true;
 try{const {data:{session}}=await db.auth.getSession();const res=await fetch(SB_URL+"/functions/v1/customer-ai",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:SB_KEY,"Content-Type":"application/json"},body:JSON.stringify({action:"chat",site_id:site.id,messages:aiMessages})});const data=await res.json();if(!res.ok)throw new Error(data.error||"AI request failed.");aiMessages.push({role:"assistant",content:data.reply});$("premiumAiChat").textContent=aiMessages.map(m=>(m.role==="user"?"You: ":"Premium AI: ")+m.content).join("\n\n");$("premiumAiStatus").textContent="Ready. Suggestions have not been saved."; }catch(e){$("premiumAiStatus").textContent=e.message||"Could not reach Premium AI."}finally{$("premiumAiSend").disabled=false}
}
$("premiumAiSend").onclick=askPremiumAI;
$("premiumAiInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();askPremiumAI()}});
