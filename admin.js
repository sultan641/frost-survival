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
    </div>
  `;

  addAdminStyles();
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
    .admin-record {
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
        <p class="hint">When enabled, visitors stay focused on this game's page and internal navigation links are hidden/blocked.</p>

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
  area.textContent = "Loading traffic data…";
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db.from("site_analytics")
    .select("event_type,page_path,device_type,created_at,referrer_host,campaign_source,campaign_medium,campaign_name,target_host")
    .eq("site_key", "frost-survival")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) { area.textContent = "Analytics error: " + error.message; return; }

  const rows = data || [];
  const count = type => rows.filter(row => row.event_type === type).length;
  const pageViews = rows.filter(row => row.event_type === "page_view");
  const pages = {};
  const sources = {};
  const targets = {};
  const devices = {};
  pageViews.forEach(row => {
    const page = row.page_path || "/";
    pages[page] = (pages[page] || 0) + 1;
    const source = row.campaign_source
      ? "Campaign: " + [row.campaign_source, row.campaign_medium, row.campaign_name].filter(Boolean).join(" / ")
      : (row.referrer_host && row.referrer_host !== "sultan641.github.io" ? row.referrer_host : "Direct / internal");
    sources[source] = (sources[source] || 0) + 1;
    const device = row.device_type || "unknown";
    devices[device] = (devices[device] || 0) + 1;
  });
  rows.filter(row => row.target_host && ["promotion_click","external_click","discord_click","youtube_click","game_click"].includes(row.event_type))
    .forEach(row => { targets[row.target_host] = (targets[row.target_host] || 0) + 1; });
  const top = object => Object.entries(object).sort((a,b) => b[1] - a[1]).slice(0,8);
  const cards = [
    ["Page views", count("page_view")],
    ["Game / download clicks", count("game_click")],
    ["Promotion directory clicks", count("promotion_click")],
    ["Discord clicks", count("discord_click")],
    ["YouTube clicks", count("youtube_click")],
    ["Share clicks", count("share_click")],
    ["External clicks", count("external_click")],
    ["Gift-code copies", count("gift_code_copy")]
  ];
  const list = (items, suffix) => items.length
    ? items.map(([name,total]) => `<div class="admin-record"><strong>${safe(name)}</strong><p>${total} ${suffix}</p></div>`).join("")
    : "<p>No data recorded yet.</p>";
  area.innerHTML = `
    <div class="field" style="max-width:260px">
      <label for="analyticsRange">Date range</label>
      <select class="input" id="analyticsRange" onchange="loadTrafficAnalytics(Number(this.value))">
        <option value="7" ${days===7?"selected":""}>Last 7 days</option>
        <option value="30" ${days===30?"selected":""}>Last 30 days</option>
        <option value="90" ${days===90?"selected":""}>Last 90 days</option>
      </select>
    </div>
    <div class="admin-game-grid">
      ${cards.map(([label,total]) => `<div class="admin-record"><h3>${total}</h3><p>${label}</p></div>`).join("")}
    </div>
    <h3>Traffic sources & campaigns · page views</h3>
    ${list(top(sources),"views")}
    <h3>Top pages</h3>
    ${list(top(pages),"views")}
    <h3>External destinations</h3>
    ${list(top(targets),"clicks")}
    <h3>Devices</h3>
    ${list(top(devices),"page views")}
    <p class="muted">Privacy-friendly totals only. No unique visitor profiles or personal IDs are collected. Showing up to 5,000 events for this period.</p>
  `;
}

async function showTab(tab) {
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

// AUTH SESSION
// Avoid calling Supabase auth methods from inside onAuthStateChange.
// Login submits directly to Supabase, then refreshes the dashboard.
refreshAuth().catch(error => {
  console.error("Initial authentication check failed:", error);
  status("Could not check login status: " + (error.message || error));
});
