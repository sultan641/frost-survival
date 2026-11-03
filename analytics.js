/* Privacy-friendly Frost Survival traffic metrics. No cookies, IDs, or personal data. */
(() => {
  const cfg = window.supabase;
  if (!cfg?.createClient) return;
  const url = "https://xnixsavppmmvbzfnybus.supabase.co";
  const key = "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";
  const client = cfg.createClient(url, key);
  const path = (location.pathname || "/").slice(0, 180);
  const referrer = (() => { try { return document.referrer ? new URL(document.referrer).hostname.slice(0,120) : null; } catch (_) { return null; } })();
  const ua = navigator.userAgent || "";
  const device = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";
  let sentView = false;
  async function record(eventType, pagePath = path) {
    try { await client.from("site_analytics").insert({site_key:"frost-survival",event_type:eventType,page_path:String(pagePath).slice(0,180),referrer_host:referrer,device_type:device}); } catch (_) {}
  }
  function view() { if (!sentView) { sentView = true; record("page_view"); } }
  view();
  document.addEventListener("click", e => {
    const a = e.target.closest("a");
    if (!a) return;
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href.includes("discord.gg") || href.includes("discord.com/invite")) record("discord_click");
    else if (href.includes("youtube.com")) record("youtube_click");
    else if (/wos-v4|v5-europe|v5-china|kingshot-v4|landing\.|passport\.|europeeu1/.test(href)) record("game_click");
    else if (/tools\.html/.test(href)) record("tool_use");
  }, {passive:true});
  document.addEventListener("click", e => {
    const el = e.target.closest("button");
    if (el && /copy/i.test(el.textContent || "")) record("gift_code_copy");
  }, {passive:true});
})();