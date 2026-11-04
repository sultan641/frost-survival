const db=window.supabase.createClient("https://xnixsavppmmvbzfnybus.supabase.co","sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT");
const form=document.getElementById("paymentForm");
const status=document.getElementById("paymentStatus");
const cycle=document.getElementById("cycle");
const reference=document.getElementById("reference");
const cryptoAmount=document.getElementById("cryptoAmount");
const submit=form.querySelector('button[type="submit"]');

function updateAmount(){
  const monthly=cycle.value==="monthly";
  cryptoAmount.innerHTML="<strong>Send exactly "+(monthly?"5.00":"49.99")+" USDT ("+(monthly?"monthly":"yearly")+")</strong>";
}
cycle.addEventListener("change",updateAmount);
updateAmount();

document.getElementById("copyWallet").addEventListener("click",async()=>{
  const address="TDfP8MvuGd2G5KDQsB5zk2rKFTfQTw7gXN";
  try{
    await navigator.clipboard.writeText(address);
    document.getElementById("copyWallet").textContent="Address copied";
  }catch{
    document.getElementById("copyWallet").textContent="Select and copy the address above";
  }
});

form.addEventListener("submit",async event=>{
  event.preventDefault();
  const txHash=reference.value.trim();
  if(!/^[a-fA-F0-9]{64}$/.test(txHash)){
    status.textContent="Enter the full 64-character TRON transaction hash.";
    return;
  }
  const {data:{session},error:authError}=await db.auth.getSession();
  if(authError||!session){
    status.textContent="Please sign in to your Website Builder account first.";
    return;
  }
  submit.disabled=true;
  submit.textContent="Verifying on TRON…";
  status.textContent="Checking blockchain confirmation, USDT contract, receiving address and exact amount…";
  try{
    const {data,error}=await db.functions.invoke("verify-binance-premium",{
      body:{txHash,billingCycle:cycle.value}
    });
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error||"Payment verification failed.");
    status.textContent="✓ "+data.message+(data.subscription?.current_period_end?" Premium active until "+new Date(data.subscription.current_period_end).toLocaleString():"");
    form.reset();
    cycle.value="monthly";
    updateAmount();
  }catch(error){
    let message=error?.context?.error||error?.message||"Could not verify this transaction.";
    try{if(error?.context?.json)message=(await error.context.json()).error||message;}catch{}
    status.textContent=message;
  }finally{
    submit.disabled=false;
    submit.textContent="Verify Payment & Activate Premium";
  }
});