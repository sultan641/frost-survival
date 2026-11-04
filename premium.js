const db=window.supabase.createClient("https://xnixsavppmmvbzfnybus.supabase.co","sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT");
const form=document.getElementById("paymentForm"),status=document.getElementById("paymentStatus");
const method=document.getElementById("method"),cycle=document.getElementById("cycle");
const binanceDetails=document.getElementById("binanceDetails"),localDetails=document.getElementById("localDetails");
const amount=document.getElementById("amount"),cryptoAmount=document.getElementById("cryptoAmount");
function updatePaymentDetails(){
 const crypto=method.value==="binance_usdt";
 binanceDetails.hidden=!crypto;localDetails.hidden=crypto;
 const monthly=cycle.value==="monthly";
 const usd=monthly?"5.00":"49.99";
 const pkr=monthly?"1399":"13999";
 cryptoAmount.innerHTML="<strong>Amount: "+usd+" USDT "+(monthly?"monthly":"yearly")+"</strong>";
 amount.value=crypto?usd+" USDT": "Rs. "+pkr;
 amount.placeholder=crypto?usd+" USDT":"Rs. "+pkr;
}
method.addEventListener("change",updatePaymentDetails);cycle.addEventListener("change",updatePaymentDetails);
document.getElementById("copyWallet").addEventListener("click",async()=>{
 const address="TDfP8MvuGd2G5KDQsB5zk2rKFTfQTw7gXN";
 try{await navigator.clipboard.writeText(address);document.getElementById("copyWallet").textContent="Address copied";}
 catch{document.getElementById("copyWallet").textContent="Copy not available — select the address above";}
});
updatePaymentDetails();
form.addEventListener("submit",async e=>{e.preventDefault();status.textContent="Checking your account…";const {data:{session},error:authError}=await db.auth.getSession();if(authError||!session){status.textContent="Please sign in to your Website Builder first, then return here to submit your payment reference.";return}
const payload={owner_id:session.user.id,plan:"premium",billing_cycle:cycle.value,payment_method:method.value,amount:amount.value.trim(),transaction_reference:document.getElementById("reference").value.trim(),status:"pending"};
const {error}=await db.from("builder_payment_requests").insert(payload);status.textContent=error?"Could not submit: "+error.message:"Payment request submitted. Premium remains locked until the Frost Survival owner verifies and approves it.";
});