/* Privacy-friendly Frost Survival analytics. No cookies, visitor IDs, or personal data. */
(() => {
  const cfg = window.supabase;
  if (!cfg?.createClient) return;
  const client = cfg.createClient(
    "https://xnixsavppmmvbzfnybus.supabase.co",
    "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT"
  );
  const currentUrl = new URL(window.location.href);
  const path = (currentUrl.pathname || "/").slice(0, 180);
  const referrer = (() => {
    try { return document.referrer ? new URL(document.referrer).hostname.slice(0,120) : null; }
    catch (_) { return null; }
  })();
  const campaign = {
    campaign_source: (currentUrl.searchParams.get("utm_source") || "").slice(0,80) || null,
    campaign_medium: (currentUrl.searchParams.get("utm_medium") || "").slice(0,80) || null,
    campaign_name: (currentUrl.searchParams.get("utm_campaign") || "").slice(0,100) || null
  };
  const ua = navigator.userAgent || "";
  const device = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";
  let sentView = false;

  function record(eventType, targetHost = null) {
    const row = {
      site_key: "frost-survival",
      event_type: eventType,
      page_path: path,
      referrer_host: referrer,
      device_type: device,
      ...campaign,
      target_host: targetHost ? String(targetHost).slice(0,120) : null
    };
    client.from("site_analytics").insert(row).then(({error}) => {
      if (error) console.debug("Frost analytics event skipped:", error.message);
    }).catch(() => {});
  }

  function view() {
    if (sentView) return;
    sentView = true;
    record("page_view");
  }
  view();

  document.addEventListener("click", event => {
    const anchor = event.target.closest?.("a");
    if (anchor) {
      let destination;
      try { destination = new URL(anchor.href, window.location.href); } catch (_) { return; }
      const host = destination.hostname.toLowerCase();
      const href = destination.href.toLowerCase();
      const internalPath = destination.pathname.toLowerCase();
      if (destination.origin === window.location.origin) {
        if (/wos-v4|v5-europe|v5-china|kingshot-v4/.test(internalPath)) record("game_click", host);
        else if (/tools\.html/.test(internalPath)) record("tool_use", host);
        return;
      }
      if (host.includes("discord.gg") || host.includes("discord.com")) record("discord_click", host);
      else if (host.includes("youtube.com") || host.includes("youtu.be")) record("youtube_click", host);
      else if (/wos-v4|v5-europe|v5-china|kingshot-v4|landing\.|passport\.|europeeu1/.test(href)) record("game_click", host);
      else if (path.includes("promotion") || /top\.gg|reddit\.com|bing\.com|google\.com|advertis|promotion/i.test(href)) record("promotion_click", host);
      else record("external_click", host);
      return;
    }

    const button = event.target.closest?.("button");
    if (!button) return;
    const label = (button.textContent || "").trim().toLowerCase();
    if (button.id === "nativeShare") return;
    if (button.hasAttribute("data-share") || /share|invite friends/i.test(label)) {
      record("share_click");
      return;
    }
    if (/copy/i.test(label) && /gift\s*code|redeem|code:/i.test((button.parentElement?.textContent || "").slice(0,500))) {
      record("gift_code_copy");
    }
  }, {passive:true});
})();