const URL = "https://xnixsavppmmvbzfnybus.supabase.co";
const KEY = "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";

const db = window.supabase.createClient(URL, KEY);
let activeTab = "codes";

function status(message) {
  document.getElementById("adminStatus").textContent = message;
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  status("Signing in...");

  const emailValue = document.getElementById("email").value.trim();
  const passwordValue = document.getElementById("password").value;

  const { error } = await db.auth.signInWithPassword({
    email: emailValue,
    password: passwordValue
  });

  if (error) {
    status("Login failed: " + error.message);
    return;
  }

  await refreshAuth();
});

async function refreshAuth() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    status(error.message);
    return;
  }

  const loggedIn = !!data.session;
  document.getElementById("loginBox").hidden = loggedIn;
  document.getElementById("adminBox").hidden = !loggedIn;

  if (loggedIn) showTab(activeTab);
}

async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) status(error.message);
  await refreshAuth();
}

function showTab(tab) {
  activeTab = tab;
  const el = document.getElementById("adminContent");

  if (tab === "codes") {
    el.innerHTML = `
      <h2>Gift Codes</h2>
      <form id="codeForm">
        <div class="field">
          <label>Game</label>
          <select class="input" name="game_name">
            <option>Whiteout Survival V4</option>
            <option>Whiteout Survival V5 Europe</option>
            <option>Whiteout Survival V5 China</option>
            <option>KingShot V4</option>
          </select>
        </div>
        <div class="field">
          <label>Gift Code</label>
          <input class="input" name="code" required>
        </div>
        <label><input type="checkbox" name="active" checked> Active</label>
        <p><button>Add Code</button></p>
      </form>
      <div id="records">Loading...</div>
    `;

    document.getElementById("codeForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);

      const { error } = await db.from("gift_codes").insert({
        game_name: f.get("game_name"),
        code: f.get("code").trim(),
        active: f.get("active") === "on"
      });

      status(error ? error.message : "Gift code added.");
      if (!error) showTab("codes");
    };

    loadTable("gift_codes", "records", "id,game_name,code,active");
  } else if (tab === "announcements") {
    el.innerHTML = `
      <h2>Publish Announcement</h2>
      <form id="annForm">
        <div class="field">
          <label>Game</label>
          <select class="input" name="game_name">
            <option>All Games</option>
            <option>Whiteout Survival V4</option>
            <option>Whiteout Survival V5 Europe</option>
            <option>Whiteout Survival V5 China</option>
            <option>KingShot V4</option>
          </select>
        </div>
        <div class="field">
          <label>Title</label>
          <input class="input" name="title" required>
        </div>
        <div class="field">
          <label>Message</label>
          <textarea class="input" name="message" required></textarea>
        </div>
        <button>Publish</button>
      </form>
      <div id="records">Loading...</div>
    `;

    document.getElementById("annForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);

      const { error } = await db.from("announcements").insert({
        game_name: f.get("game_name"),
        title: f.get("title"),
        message: f.get("message")
      });

      status(error ? error.message : "Announcement published.");
      if (!error) showTab("announcements");
    };

    loadTable(
      "announcements",
      "records",
      "id,game_name,title,message,created_at"
    );
  } else if (tab === "apps") {
    loadPrivate("team_applications");
  } else {
    loadPrivate("bug_reports");
  }
}

async function loadTable(table, target, columns) {
  const el = document.getElementById(target);

  const { data, error } = await db
    .from(table)
    .select(columns)
    .order("id", { ascending: false })
    .limit(50);

  if (error) {
    el.innerHTML = `<p class="notice">Error: ${esc(error.message)}</p>`;
    return;
  }

  el.innerHTML = (data || []).map((record) => `
    <div class="panel">
      <pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(
        JSON.stringify(record, null, 2)
      )}</pre>
      <button onclick="deleteRow('${table}', ${JSON.stringify(record.id)})">
        Delete
      </button>
    </div>
  `).join("") || "<p>No records yet.</p>";
}

function loadPrivate(table) {
  const el = document.getElementById("adminContent");

  el.innerHTML = `
    <h2>${table === "team_applications" ? "Team Applications" : "Bug Reports"}</h2>
    <div id="records">Loading...</div>
  `;

  loadTable(table, "records", "*");
}

async function deleteRow(table, id) {
  if (!confirm("Delete this record?")) return;

  const { error } = await db.from(table).delete().eq("id", id);

  status(error ? error.message : "Record deleted.");

  if (!error) showTab(activeTab);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

db.auth.onAuthStateChange(() => {
  refreshAuth();
});

refreshAuth();
