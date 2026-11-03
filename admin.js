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
    status(error.message);
    return;
  }

  const session = data.session;
  const loggedIn = !!session;

  $("loginBox").hidden = loggedIn;
  $("adminBox").hidden = !loggedIn;

  if (loggedIn && session.user.id !== ADMIN_UID) {
    await db.auth.signOut();
    $("loginBox").hidden = false;
    $("adminBox").hidden = true;
    status("Access denied. Administrator only.");
    return;
  }

  if (loggedIn) showDashboard();
}

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  status("Signing in...");
  const submitButton = event.target.querySelector("button[type=submit]");
  if (submitButton) submitButton.disabled = true;

  const email = $("email").value.trim();
  const password = $("password").value;

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    status("Login failed: " + error.message);
    if (submitButton) submitButton.disabled = false;
    return;
  }

  await refreshAuth();
  if (submitButton) submitButton.disabled = false;
});

async function signOut() {
  const { error } = await db.auth.signOut();

  if (error) {
    status(error.message);
    return;
  }

  $("loginBox").hidden = false;
  $("adminBox").hidden = true;
  status("Signed out.");
}

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

        <label>
          <input type="checkbox" name="active" checked>
          Active
        </label>

        <button type="submit">Add Gift Code</button>
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

function renderGameCodes() {
  $("gameCodeList").innerHTML = giftCodes.length
    ? giftCodes.map(code => `
      <div class="admin-record">
        <strong>${safe(code.code)}</strong>
        <p>${!code.active ? "Inactive" : code.expires_at && new Date(code.expires_at) <= new Date() ? "Expired" : "Active"}</p>\n        <p>${code.expires_at ? "Expires: " + safe(new Date(code.expires_at).toLocaleString()) : "No expiry"}</p>

        <button onclick="toggleGameCode(${code.id}, ${!code.active})">
          ${code.active ? "Deactivate" : "Activate"}
        </button>

        <button class="danger" onclick="deleteGameCode(${code.id})">
          Delete
        </button>
      </div>
    `).join("")
    : "<p>No gift codes for this game.</p>";
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

async function showTab(tab) {
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
});        <label>Expires After</label>
        <select name="expiry_days">
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7" selected>7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
          <option value="never">Never expires</option>
        </select>

        <label>
          <input type="checkbox" name="active" checked>
          Active
        </label>

        <button type="submit">Add Gift Code</button>
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
    active: form.get("active") === "on"
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

function renderGameCodes() {
  $("gameCodeList").innerHTML = giftCodes.length
    ? giftCodes.map(code => `
      <div class="admin-record">
        <strong>${safe(code.code)}</strong>
        <p>${!code.active ? "Inactive" : code.expires_at && new Date(code.expires_at) <= new Date() ? "Expired" : "Active"}</p>\n        <p>${code.expires_at ? "Expires: " + safe(new Date(code.expires_at).toLocaleString()) : "No expiry"}</p>

        <button onclick="toggleGameCode(${code.id}, ${!code.active})">
          ${code.active ? "Deactivate" : "Activate"}
        </button>

        <button class="danger" onclick="deleteGameCode(${code.id})">
          Delete
        </button>
      </div>
    `).join("")
    : "<p>No gift codes for this game.</p>";
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

async function showTab(tab) {
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

// Defer session refresh until the auth callback has completed to avoid
// re-entering Supabase auth methods from inside onAuthStateChange.
db.auth.onAuthStateChange(() => {
  queueMicrotask(() => {
    refreshAuth().catch(error => {
      console.error("Authentication refresh failed:", error);
      status("Could not refresh login status. Please reload the page.");
    });
  });
});

refreshAuth().catch(error => {
  console.error("Initial authentication check failed:", error);
  status("Could not check login status. Please reload the page.");
});
