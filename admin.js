const SUPABASE_URL = "https://xnixsavppmmvbzfnybus.supabase.co";
const SUPABASE_KEY = "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";
const ADMIN_UID = "9cd04a06-6937-474a-9b13-ea39b2c3bd35";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let activeTab = "codes";
let editingCodeId = null;
let giftCodes = [];

const games = [
  "Whiteout Survival V4",
  "Whiteout Survival V5 Europe",
  "Whiteout Survival V5 China",
  "KingShot V4"
];

function status(message) {
  document.getElementById("adminStatus").textContent = message;
}

async function refreshAuth() {
  const { data, error } = await db.auth.getSession();

  if (error) return status(error.message);

  const session = data.session;
  const loggedIn = !!session;

  document.getElementById("loginBox").hidden = loggedIn;
  document.getElementById("adminBox").hidden = !loggedIn;

  if (loggedIn && session.user.id !== ADMIN_UID) {
    await db.auth.signOut();
    document.getElementById("loginBox").hidden = false;
    document.getElementById("adminBox").hidden = true;
    return status("Access denied: This account is not an administrator.");
  }

  if (loggedIn) showTab(activeTab);
}

// LOGIN
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  status("Signing in...");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    status("Login failed: " + error.message);
    return;
  }

  await refreshAuth();
  status("Welcome to Frost Survival Admin.");
});

// LOGOUT
async function signOut() {
  const { error } = await db.auth.signOut();

  if (error) return status(error.message);

  document.getElementById("loginBox").hidden = false;
  document.getElementById("adminBox").hidden = true;
  status("Signed out successfully.");
}

// TAB NAVIGATION
function showTab(tab) {
  activeTab = tab;
  editingCodeId = null;

  if (tab === "codes") {
    showGiftCodes();
  } else if (tab === "announcements") {
    showAnnouncements();
  } else {
    const table = tab === "apps" ? "team_applications" : "bug_reports";
    showOtherRecords(table, tab);
  }
}

// GIFT CODES DASHBOARD
async function showGiftCodes() {
  const el = document.getElementById("adminContent");

  el.innerHTML = `
    <div class="admin-heading">
      <div>
        <h2>Gift Code Manager</h2>
        <p>Manage codes for all supported games.</p>
      </div>
      <button type="button" onclick="openCodeForm()">+ Add New Code</button>
    </div>

    <div class="code-toolbar">
      <input id="codeSearch" class="input"
        placeholder="Search gift codes..."
        oninput="filterGiftCodes()">

      <select id="gameFilter" class="input"
        onchange="filterGiftCodes()">
        <option value="all">All Games</option>
        ${games.map(g => `<option value="${g}">${g}</option>`).join("")}
      </select>
    </div>

    <div id="codeStats" class="code-stats"></div>
    <div id="codeFormArea"></div>
    <div id="codeList">Loading gift codes...</div>
  `;

  await loadGiftCodes();
}

async function loadGiftCodes() {
  const { data, error } = await db
    .from("gift_codes")
    .select("id,game_name,code,active")
    .order("id", { ascending: false });

  if (error) {
    document.getElementById("codeList").textContent =
      "Could not load codes: " + error.message;
    return;
  }

  giftCodes = data || [];

  const active = giftCodes.filter(c => c.active).length;

  document.getElementById("codeStats").innerHTML = `
    <div class="code-stat">
      <strong>${giftCodes.length}</strong>
      <span>Total Codes</span>
    </div>
    <div class="code-stat">
      <strong>${active}</strong>
      <span>Active Codes</span>
    </div>
    <div class="code-stat">
      <strong>${giftCodes.length - active}</strong>
      <span>Inactive Codes</span>
    </div>
  `;

  filterGiftCodes();
}

// ADD / EDIT FORM
function openCodeForm(id = null) {
  editingCodeId = id;

  const record = id
    ? giftCodes.find(c => c.id === id)
    : null;

  document.getElementById("codeFormArea").innerHTML = `
    <div class="code-form-card">
      <h3>${record ? "Edit Gift Code" : "Add New Gift Code"}</h3>

      <form id="giftCodeForm">
        <label>Game</label>
        <select class="input" name="game_name" required>
          ${games.map(g => `
            <option value="${g}"
              ${record?.game_name === g ? "selected" : ""}>
              ${g}
            </option>
          `).join("")}
        </select>

        <label>Gift Code</label>
        <textarea class="input" name="code"
          rows="3" required
          placeholder="Enter gift code here">${record?.code || ""}</textarea>

        <label class="active-option">
          <input type="checkbox" name="active"
            ${record ? (record.active ? "checked" : "") : "checked"}>
          Active
        </label>

        <div class="form-actions">
          <button type="submit">
            ${record ? "Save Changes" : "Add Gift Code"}
          </button>
          <button type="button" class="secondary"
            onclick="closeCodeForm()">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById("giftCodeForm").onsubmit = saveGiftCode;
  document.getElementById("codeFormArea").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeCodeForm() {
  editingCodeId = null;
  document.getElementById("codeFormArea").innerHTML = "";
}

// SAVE NEW OR UPDATED CODE
async function saveGiftCode(e) {
  e.preventDefault();

  const form = new FormData(e.target);

  const record = {
    game_name: form.get("game_name"),
    code: form.get("code").trim(),
    active: form.get("active") === "on"
  };

  if (!record.code) {
    status("Please enter a gift code.");
    return;
  }

  status("Saving gift code...");

  let result;

  if (editingCodeId !== null) {
    result = await db.from("gift_codes")
      .update(record)
      .eq("id", editingCodeId);
  } else {
    result = await db.from("gift_codes").insert(record);
  }

  if (result.error) {
    status("Save failed: " + result.error.message);
    return;
  }

  status(editingCodeId !== null
    ? "Gift code updated successfully."
    : "Gift code added successfully.");

  editingCodeId = null;
  await loadGiftCodes();
  closeCodeForm();
}

// SEARCH AND FILTER
function filterGiftCodes() {
  const search = (
    document.getElementById("codeSearch")?.value || ""
  ).toLowerCase();

  const game = document.getElementById("gameFilter")?.value || "all";

  const filtered = giftCodes.filter(c =>
    (game === "all" || c.game_name === game) &&
    (c.code.toLowerCase().includes(search) ||
     c.game_name.toLowerCase().includes(search))
  );

  const el = document.getElementById("codeList");

  if (!filtered.length) {
    el.innerHTML = "<p>No matching gift codes found.</p>";
    return;
  }

  el.innerHTML = filtered.map(c => `
    <div class="code-card">
      <div class="code-card-top">
        <div>
          <span class="game-label">${escapeHTML(c.game_name)}</span>
          <span class="code-status ${c.active ? "is-active" : "is-inactive"}">
            ${c.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div class="gift-code-value">${escapeHTML(c.code)}</div>

      <div class="code-actions">
        <button type="button"
          onclick="copyGiftCode(${c.id})">Copy</button>

        <button type="button" class="secondary"
          onclick="openCodeForm(${c.id})">Edit</button>

        <button type="button" class="danger"
          onclick="deleteGiftCode(${c.id})">Delete</button>
      </div>
    </div>
  `).join("");
}

// SAFE TEXT DISPLAY
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// COPY CODE
async function copyGiftCode(id) {
  const record = giftCodes.find(c => c.id === id);
  if (!record) return;

  try {
    await navigator.clipboard.writeText(record.code);
    status("Gift code copied.");
  } catch {
    status("Copy failed. Please copy the code manually.");
  }
}

// DELETE CODE
async function deleteGiftCode(id) {
  const record = giftCodes.find(c => c.id === id);
  if (!record) return;

  if (!confirm("Delete this gift code permanently?")) return;

  const { error } = await db
    .from("gift_codes")
    .delete()
    .eq("id", id);

  if (error) {
    status("Delete failed: " + error.message);
    return;
  }

  status("Gift code deleted.");
  await loadGiftCodes();
}

// ANNOUNCEMENTS
function showAnnouncements() {
  const el = document.getElementById("adminContent");

  el.innerHTML = `
    <h2>Announcements</h2>
    <form id="annForm">
      <label>Game</label>
      <select class="input" name="game_name">
        <option>All Games</option>
        ${games.map(g => `<option>${g}</option>`).join("")}
      </select>
      <label>Title</label>
      <input class="input" name="title" required>
      <label>Message</label>
      <textarea class="input" name="message" required></textarea>
      <button type="submit">Publish Announcement</button>
    </form>
    <div id="records">Loading...</div>
  `;

  document.getElementById("annForm").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);

    const { error } = await db.from("announcements").insert({
      game_name: f.get("game_name"),
      title: f.get("title"),
      message: f.get("message")
    });

    status(error ? error.message : "Announcement published.");
    if (!error) showAnnouncements();
  };

  loadTable("announcements", "records",
    "id,game_name,title,message,created_at");
}

// APPLICATIONS AND BUG REPORTS
function showOtherRecords(table, tab) {
  const el = document.getElementById("adminContent");

  el.innerHTML = `
    <h2>${tab === "apps" ? "Applications" : "Bug Reports"}</h2>
    <div id="records">Loading records...</div>
  `;

  loadTable(table, "records", "*");
}

// GENERAL TABLE VIEW
async function loadTable(table, target, columns) {
  const el = document.getElementById(target);

  const { data, error } = await db.from(table)
    .select(columns)
    .order("id", { ascending: false })
    .limit(50);

  if (error) {
    el.textContent = "Error: " + error.message;
    return;
  }

  el.innerHTML = "";

  if (!data?.length) {
    el.textContent = "No records yet.";
    return;
  }

  data.forEach(record => {
    const card = document.createElement("div");
    card.className = "code-card";

    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(record, null, 2);
    pre.style.whiteSpace = "pre-wrap";
    pre.style.overflowWrap = "anywhere";

    card.appendChild(pre);
    el.appendChild(card);
  });
}

// AUTH SESSION
db.auth.onAuthStateChange(() => {
  refreshAuth();
});

refreshAuth();
