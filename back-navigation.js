(() => {
  if (window.__frostBackButtonLoaded) return;
  window.__frostBackButtonLoaded = true;
  const style = document.createElement("style");
  style.textContent = "#frost-global-back{position:fixed;left:14px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:99999;display:flex;align-items:center;gap:8px;padding:11px 16px;border:1px solid #39bfe9;border-radius:999px;background:linear-gradient(120deg,#087eae,#253b83);color:#fff;font:800 14px system-ui,sans-serif;text-decoration:none;box-shadow:0 5px 22px #0008;cursor:pointer}#frost-global-back:active{transform:scale(.97)}@media(min-width:800px){#frost-global-back{left:24px;bottom:24px}}";
  document.head.appendChild(style);
  const button = document.createElement("button");
  button.id = "frost-global-back";
  button.type = "button";
  button.textContent = "← Back";
  button.setAttribute("aria-label","Go to previous page");
  button.addEventListener("click", () => {
    let previous = "";
    try { previous = document.referrer ? new URL(document.referrer).href : ""; } catch (_) {}
    if (previous && new URL(previous).origin === location.origin && previous !== location.href) {
      history.back();
      return;
    }
    const path = location.pathname.toLowerCase();
    location.href = /discord-control|youtube-studio|growth-center|admin/.test(path) ? "admin.html" : "index.html";
  });
  document.body.appendChild(button);
})();