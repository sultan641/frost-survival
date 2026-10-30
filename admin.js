const SUPABASE_URL = "https://xnixsavppmmvbzfnybus.supabase.co";
const SUPABASE_KEY = "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";

const statusEl = document.getElementById("adminStatus");

function status(message) {
  if (statusEl) statusEl.textContent = message;
}

async function startAdmin() {
  try {
    if (!window.supabase) {
      throw new Error("Supabase script did not load.");
    }

    const db = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    document.getElementById("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      status("Signing in...");

      try {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const { error } = await db.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          status("Login failed: " + error.message);
          return;
        }

        status("Login successful. Loading admin...");
        await refreshAuth();
      } catch (err) {
        status("Login error: " + err.message);
      }
    });

    async function refreshAuth() {
      try {
        const { data, error } = await db.auth.getSession();
        if (error) throw error;

        const loggedIn = !!data.session;
        document.getElementById("loginBox").hidden = loggedIn;
        document.getElementById("adminBox").hidden = !loggedIn;

        if (loggedIn) {
          document.getElementById("adminContent").innerHTML =
            "<h2>Admin login successful</h2><p>Authentication works. Dashboard features need to be reconnected.</p>";
        }
      } catch (err) {
        status("Session error: " + err.message);
      }
    }

    document.querySelectorAll("#adminBox button[onclick]").forEach(button => {
      button.disabled = true;
    });

    window.signOut = async function () {
      const { error } = await db.auth.signOut();
      status(error ? error.message : "Signed out.");
      await refreshAuth();
    };

    await refreshAuth();
  } catch (err) {
    status("Setup error: " + err.message);
  }
}

startAdmin();
