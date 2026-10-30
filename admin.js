document.getElementById("adminStatus").textContent = "ADMIN JS LOADED";
const URL = "https://xnixsavppmmvbzfnybus.supabase.co";
const KEY = "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";

const db = window.supabase.createClient(URL, KEY);
let activeTab = "codes";

function status(message) {
  document.getElementById("adminStatus").textContent = message;
}

async function refreshAuth() {
  const { data, error } = await db.auth.getSession();
  if (error) return status(error.message);

  const loggedIn = !!data.session;
  document.getElementById("loginBox").hidden = loggedIn;
  document.getElementById("adminBox").hidden = !loggedIn;

  if (loggedIn) showTab(activeTab);
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  status("BUTTON WORKING");

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    });

    if (error) {
      status("Login failed: " + error.message);
      return;
    }

    status("Login successful: " + !!data.session);
    await refreshAuth();

  } catch (err) {
    status("Error: " + err.message);
  }
});
  e.preventDefault();
  status("Signing in...");

  try {
    const { error } = await db.auth.signInWithPassword({
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    });

    if (error) return status("Login failed: " + error.message);
    status("Login successful.");
    await refreshAuth();
  } catch (err) {
    status("Login error: " + err.message);
  }
});

async function signOut() {
  const { error } = await db.auth.signOut();
  status(error ? error.message : "Signed out.");
  await refreshAuth();
}

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
        <button>Add Code</button>
      </form>
      <div id="records">Loading...</div>`;

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
        <button>Publish</button>
      </form>
      <div id="records">Loading...</div>`;

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
    const table = tab === "apps" ? "team_applications" : "bug_reports";
    el.innerHTML = `<h2>${tab === "apps" ? "Applications" : "Bug Reports"}</h2>
      <div id="records">Loading...</div>`;
    loadTable(table, "records", "*");
  }
}

async function loadTable(table, target, columns) {
  const el = document.getElementById(target);
  const { data, error } = await db.from(table)
    .select(columns).order("id", { ascending: false }).limit(50);

  if (error) {
    el.textContent = "Error: " + error.message;
    return;
  }

  el.innerHTML = (data || []).map((r) => {
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(r, null, 2);
    pre.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere";

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.appendChild(pre);

    const button = document.createElement("button");
    button.textContent = "Delete";
    button.onclick = () => deleteRow(table, r.id);
    panel.appendChild(button);

    return panel.outerHTML;
  }).join("") || "<p>No records yet.</p>";

  // Reconnect safe delete buttons.
  const buttons = el.querySelectorAll("button");
  buttons.forEach((button, i) => {
    button.onclick = () => deleteRow(table, data[i].id);
  });
}

async function deleteRow(table, id) {
  if (!confirm("Delete this record?")) return;
  const { error } = await db.from(table).delete().eq("id", id);
  status(error ? error.message : "Record deleted.");
  if (!error) showTab(activeTab);
}

db.auth.onAuthStateChange(() => {
  refreshAuth();
});

refreshAuth();
