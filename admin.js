const SUPABASE_URL = "https://xnixsavppmmvbzfnybus.supabase.co";
const SUPABASE_KEY = "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let activeTab = "codes";

function status(message) {
  document.getElementById("adminStatus").textContent = message;
}

async function refreshAuth() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    status("Session error: " + error.message);
    return;
  }

  const loggedIn = !!data.session;

  document.getElementById("loginBox").hidden = loggedIn;
  document.getElementById("adminBox").hidden = !loggedIn;

  if (loggedIn) {
    showTab(activeTab);
    status("Welcome to Frost Survival Admin.");
  }
}

// LOGIN
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  status("Signing in...");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      status("Login failed: " + error.message);
      return;
    }

    status("Login successful.");
    await refreshAuth();

  } catch (err) {
    status("Login error: " + err.message);
  }
});

// LOGOUT
async function signOut() {
  const { error } = await db.auth.signOut();

  if (error) {
    status("Logout failed: " + error.message);
    return;
  }

  document.getElementById("loginBox").hidden = false;
  document.getElementById("adminBox").hidden = true;
  status("Signed out successfully.");
}

// DASHBOARD TABS
function showTab(tab) {
  activeTab = tab;

  const el = document.getElementById("adminContent");

  if (tab === "codes") {
    el.innerHTML = `
      <h2>Gift Codes</h2>
      <form id="codeForm">
        <label>Game</label>
        <select class="input" name="game_name">
          <option>Whiteout Survival V4</option>
          <option>Whiteout Survival V5 Europe</option>
          <option>Whiteout Survival V5 China</option>
          <option>KingShot V4</option>
        </select>
        <label>Gift Code</label>
        <input class="input" name="code" required>
        <label><input type="checkbox" name="active" checked> Active</label>
        <button type="submit">Add Code</button>
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

    loadTable("gift_codes", "records",
      "id,game_name,code,active");

  } else if (tab === "announcements") {
    el.innerHTML = `
      <h2>Announcements</h2>
      <form id="annForm">
        <label>Game</label>
        <select class="input" name="game_name">
          <option>All Games</option>
          <option>Whiteout Survival V4</option>
          <option>Whiteout Survival V5 Europe</option>
          <option>Whiteout Survival V5 China</option>
          <option>KingShot V4</option>
        </select>
        <label>Title</label>
        <input class="input" name="title" required>
        <label>Message</label>
        <textarea class="input" name="message" required></textarea>
        <button type="submit">Publish</button>
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

    loadTable("announcements", "records",
      "id,game_name,title,message,created_at");

  } else {
    const table = tab === "apps"
      ? "team_applications"
      : "bug_reports";

    el.innerHTML = `
      <h2>${tab === "apps" ? "Applications" : "Bug Reports"}</h2>
      <div id="records">Loading...</div>
    `;

    loadTable(table, "records", "*");
  }
}

// LOAD TABLE DATA
async function loadTable(table, target, columns) {
  const el = document.getElementById(target);

  const { data, error } = await db
    .from(table)
    .select(columns)
    .order("id", { ascending: false })
    .limit(50);

  if (error) {
    el.textContent = "Error: " + error.message;
    return;
  }

  el.innerHTML = "";

  if (!data || data.length === 0) {
    el.textContent = "No records yet.";
    return;
  }

  data.forEach((record) => {
    const panel = document.createElement("div");
    panel.className = "panel";

    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(record, null, 2);
    pre.style.cssText =
      "white-space:pre-wrap;overflow-wrap:anywhere";

    panel.appendChild(pre);

    if (record.id !== undefined) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Delete";

      button.addEventListener("click", () => {
        deleteRow(table, record.id);
      });

      panel.appendChild(button);
    }

    el.appendChild(panel);
  });
}

// DELETE RECORD
async function deleteRow(table, id) {
  if (!confirm("Delete this record?")) return;

  const { error } = await db
    .from(table)
    .delete()
    .eq("id", id);

  status(error ? error.message : "Record deleted.");

  if (!error) showTab(activeTab);
}

// CHECK EXISTING SESSION
refreshAuth();
