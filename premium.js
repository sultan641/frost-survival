const db=window.supabase.createClient("https://xnixsavppmmvbzfnybus.supabase.co","sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT");
const form=document.getElementById("paymentForm"),status=document.getElementById("paymentStatus");
form.addEventListener("submit",async e=>{e.preventDefault();status.textContent="Checking your account…";const {data:{session},error:authError}=await db.auth.getSession();if(authError||!session){status.textContent="Please sign in to your Website Builder first, then return here to submit your payment reference.";return}
const payload={owner_id:session.user.id,plan:"premium",billing_cycle:document.getElementById("cycle").value,payment_method:document.getElementById("method").value,amount:document.getElementById("amount").value.trim()||null,transaction_reference:document.getElementById("reference").value.trim(),status:"pending"};
const {error}=await db.from("builder_payment_requests").insert(payload);status.textContent=error?"Could not submit: "+error.message:"Payment request submitted. Premium remains locked until the Frost Survival owner verifies and approves it.";
});
