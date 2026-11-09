// FROST SURVIVAL ADMIN
// Supabase configuration

const SUPABASE_URL = "https://xnixsavppmmvbzfnybus.supabase.co";
const SUPABASE_KEY = "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";
const ADMIN_UID = "9cd04a06-6937-474a-9b13-ea39b2c3bd35";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const games = [
  "Whiteout Survival V4",
  "Whiteout Survival V5 Europe",
  "Whiteout Survival V5 China",
  "KingShot V4"
];

let selectedGame = "";
let giftCodes = [];
let announcements = [];

const $ = id => document.getElementById(id);

function status(message) {
  $("adminStatus").textContent = message;
}

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// AUTHENTICATION

async function refreshAuth() {
  const { data, error } = await db.auth.getSession();
  if (error) {
    status("Session check failed: " + error.message);
    return;
  }

  const session = data?.session;
  if (!session) {
    $("loginBox").hidden = false;
    $("adminBox").hidden = true;
    status("No active session. Please sign in.");
    return;
  }

  if (session.user.id !== ADMIN_UID) {
    $("loginBox").hidden = false;
    $("adminBox").hidden = true;
    status("Access denied. Signed-in account is not the configured administrator.");
    await db.auth.signOut();
    return;
  }

  $("loginBox").hidden = true;
  $("adminBox").hidden = false;
  status("Admin login successful.");
  showDashboard();
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const email = $("email").value.trim();
  const password = $("password").value;
  if (button) button.disabled = true;
  status("Signing in...");

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      status("Login failed: " + error.message);
      return;
    }
    if (!data?.session || !data?.user) {
      status("Sign-in returned no session. Check Supabase Auth settings.");
      return;
    }
    if (data.user.id !== ADMIN_UID) {
      status("Access denied. This email belongs to a different Supabase user ID.");
      await db.auth.signOut();
      return;
    }
    $("loginBox").hidden = true;
    $("adminBox").hidden = false;
    $("email").value = "";
    $("password").value = "";
    status("Admin login successful.");
    showDashboard();
  } catch (error) {
    console.error("Admin sign-in error:", error);
    status("Login error: " + (error?.message || String(error)));
  } finally {
    if (button) button.disabled = false;
  }
});

async function signOut() {
  status("Signing out...");
  const { error } = await db.auth.signOut();

  if (error) {
    status("Sign-out failed: " + error.message);
    return;
  }

  $("loginBox").hidden = false;
  $("adminBox").hidden = true;
  $("email").value = "";
  $("password").value = "";
  status("Signed out. Please sign in again.");
}

$("signOutButton").addEventListener("click", () => {
  signOut().catch(error => {
    console.error("Admin sign-out error:", error);
    status("Sign-out error: " + (error?.message || String(error)));
  });
});

// MAIN DASHBOARD

function showDashboard() {
  selectedGame = "";

  $("adminContent").innerHTML = `
    <h2>Game Management</h2>
    <p>Select a game to manage its information.</p>

    <div class="admin-game-grid">
      ${games.map((game, index) => `
        <button class="admin-game-card"
          onclick="openGame(${index})">
          <strong>${safe(game)}</strong>
          <span>Manage Game →</span>
        </button>
      `).join("")}
    </div>

    <hr>

    <h2>Global Management</h2>

    <div class="actions">
      <button onclick="showTab('apps')">Applications</button>
      <button onclick="showTab('bugs')">Bug Reports</button>
      <button onclick="showTab('developer')">🔒 Developer Dashboard</button>
      <button onclick="showTab('ai')">🤖 Developer AI</button>
      <button onclick="showTab('agents')">🔐 Agent Livestreaming</button>
    </div>
  `;

  addAdminStyles();
  try {
    if (sessionStorage.getItem("frost-open-analytics") === "1") {
      sessionStorage.removeItem("frost-open-analytics");
      setTimeout(() => showTab("analytics"), 0);
    }
  } catch (_) {}
}

function addAdminStyles() {
  if ($("adminExtraStyles")) return;

  const style = document.createElement("style");
  style.id = "adminExtraStyles";

  style.textContent = `
    .admin-game-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
      gap:14px;
      margin:20px 0;
    }
    .admin-game-card {
      padding:22px;
      text-align:left;
      min-height:110px;
      border:1px solid #526477;
      border-radius:12px;
      background:#182534;
      color:white;
      cursor:pointer;
    }
    .admin-game-card strong,
    .admin-game-card span {
      display:block;
      margin-bottom:10px;
    }
    .admin-section {
      margin:18px 0;
      padding:15px;
      border:1px solid #526477;
      border-radius:10px;
    }
    .admin-section input,
    .admin-section textarea,
    .admin-section select {
      width:100%;
      margin:7px 0 14px;
      box-sizing:border-box;
    }
    .agent-link-row { display:flex; gap:8px; align-items:center; }\n    .agent-link-row input { min-width:0; flex:1; }\n    .admin-record {
      padding:14px;
      margin:12px 0;
      border:1px solid #526477;
      border-radius:10px;
      overflow-wrap:anywhere;
    }
  `;

  document.head.appendChild(style);
}

// GAME DASHBOARD

async function openGame(index) {
  selectedGame = games[index];

  $("adminContent").innerHTML = `
    <button class="secondary" onclick="showDashboard()">
      ← All Games
    </button>

    <h2>${safe(selectedGame)}</h2>

    <div class="actions">
      <button onclick="showGameSection('settings')">Game Settings</button>
      <button onclick="showGameSection('codes')">Gift Codes</button>
      <button onclick="showGameSection('announcements')">News &amp; Announcements</button>
    </div>

    <div id="gameSection"></div>
  `;

  await showGameSection("settings");
}

async function showGameSection(section) {
  if (!selectedGame) return;

  if (section === "settings") {
    await loadGameSettings();
  } else if (section === "codes") {
    await loadGameCodes();
  } else if (section === "announcements") {
    await loadGameAnnouncements();
  }
}

// GAME SETTINGS

async function loadGameSettings() {
  const area = $("gameSection");
  area.innerHTML = "Loading game settings...";

  const { data, error } = await db
    .from("game_settings")
    .select("*")
    .eq("game_name", selectedGame)
    .maybeSingle();

  if (error) {
    area.textContent = "Could not load settings: " + error.message;
    return;
  }

  const record = data || {};

  area.innerHTML = `
    <div class="admin-section">
      <h3>Game Information</h3>

      <form id="settingsForm">

        <label>Description</label>
        <textarea name="description" rows="4">${safe(record.description)}</textarea>

        <label class="share-lock-control">
          <input type="checkbox" name="share_enabled" ${record.share_enabled === true ? "checked" : ""}>
          Enable Share Button on this game page
        </label>
        <p class="hint">When enabled, visitors can share this exact game-version page.</p>

        <label class="share-lock-control">
          <input type="checkbox" name="share_lock" ${record.share_lock === true ? "checked" : ""}>
          Enable Share Lock for this game page
        </label>
        <p class="hint">When enabled, only the special link generated by Share This Page opens in focused mode. Normal visits to this page remain unlocked.</p>

        <label>Download URL</label>
        <input name="download_url" value="${safe(record.download_url)}">

        <label>Registration URL</label>
        <input name="registration_url" value="${safe(record.registration_url)}">

        <label>APK URL</label>
        <input name="apk_url" value="${safe(record.apk_url)}">

        <label>iOS URL</label>
        <input name="ios_url" value="${safe(record.ios_url)}">

        <label>Promoter Code</label>
        <input name="promoter_code" value="${safe(record.promoter_code)}">

        <label>Promoter Label</label>
        <input name="promoter_label" value="${safe(record.promoter_label)}">

        <label>Version Information</label>
        <textarea name="version_info" rows="4">${safe(record.version_info)}</textarea>

        <label>Installation Guide (JSON)</label>
        <textarea name="installation_guide" rows="5">${safe(JSON.stringify(record.installation_guide || [], null, 2))}</textarea>

        <label>Extra Links (JSON)</label>
        <textarea name="extra_links" rows="5">${safe(JSON.stringify(record.extra_links || [], null, 2))}</textarea>

        <button type="submit">Save Game Settings</button>
      </form>
    </div>
  `;

  $("settingsForm").onsubmit = saveGameSettings;
}

async function saveGameSettings(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  let installationGuide;
  let extraLinks;

  try {
    installationGuide = JSON.parse(form.get("installation_guide") || "[]");
    extraLinks = JSON.parse(form.get("extra_links") || "[]");

    if (!Array.isArray(installationGuide) || !Array.isArray(extraLinks)) {
      throw new Error("Both JSON fields must contain arrays.");
    }
  } catch (error) {
    status("Invalid JSON: " + error.message);
    return;
  }

  const record = {
    game_name: selectedGame,
    description: form.get("description"),
    share_lock: form.get("share_lock") === "on",
    share_enabled: form.get("share_enabled") === "on",
    download_url: form.get("download_url"),
    registration_url: form.get("registration_url"),
    apk_url: form.get("apk_url"),
    ios_url: form.get("ios_url"),
    promoter_code: form.get("promoter_code"),
    promoter_label: form.get("promoter_label"),
    version_info: form.get("version_info"),
    installation_guide: installationGuide,
    extra_links: extraLinks,
    updated_at: new Date().toISOString()
  };

  status("Saving settings...");

  const { error } = await db
    .from("game_settings")
    .upsert(record, { onConflict: "game_name" });

  status(error ? "Save failed: " + error.message : "Game settings saved.");
}

// GIFT CODES

async function loadGameCodes() {
  const area = $("gameSection");
  area.innerHTML = "Loading gift codes...";

  await db.from("gift_codes").update({ active: false })
    .eq("game_name", selectedGame).eq("active", true)
    .lt("expires_at", new Date().toISOString());

  const { data, error } = await db
    .from("gift_codes")
    .select("*")
    .eq("game_name", selectedGame)
    .order("id", { ascending: false });

  if (error) {
    area.textContent = "Error: " + error.message;
    return;
  }

  giftCodes = data || [];

  area.innerHTML = `
    <div class="admin-section">
      <h3>${safe(selectedGame)} Gift Codes</h3>

      <form id="codeForm">
        <label>Gift Code</label>
        <textarea name="code" rows="3" required></textarea>
        <label>Code validity</label>
        <select name="expiry_days" required>
          <option value="1">1 day</option><option value="2">2 days</option>
          <option value="3" selected>3 days</option><option value="7">7 days</option>
          <option value="30">30 days</option><option value="never">Never expires</option>
        </select>
        <label><input type="checkbox" name="active" checked> Active</label>
        <button type="submit">Add Gift Code</button>
        <p class="hint">Countdown starts when added. Expired codes are deactivated and hidden from public pages.</p>
      </form>
    </div>

    <div id="gameCodeList"></div>
  `;

  $("codeForm").onsubmit = addGameCode;

  renderGameCodes();
}

async function addGameCode(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  const record = {
    game_name: selectedGame,
    code: form.get("code").trim(),
    active: form.get("active") === "on",
    expires_at: form.get("expiry_days") === "never"
      ? null
      : new Date(Date.now() + Number(form.get("expiry_days")) * 86400000).toISOString()
  };

  if (!record.code) return status("Enter a gift code.");

  const { error } = await db.from("gift_codes").insert(record);

  if (error) {
    status("Could not add code: " + error.message);
    return;
  }

  status("Gift code added.");
  await loadGameCodes();
}

function adminCodeCountdown(expiresAt) {
  if (!expiresAt) return "Never expires";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const days = Math.ceil(ms / 86400000);
  return days === 1 ? "1 day left" : days + " days left";
}

function renderGameCodes() {
  $("gameCodeList").innerHTML = giftCodes.length
    ? giftCodes.map(code => {
      const expired = code.expires_at && new Date(code.expires_at).getTime() <= Date.now();
      const state = expired ? "Expired" : (!code.active ? "Inactive" : "Active");
      return `
      <div class="admin-record">
        <strong>${safe(code.code)}</strong>
        <p>${state}${code.expires_at ? " • " + adminCodeCountdown(code.expires_at) : ""}</p>
        <p>${code.expires_at ? "Expires: " + safe(new Date(code.expires_at).toLocaleString()) : "No expiry"}</p>
        <button onclick="toggleGameCode(${code.id}, ${!code.active})" ${expired ? "disabled" : ""}>${code.active ? "Deactivate" : "Activate"}</button>
        <button class="danger" onclick="deleteGameCode(${code.id})">Delete</button>
      </div>`;
    }).join("")
    : "<p>No gift codes for this game.</p>";
  if (window.adminGiftCodeTimer) clearInterval(window.adminGiftCodeTimer);
  window.adminGiftCodeTimer = setInterval(() => {
    document.querySelectorAll("#gameCodeList .admin-record").forEach((card, i) => {
      const code = giftCodes[i];
      if (!code) return;
      const expired = code.expires_at && new Date(code.expires_at).getTime() <= Date.now();
      const p = card.querySelector("p");
      if (p) p.textContent = (expired ? "Expired" : (!code.active ? "Inactive" : "Active")) +
        (code.expires_at ? " • " + adminCodeCountdown(code.expires_at) : "");
    });
  }, 60000);
}

async function toggleGameCode(id, active) {
  const { error } = await db
    .from("gift_codes")
    .update({ active })
    .eq("id", id);

  if (error) return status(error.message);

  status("Gift code status updated.");
  await loadGameCodes();
}

async function deleteGameCode(id) {
  if (!confirm("Delete this gift code permanently?")) return;

  const { error } = await db
    .from("gift_codes")
    .delete()
    .eq("id", id);

  if (error) return status(error.message);

  status("Gift code deleted.");
  await loadGameCodes();
}

// ANNOUNCEMENTS

async function loadGameAnnouncements() {
  const area = $("gameSection");
  area.innerHTML = "Loading announcements...";

  const { data, error } = await db
    .from("announcements")
    .select("*")
    .eq("game_name", selectedGame)
    .order("id", { ascending: false });

  if (error) {
    area.textContent = "Error: " + error.message;
    return;
  }

  announcements = data || [];

  area.innerHTML = `
    <div class="admin-section">
      <h3>Publish Announcement</h3>

      <form id="announcementForm">
        <label>Title</label>
        <input name="title" required>

        <label>Message</label>
        <textarea name="message" rows="5" required></textarea>

        <button type="submit">Publish</button>
      </form>
    </div>

    <div id="announcementList"></div>
  `;

  $("announcementForm").onsubmit = addAnnouncement;

  $("announcementList").innerHTML = announcements.length
    ? announcements.map(item => `
      <div class="admin-record">
        <h3>${safe(item.title)}</h3>
        <p>${safe(item.message)}</p>
        <button class="danger" onclick="deleteAnnouncement(${item.id})">
          Delete
        </button>
      </div>
    `).join("")
    : "<p>No announcements for this game.</p>";
}

async function addAnnouncement(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  const { error } = await db.from("announcements").insert({
    game_name: selectedGame,
    title: form.get("title"),
    message: form.get("message")
  });

  if (error) {
    status("Publish failed: " + error.message);
    return;
  }

  status("Announcement published.");
  await loadGameAnnouncements();
}

async function deleteAnnouncement(id) {
  if (!confirm("Delete this announcement?")) return;

  const { error } = await db
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) return status(error.message);

  status("Announcement deleted.");
  await loadGameAnnouncements();
}

// GLOBAL APPLICATIONS AND BUG REPORTS

async function loadTrafficAnalytics(days = 7) {
  const area = $("globalRecords");
  if (!area) return;
  area.innerHTML = '<p class="muted">Loading traffic report…</p>';
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await db.from("site_analytics")
    .select("event_type,page_path,device_type,created_at,referrer_host,campaign_source,campaign_medium,campaign_name,target_host")
    .eq("site_key", "frost-survival").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(5000);
  if (error) { area.textContent = "Analytics error: " + error.message; return; }
  const rows = data || [], count = type => rows.filter(r => r.event_type === type).length;
  const views = rows.filter(r => r.event_type === "page_view");
  const group = (items, getKey) => {
    const map = {};
    items.forEach(r => { const k = getKey(r) || "Unknown"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,10);
  };
  const sources = group(views, r => r.campaign_source
    ? [r.campaign_source,r.campaign_medium,r.campaign_name].filter(Boolean).join(" / ")
    : (r.referrer_host && r.referrer_host !== "sultan641.github.io" ? r.referrer_host : "Direct / untagged"));
  const pages = group(views, r => r.page_path || "/");
  const devices = group(views, r => r.device_type || "Unknown");
  const targets = group(rows.filter(r => r.target_host && ["promotion_click","external_click","discord_click","youtube_click","game_click"].includes(r.event_type)), r => r.target_host);
  const metrics = [
    ["Page views",count("page_view")],["Game clicks",count("game_click")],
    ["Discord clicks",count("discord_click")],["YouTube clicks",count("youtube_click")],
    ["Promotion clicks",count("promotion_click")],["External clicks",count("external_click")],
    ["Shares",count("share_click")],["Gift-code copies",count("gift_code_copy")]
  ];
  const list = (items,label) => items.length
    ? '<div class="traffic-list">'+items.map(([name,total])=>'<div class="traffic-row"><span>'+safe(name)+'</span><strong>'+total+' '+label+'</strong></div>').join("")+'</div>'
    : '<p class="muted">No data recorded yet.</p>';
  area.innerHTML = `
    <style>
      .traffic-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0}
      .traffic-head p{margin:4px 0;color:#9eb5ca}
      .traffic-head select{min-width:150px}
      .traffic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0 24px}
      .traffic-stat{padding:17px;border:1px solid #315b78;border-radius:14px;background:linear-gradient(145deg,#102e4a,#0a1c30);box-shadow:0 8px 22px #0002}
      .traffic-stat strong{display:block;font-size:28px;color:#55d8ff;line-height:1.2}
      .traffic-stat span{display:block;color:#b7cce0;font-size:13px;margin-top:6px}
      .traffic-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
      .traffic-panel{padding:16px;border:1px solid #294e6b;border-radius:13px;background:#0b2036;margin:12px 0}
      .traffic-panel h3{margin:0 0 12px}
      .traffic-list{display:grid;gap:8px}
      .traffic-row{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;background:#102b45;border:1px solid #234b69;border-radius:9px;overflow-wrap:anywhere}
      .traffic-row strong{white-space:nowrap;color:#65dfff}
    </style>
    <div class="traffic-head"><div><h2>Website Performance</h2><p>Real recorded visits and engagement from your website.</p></div>
    <label>Report period <select class="input" id="analyticsRange" onchange="loadTrafficAnalytics(Number(this.value))">
      <option value="7" ${days===7?"selected":""}>Last 7 days</option>
      <option value="30" ${days===30?"selected":""}>Last 30 days</option>
      <option value="90" ${days===90?"selected":""}>Last 90 days</option>
    </select></label></div>
    <div class="traffic-grid">${metrics.map(([label,total])=>'<div class="traffic-stat"><strong>'+total.toLocaleString()+'</strong><span>'+label+'</span></div>').join("")}</div>
    <div class="traffic-columns">
      <section class="traffic-panel"><h3>Traffic sources & campaigns</h3>${list(sources,"views")}</section>
      <section class="traffic-panel"><h3>Most visited pages</h3>${list(pages,"views")}</section>
      <section class="traffic-panel"><h3>External destinations</h3>${list(targets,"clicks")}</section>
      <section class="traffic-panel"><h3>Visitor devices</h3>${list(devices,"views")}</section>
    </div>
    <p class="muted">Privacy-friendly event totals. No personal visitor profiles are collected. Maximum 5,000 events per report.</p>
  `;
}

async function showTab(tab) {
  if (tab === "agents") { await showAgentStreaming(); return; }
  if (tab === "ai") { showDeveloperAI(); return; }
  if (tab === "developer") { await showDeveloperDashboard(); return; }
  if (tab === "analytics") {
    $("adminContent").innerHTML = `
      <button class="secondary" onclick="showDashboard()">← Dashboard</button>
      <h2>Promotion & Traffic Analytics</h2>
      <p>Track website views, traffic sources, campaign links, game clicks and social engagement.</p>
      <div id="globalRecords">Loading analytics…</div>
    `;
    await loadTrafficAnalytics(7);
    return;
  }
  const table = tab === "apps" ? "team_applications" : "bug_reports";
  const title = tab === "apps" ? "Applications" : "Bug Reports";

  $("adminContent").innerHTML = `
    <button class="secondary" onclick="showDashboard()">← Dashboard</button>
    <h2>${title}</h2>
    <div id="globalRecords">Loading...</div>
  `;

  const { data, error } = await db
    .from(table)
    .select("*")
    .order("id", { ascending: false })
    .limit(100);

  const area = $("globalRecords");
  if (error) {
    area.textContent = "Error: " + error.message;
    return;
  }
  if (!data || !data.length) {
    area.textContent = "No records found.";
    return;
  }

  area.innerHTML = "";
  for (const record of data) {
    const card = document.createElement("div");
    card.className = "admin-record";

    if (tab === "apps") {
      card.innerHTML = `
        <h3>${safe(record.name || "Application")}</h3>
        <p><strong>Role:</strong> ${safe(record.role)}</p>
        <p><strong>Discord:</strong> ${safe(record.contact)}</p>
        <p><strong>Channel:</strong> ${safe(record.social_links)}</p>
        <p><strong>Experience:</strong> ${safe(record.experience)}</p>
        <p><strong>Message:</strong><br>${safe(record.message)}</p>
        <small>${safe(record.created_at)}</small>
      `;
    } else {
      card.innerHTML = `
        <h3>${safe(record.game_name)} — #${safe(record.id)}</h3>
        <p><strong>Player:</strong> ${safe(record.player_name)}</p>
        <p><strong>Issue:</strong><br>${safe(record.issue)}</p>
        <p><strong>Steps:</strong><br>${safe(record.steps_to_reproduce || "Not provided")}</p>
        <p><strong>Status:</strong> ${safe(record.status)}</p>
        <div class="bug-screenshot">Loading screenshot...</div>
        <label>Update status</label>
        <select class="bug-status">
          <option value="new" ${record.status === "new" ? "selected" : ""}>New</option>
          <option value="reviewing" ${record.status === "reviewing" ? "selected" : ""}>Reviewing</option>
          <option value="resolved" ${record.status === "resolved" ? "selected" : ""}>Resolved</option>
        </select>
        <button type="button" class="save-bug-status">Save Status</button>
        <small>${safe(record.created_at)}</small>
      `;
      const screenshotArea = card.querySelector(".bug-screenshot");
      if (record.screenshot_path) {
        const { data: signed, error: signedError } = await db.storage
          .from("bug-screenshots")
          .createSignedUrl(record.screenshot_path, 300);
        if (signedError) {
          screenshotArea.textContent = "Screenshot unavailable: " + signedError.message;
        } else {
          screenshotArea.innerHTML = `<a href="${safe(signed.signedUrl)}" target="_blank" rel="noopener">Open private screenshot</a>`;
        }
      } else {
        screenshotArea.textContent = "No screenshot attached.";
      }
      card.querySelector(".save-bug-status").addEventListener("click", async () => {
        const nextStatus = card.querySelector(".bug-status").value;
        const { error: updateError } = await db.from("bug_reports")
          .update({ status: nextStatus }).eq("id", record.id);
        status(updateError ? "Status update failed: " + updateError.message : "Bug report status updated.");
        if (!updateError) await showTab("bugs");
      });
    }
    area.appendChild(card);
  }
}

async function callAgentVault(action, payload = {}) {
  const { data: s } = await db.auth.getSession();
  if (!s?.session?.access_token) throw new Error("Please sign in again.");
  const { data, error } = await db.functions.invoke("agent-streaming-vault", { body: { action, ...payload }, headers: { Authorization: "Bearer " + s.session.access_token } });
  if (error || data?.error) throw new Error(data?.error || error.message);
  return data;
}
async function showAgentStreaming() {
  $("adminContent").innerHTML = '<button class="secondary" onclick="showDashboard()">← Admin Dashboard</button><h2>🔐 Private Agent Access</h2><p>Owner-only vault. These links and credentials are never shown on public game pages.</p><div id="agentVaultStatus">Loading secure records…</div><div id="agentVaultCards"></div>';
  const panels = [
    {game:"Whiteout Survival V4",url:"https://daili.cqwzcj.com/index",id:"wosv4"},
    {game:"Whiteout Survival V5 China",url:"https://admin.wjdr2.top/ops-panel.html",id:"wosv5cn"},
    {game:"KingShot V4",url:"https://dlcms.bbwgtg.xyz/login",id:"ksv4"}
  ];
  const live = [
    {game:"Livestreaming Account — Whiteout Survival V4",label:"Whiteout Survival V4",url:"https://live-landing.hzcomg.com/",id:"livewosv4"},
    {game:"Livestreaming Account — KingShot V4",label:"KingShot V4",url:"",id:"liveksv4"}
  ];
  try {
    const result = await callAgentVault("list");
    const records = result.accounts || [];
    const card = (item, title, url, id, kind) => {
      const linkField = '<label>'+ (kind==="panel" ? "Agent panel URL" : "Livestreaming account download / invite link") +'</label><input class="input" id="'+id+'Url" value="'+safe(url||item.url||'')+'" '+(kind==="panel"?'readonly':'')+' placeholder="'+(kind==="live"?'Add private download or invite link':'')+'">';
      return '<section class="admin-section"><h3>'+safe(title)+'</h3>'+linkField+
        '<label>Username</label><input class="input" id="'+id+'User" value="'+safe(item.username||'')+'" maxlength="300" autocomplete="off">'+
        '<label>Password</label><div><input class="input" id="'+id+'Pass" type="password" value="'+safe(item.password||'')+'" maxlength="1000" autocomplete="new-password"><button type="button" data-toggle="'+id+'Pass">Show</button></div>'+
        '<div class="actions"><button type="button" data-save="'+id+'" data-game="'+safe(item.gameKey)+'" data-kind="'+kind+'">🔒 Save</button><button type="button" data-share="'+id+'" data-title="'+safe(title)+'">↗ Share</button></div></section>';
    };
    const panelHtml = panels.map(p => {
      const item = records.find(x=>x.game===p.game)||{};
      return card({...item,gameKey:p.game},p.game,p.url,p.id,"panel");
    }).join("");
    const liveHtml = live.map(p => {
      const item = records.find(x=>x.game===p.game)||{};
      return card({...item,gameKey:p.game},p.label,p.url,p.id,"live");
    }).join("");
    $("agentVaultCards").innerHTML = '<h3>Agent Management Panels</h3>'+panelHtml+'<hr><h3>Agent Livestreaming Accounts</h3>'+liveHtml;
    $("agentVaultStatus").textContent = "Secure owner-only vault connected.";
    $("agentVaultCards").querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleAgentPassword(b.dataset.toggle,b));
    $("agentVaultCards").querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>saveAgentAccount(b.dataset.save,b.dataset.game,b,b.dataset.kind));
    $("agentVaultCards").querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>shareAgentAccount(b.dataset.share,b.dataset.title));
  } catch(e) { $("agentVaultStatus").textContent = "Secure vault unavailable: " + e.message; }
}
function toggleAgentPassword(id,b) { const f=$(id); if(!f) return; f.type=f.type==="password"?"text":"password"; b.textContent=f.type==="password"?"Show":"Hide"; }
async function saveAgentAccount(id,game,b,kind) {
  if(b) b.disabled=true;
  try {
    await callAgentVault("save",{game,url:$(id+"Url").value.trim(),username:$(id+"User").value.trim(),password:$(id+"Pass").value});
    status("Saved securely: "+(kind==="live"?"livestreaming account":"agent panel")+".");
  } catch(e) { status("Save failed: "+e.message); }
  finally { if(b) b.disabled=false; }
}
async function shareAgentAccount(id,game) {
  const url=$(id+"Url")?.value.trim()||"", username=$(id+"User")?.value.trim()||"", password=$(id+"Pass")?.value||"";
  if(!confirm("Share these confidential credentials? Only send them to an authorized agent. Continue?")) return;
  const details=["FROST SURVIVAL — CONFIDENTIAL AGENT ACCESS","Game: "+game,"Download / panel link: "+(url||"(not added yet)"),"Username: "+username,"Password: "+password,"Keep private. Do not forward."].join("\\n");
  try {
    if(navigator.share) { await navigator.share({title:"Confidential agent access — "+game,text:details}); status("Share sheet opened."); }
    else { await navigator.clipboard.writeText(details); status("Confidential details copied. Share privately only."); }
  } catch(e) { if(e?.name!=="AbortError") status("Sharing was cancelled or unavailable."); }
}
// AUTH SESSION
// Avoid calling Supabase auth methods from inside onAuthStateChange.
// Login submits directly to Supabase, then refreshes the dashboard.
refreshAuth().catch(error => {
  console.error("Initial authentication check failed:", error);
  status("Could not check login status: " + (error.message || error));
});


async function callDeveloper(action, payload = {}) {
  const { data: s } = await db.auth.getSession();
  if (!s?.session?.access_token) throw new Error("Please sign in again.");
  const { data, error } = await db.functions.invoke("admin-developer", {
    body: { action, ...payload },
    headers: { Authorization: "Bearer " + s.session.access_token }
  });
  if (error || data?.error) throw new Error(data?.error || error.message);
  return data;
}
async function showDeveloperDashboard() {
  $("adminContent").innerHTML = '<button class="secondary" onclick="showDashboard()">← Admin Dashboard</button><h2>🔒 Private Developer Dashboard</h2><p>Owner-only controls. Customers cannot access these tools.</p><div class="actions"><button onclick="loadDeveloperDashboard()">Refresh</button></div><div id="developerStats">Loading…</div><div class="admin-section"><h3>Activate Free Premium</h3><form id="freePremiumForm"><label>Customer registered email</label><input class="input" type="email" name="email" required placeholder="customer@example.com"><label>Premium period</label><select class="input" name="cycle"><option value="monthly">1 month — $5 value</option><option value="yearly">1 year — $49.99 value</option></select><button type="submit">Activate Free Premium</button></form><p class="hint">No payment is collected. Owner-granted subscription.</p></div><div id="developerCustomers">Loading customers…</div>';
  $("freePremiumForm").onsubmit = activateFreePremium;
  await loadDeveloperDashboard();
}
async function loadDeveloperDashboard() {
  const stats = $("developerStats"), list = $("developerCustomers");
  if (!stats || !list) return;
  stats.textContent = "Loading…"; list.textContent = "Loading customers and websites…";
  try {
    const d = await callDeveloper("list_customers");
    const users = d.customers || [], sites = d.sites || [], subs = d.subscriptions || [];
    stats.innerHTML = '<div class="admin-game-grid"><div class="admin-record"><h3>'+users.length+'</h3><p>Accounts</p></div><div class="admin-record"><h3>'+sites.length+'</h3><p>Websites</p></div><div class="admin-record"><h3>'+subs.filter(x=>x.plan==="premium"&&x.status==="active").length+'</h3><p>Active Premium</p></div></div>';
    list.innerHTML = users.length ? users.map(u => {
      const us = sites.filter(x=>x.owner_id===u.id), sub = subs.find(x=>x.owner_id===u.id);
      let html = '<div class="admin-record"><h3>'+safe(u.email||"No email")+'</h3><p>Account: '+safe(u.id)+'</p><p>Joined: '+safe(u.created_at||"—")+'</p><p>Plan: '+safe(sub?.plan||"free")+' · '+safe(sub?.status||"free")+' · '+safe(sub?.billing_cycle||"—")+'</p><p>Websites: '+us.length+'</p>';
      us.forEach(site => { html += '<div class="admin-section"><strong>'+safe(site.site_name||site.slug)+'</strong><p>Slug: '+safe(site.slug)+' · '+(site.published?"Published":"Draft")+'</p><button onclick="setCustomerSitePublished(\''+site.id+'\','+(!site.published)+')">'+(site.published?"Unpublish":"Publish")+'</button></div>'; });
      html += '<div class="actions"><button onclick="grantCustomerPremium(\''+u.id+'\',\'monthly\')">Grant 1 Month</button><button onclick="grantCustomerPremium(\''+u.id+'\',\'yearly\')">Grant 1 Year</button>';
      if (sub?.status==="active") html += '<button class="secondary" onclick="changeCustomerSubscription(\''+u.id+'\',\'cancelled\')">Cancel Premium</button>';
      return html+'</div></div>';
    }).join("") : "<p>No customer accounts found.</p>";
  } catch(e) { stats.textContent = "Dashboard error: "+e.message; list.textContent = "Could not load customer data."; }
}
async function activateFreePremium(e) {
  e.preventDefault(); const f=new FormData(e.target), b=e.target.querySelector("button[type=submit]");
  b.disabled=true; status("Activating free Premium…");
  try { const d=await callDeveloper("activate_free_premium",{email:String(f.get("email")).trim().toLowerCase(),cycle:f.get("cycle")}); status("Free Premium activated for "+d.email+"."); e.target.reset(); await loadDeveloperDashboard(); }
  catch(x){status("Activation failed: "+x.message);} finally{b.disabled=false;}
}
async function grantCustomerPremium(userId,cycle) {
  if(!confirm("Grant "+cycle+" Premium for free?"))return;
  try{await callDeveloper("grant_free_premium",{userId,cycle});status("Premium granted.");await loadDeveloperDashboard();}catch(e){status(e.message);}
}
async function changeCustomerSubscription(userId,nextStatus) {
  if(!confirm("Cancel this customer's Premium?"))return;
  try{await callDeveloper("set_subscription_status",{userId,nextStatus});status("Subscription updated.");await loadDeveloperDashboard();}catch(e){status(e.message);}
}
async function setCustomerSitePublished(siteId,published) {
  if(!confirm((published?"Publish":"Unpublish")+" this customer website?"))return;
  try{await callDeveloper("set_site_published",{siteId,published});status("Website updated.");await loadDeveloperDashboard();}catch(e){status(e.message);}
}

let developerAIMessages = [];
let developerAIDrafts = [];
let developerAIThreads = [];
let developerAIThreadId = null;
let developerAIImages = [];
let developerAIBusy = false;
const developerAIStorageKey = "frost-developer-ai-threads-v2-9cd04a06";
let developerAISyncTimer=null;
function saveDeveloperAIThreads() {
  const existing = developerAIThreads.find(t=>t.id===developerAIThreadId);
  if (existing) {
    existing.messages=developerAIMessages;
    existing.drafts=developerAIDrafts;
    existing.updated=Date.now();
    existing.title=(developerAIMessages.find(m=>m.role==="user")?.content||"New chat").slice(0,48);
  }
  try { localStorage.setItem(developerAIStorageKey,JSON.stringify(developerAIThreads.slice(0,12))); }
  catch(e) { status("Local chat backup is full. Cloud save will still be attempted."); }
  if(developerAISyncTimer)clearTimeout(developerAISyncTimer);
  developerAISyncTimer=setTimeout(()=>syncDeveloperAIThread().catch(e=>status("Cloud chat sync failed: "+e.message)),700);
}
async function syncDeveloperAIThread() {
  const t=developerAIThreads.find(x=>x.id===developerAIThreadId);
  if(!t)return;
  const {data:s}=await db.auth.getSession();
  if(!s?.session?.user?.id)throw new Error("Please sign in again.");
  const {error}=await db.from("developer_ai_chats").upsert({
    id:t.id,owner_id:s.session.user.id,title:t.title||"New chat",
    messages:t.messages||[],drafts:t.drafts||[],
    updated_at:new Date(t.updated||Date.now()).toISOString()
  },{onConflict:"owner_id,id"});
  if(error)throw error;
}
async function loadDeveloperAICloudThreads() {
  const {data,error}=await db.from("developer_ai_chats").select("id,title,messages,drafts,updated_at").order("updated_at",{ascending:false}).limit(40);
  if(error)throw error;
  const merged=new Map(developerAIThreads.map(t=>[t.id,t]));
  (data||[]).forEach(row=>{
    const local=merged.get(row.id), cloud={id:row.id,title:row.title,updated:new Date(row.updated_at).getTime(),messages:row.messages||[],drafts:row.drafts||[]};
    if(!local||cloud.updated>Number(local.updated||0))merged.set(row.id,cloud);
  });
  developerAIThreads=[...merged.values()].sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,40);
  try{localStorage.setItem(developerAIStorageKey,JSON.stringify(developerAIThreads.slice(0,12)));}catch(_){}
}
function loadDeveloperAIThreads() {
  try {
    const data=JSON.parse(localStorage.getItem(developerAIStorageKey)||"[]");
    developerAIThreads=Array.isArray(data)?data.filter(t=>t&&Array.isArray(t.messages)).slice(0,40):[];
  } catch(e) { developerAIThreads=[]; }
}
function newDeveloperAIChat() {
  if(developerAIBusy)return;
  saveDeveloperAIThreads();
  developerAIThreadId="chat-"+Date.now()+"-"+Math.random().toString(36).slice(2,7);
  developerAIMessages=[];developerAIDrafts=[];developerAIImages=[];
  developerAIThreads.unshift({id:developerAIThreadId,title:"New chat",updated:Date.now(),messages:[],drafts:[]});
  saveDeveloperAIThreads();renderDeveloperAI();
}
function openDeveloperAIChat(id) {
  if(developerAIBusy)return;
  saveDeveloperAIThreads();
  const thread=developerAIThreads.find(t=>t.id===id);
  if(!thread)return;
  developerAIThreadId=id;developerAIMessages=thread.messages||[];developerAIDrafts=thread.drafts||[];developerAIImages=[];
  renderDeveloperAI();
}
function deleteDeveloperAIChat() {
  if(developerAIBusy||!confirm("Delete this saved chat from your devices and cloud history?"))return;
  const deletedId=developerAIThreadId;
  developerAIThreads=developerAIThreads.filter(t=>t.id!==deletedId);
  developerAIThreadId=null;developerAIMessages=[];developerAIDrafts=[];
  try{localStorage.setItem(developerAIStorageKey,JSON.stringify(developerAIThreads.slice(0,12)));}catch(e){}
  db.from("developer_ai_chats").delete().eq("id",deletedId).then(({error})=>{if(error)status("Cloud delete failed: "+error.message);});
  if(developerAIThreads.length)openDeveloperAIChat(developerAIThreads[0].id);else newDeveloperAIChat();
}
function renameDeveloperAIChat() {
  const thread=developerAIThreads.find(t=>t.id===developerAIThreadId);if(!thread)return;
  const title=prompt("Name this conversation:",thread.title||"New chat");
  if(title===null)return;
  thread.title=title.trim().slice(0,80)||"New chat";thread.updated=Date.now();
  saveDeveloperAIThreads();renderDeveloperAI();
}
function exportDeveloperAIChat() {
  const blob=new Blob([JSON.stringify({messages:developerAIMessages,drafts:developerAIDrafts},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="developer-ai-chat.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function callDeveloperAI(action,payload={}) {
  const {data:sessionData}=await db.auth.getSession();
  const token=sessionData?.session?.access_token;
  if(!token)throw new Error("Please sign in again.");
  const {data,error}=await db.functions.invoke("admin-ai",{body:{action,...payload},headers:{Authorization:"Bearer "+token}});
  if(error||data?.error)throw new Error(data?.error||error.message);
  return data;
}
async function showDeveloperAI() {
  loadDeveloperAIThreads();
  try { await loadDeveloperAICloudThreads(); }
  catch(e) { status("Cloud chat history unavailable; showing local backup. "+e.message); }
  if(developerAIThreads.length){
    const thread=developerAIThreads[0];developerAIThreadId=thread.id;
    developerAIMessages=thread.messages||[];developerAIDrafts=thread.drafts||[];
  }else{
    developerAIThreadId="chat-"+Date.now();
    developerAIMessages=[];developerAIDrafts=[];
    developerAIThreads=[{id:developerAIThreadId,title:"New chat",updated:Date.now(),messages:[],drafts:[]}];
  }
  developerAIImages=[];developerAIBusy=false;
  $("adminContent").innerHTML=`
    <style>
    .frost-ai-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:12px;margin-top:12px}
    .frost-ai-history{background:#101c30;border:1px solid #30445e;border-radius:14px;padding:12px;max-height:70vh;overflow:auto}
    .frost-ai-history button{display:block;width:100%;margin:5px 0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .frost-ai-main{min-width:0;background:#101c30;border:1px solid #30445e;border-radius:14px;padding:12px}
    .frost-ai-chat{height:48vh;min-height:290px;overflow:auto;display:flex;flex-direction:column;gap:15px;padding:10px}
    .frost-ai-message{max-width:92%;line-height:1.55;overflow-wrap:anywhere}
    .frost-ai-message.user{align-self:flex-end;background:#263d59;border-radius:16px 16px 3px 16px;padding:10px 14px}
    .frost-ai-message.assistant{align-self:flex-start;padding:10px 4px}
    .frost-ai-message pre{background:#081424;border:1px solid #33465b;border-radius:9px;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere}
    .frost-ai-message .frost-ai-body{white-space:pre-wrap}
    .frost-ai-message button{font-size:12px;padding:5px 9px;margin-top:6px}
    .frost-ai-composer{display:flex;align-items:flex-end;gap:8px}
    .frost-ai-composer textarea{flex:1;min-width:0;resize:vertical;border-radius:12px}
    .frost-ai-attachments{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
    .frost-ai-attachments img,.frost-ai-message img{max-width:130px;max-height:110px;object-fit:contain;border-radius:8px;margin:5px}
    .frost-ai-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between}
    @media(max-width:650px){.frost-ai-layout{grid-template-columns:minmax(0,1fr)}.frost-ai-history{max-height:140px}.frost-ai-chat{height:48vh}.frost-ai-message{max-width:98%}}
    </style>
    <button class="secondary" onclick="showDashboard()">← Admin Dashboard</button>
    <h2>🤖 Developer AI</h2>
    <div class="frost-ai-layout">
      <aside class="frost-ai-history"><button onclick="newDeveloperAIChat()">＋ New chat</button><strong>Chat history</strong><div id="developerAIHistory"></div></aside>
      <section class="frost-ai-main">
        <div class="frost-ai-toolbar"><strong>Frost Developer AI</strong><span><button class="secondary" onclick="renameDeveloperAIChat()">✎ Rename</button> <button class="secondary" onclick="exportDeveloperAIChat()">⬇ Save chat</button> <button class="secondary" onclick="deleteDeveloperAIChat()">🗑 Delete</button></span></div>
        <div id="developerAIChat" class="frost-ai-chat" role="log" aria-live="polite"></div>
        <div id="developerAIDrafts"></div>
        <div id="developerAIPreview" class="frost-ai-attachments"></div>
        <form id="developerAIForm" class="frost-ai-composer">
          <label for="developerAIFile" style="cursor:pointer" title="Upload pictures">📎</label>
          <input id="developerAIFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="display:none">
          <textarea id="developerAIInput" rows="2" maxlength="4000" placeholder="Message Developer AI…" aria-label="Message Developer AI"></textarea>
          <button id="developerAISend" type="submit">➤ Send</button>
        </form>
        <p class="hint">Chats sync privately to your admin account and keep a local backup. Replies appear after the model finishes; live token streaming is not enabled yet.</p>
      </section>
    </div>`;
  $("developerAIForm").onsubmit=sendDeveloperAI;
  $("developerAIFile").onchange=addDeveloperAIImages;
  $("developerAIInput").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("developerAIForm").requestSubmit();}};
  renderDeveloperAI();
}
function renderDeveloperAI() {
  const history=$("developerAIHistory");
  if(history)history.innerHTML=developerAIThreads.map(t=>'<button type="button" class="secondary" '+(t.id===developerAIThreadId?'style="border-color:#7aa9ff"':'')+' onclick="openDeveloperAIChat(\''+safe(t.id)+'\')">'+safe(t.title||"New chat")+'</button>').join("");
  const chat=$("developerAIChat");
  if(!chat)return;
  chat.innerHTML=(developerAIMessages.length?"":'<p class="hint">Ask me about your website, games, bugs or announcements.</p>')+
    developerAIMessages.map((m,i)=>{
      const body=safe(m.content||"").replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,(all,lang,src)=>'<pre><code>'+src+'</code></pre><button type="button" class="secondary" onclick="copyDeveloperAICode('+i+',this)">📋 Copy code</button>');
      return '<div class="frost-ai-message '+(m.role==="user"?"user":"assistant")+'"><strong>'+(m.role==="user"?"You":"✦ Developer AI")+'</strong><div class="frost-ai-body">'+body+'</div>'+
      (Array.isArray(m.images)?m.images.map(src=>'<img src="'+safe(src)+'" alt="Uploaded image">').join(""):"")+
      (m.role==="assistant"?'<button type="button" class="secondary" onclick="copyDeveloperAIMessage('+i+')">📋 Copy message</button>':'')+'</div>';
    }).join("")+
    (developerAIBusy?'<div class="frost-ai-message assistant" role="status">✦ Developer AI is thinking… <span aria-hidden="true">● ● ●</span></div>':"");
  chat.scrollTop=chat.scrollHeight;
  const preview=$("developerAIPreview");
  if(preview)preview.innerHTML=developerAIImages.map((src,i)=>'<div><img src="'+safe(src)+'" alt="Selected image"><button type="button" class="secondary" onclick="removeDeveloperAIImage('+i+')">✕</button></div>').join("");
  const drafts=$("developerAIDrafts");
  if(drafts)drafts.innerHTML=developerAIDrafts.map((d,i)=>'<div class="admin-section"><h3>Announcement draft — '+safe(d.game_name)+'</h3><strong>'+safe(d.title)+'</strong><p style="white-space:pre-wrap">'+safe(d.message)+'</p><p class="hint">Not published yet.</p><button onclick="approveDeveloperAnnouncement('+i+')">Approve & Publish</button><button class="secondary" onclick="discardDeveloperAnnouncement('+i+')">Discard</button></div>').join("");
}
async function addDeveloperAIImages(e) {
  for(const file of Array.from(e.target.files||[]).slice(0,4-developerAIImages.length)){
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)||file.size>4000000){status("Use PNG, JPG, WebP or GIF under 4 MB.");continue;}
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>{
        const img=new Image();img.onload=()=>{
          const scale=Math.min(1,1400/Math.max(img.width,img.height));
          const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
          canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL("image/jpeg",0.76));
        };img.onerror=reject;img.src=reader.result;
      };reader.onerror=reject;reader.readAsDataURL(file);
    });
    developerAIImages.push(data);
  }
  e.target.value="";renderDeveloperAI();
}
function removeDeveloperAIImage(i){developerAIImages.splice(i,1);renderDeveloperAI();}
async function copyDeveloperAICode(index,button) {
  const content=developerAIMessages[index]?.content||"";
  const blocks=[...content.matchAll(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g)];
  const code=blocks[Number(button?.dataset?.block||0)]?.[1]||blocks[0]?.[1]||"";
  if(!code)return status("No code block found.");
  try{await navigator.clipboard.writeText(code);status("Code copied.");}
  catch(e){const f=document.createElement("textarea");f.value=code;document.body.appendChild(f);f.select();document.execCommand("copy");f.remove();status("Code copied.");}
}
async function copyDeveloperAIMessage(index) {
  const message=developerAIMessages[index];if(!message)return;
  try{await navigator.clipboard.writeText(message.content||"");status("Message copied.");}
  catch(e){const f=document.createElement("textarea");f.value=message.content||"";document.body.appendChild(f);f.select();document.execCommand("copy");f.remove();status("Message copied.");}
}
async function sendDeveloperAI(event) {
  event.preventDefault();if(developerAIBusy)return;
  const input=$("developerAIInput"),button=$("developerAISend");
  const message=input.value.trim(),images=developerAIImages.slice();
  if(!message&&!images.length)return;
  developerAIMessages.push({role:"user",content:message||"Please analyze these pictures.",...(images.length?{images}:{})});
  input.value="";developerAIImages=[];developerAIBusy=true;button.disabled=true;
  saveDeveloperAIThreads();renderDeveloperAI();
  try{
    const result=await callDeveloperAI("chat",{messages:developerAIMessages});
    developerAIMessages.push({role:"assistant",content:result.reply||"No response received."});
    developerAIDrafts.push(...(result.pending_actions||[]));
  }catch(error){developerAIMessages.push({role:"assistant",content:"I couldn't connect: "+error.message});}
  finally{developerAIBusy=false;button.disabled=false;saveDeveloperAIThreads();renderDeveloperAI();}
}
async function approveDeveloperAnnouncement(index) {
  const draft=developerAIDrafts[index];
  if(!draft) return;
  if(!confirm("Publish this announcement to "+draft.game_name+"?")) return;
  try {
    await callDeveloperAI("publish_announcement",draft);
    developerAIDrafts.splice(index,1);
    developerAIMessages.push({role:"assistant",content:"Announcement published successfully to "+draft.game_name+"."});
    saveDeveloperAIThreads();
    renderDeveloperAI();
    status("Announcement published.");
  } catch(error) { status("Publish failed: "+error.message); }
}
function discardDeveloperAnnouncement(index) {
  developerAIDrafts.splice(index,1);
  renderDeveloperAI();
}
