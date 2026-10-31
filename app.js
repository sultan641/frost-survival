// FROST SURVIVAL - PUBLIC WEBSITE APP
// Supabase configuration

const SUPABASE_URL = "https://xnixsavppmmvbzfnybus.supabase.co";
const SUPABASE_KEY = "sb_publishable_tx2KV3IddBr70wmLIrsLzQ_1DSHcUdT";

let supabaseClient = null;
window.CODES = [];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getClient() {
  if (!window.supabase) {
    throw new Error("Supabase SDK did not load.");
  }

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );
  }

  return supabaseClient;
}

// COPY FUNCTIONS

function copyText(text, button) {
  const done = () => {
    if (button) {
      const old = button.textContent;
      button.textContent = "Copied!";
      setTimeout(() => button.textContent = old, 1300);
    }

    const status = document.getElementById("copyStatus");
    if (status) status.textContent = "Copied to clipboard.";
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(done)
      .catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";

  document.body.appendChild(input);
  input.select();

  try {
    if (document.execCommand("copy")) {
      done();
    } else {
      alert("Please copy manually: " + text);
    }
  } catch (error) {
    alert("Please copy manually: " + text);
  }

  input.remove();
}

function copyAll(button) {
  if (!window.CODES.length) {
    alert("No active codes available.");
    return;
  }

  copyText(window.CODES.join("\n"), button);
}

// GIFT CODES

function drawCodes(codes) {
  const area = document.getElementById("codeList");
  if (!area) return;

  area.innerHTML = codes.length
    ? codes.map(code => `
        <div class="code-row">
          <span class="code">${esc(code)}</span>
          <button onclick="copyText(${JSON.stringify(code)},this)">
            Copy
          </button>
        </div>
      `).join("")
    : '<p class="muted">No active gift codes found.</p>';
}

function filterCodes() {
  const query = (
    document.getElementById("codeSearch")?.value || ""
  ).trim().toLowerCase();

  drawCodes(
    window.CODES.filter(code =>
      code.toLowerCase().includes(query)
    )
  );
}

async function loadGiftCodes(client, gameName) {
  const status = document.getElementById("codeLoadStatus");

  try {
    const { data, error } = await client
      .from("gift_codes")
      .select("code")
      .eq("game_name", gameName)
      .eq("active", true);

    if (error) throw error;

    window.CODES = (data || [])
      .flatMap(row =>
        String(row.code || "").trim().split(/\s+/)
      )
      .filter(Boolean);

    if (status) {
      status.textContent = window.CODES.length
        ? `Loaded ${window.CODES.length} active codes.`
        : "No active codes found for this game yet.";
    }

    drawCodes(window.CODES);

  } catch (error) {
    if (status) {
      status.textContent = "Gift codes unavailable: " + error.message;
    }

    drawCodes([]);
  }
}

// ANNOUNCEMENTS

async function loadAnnouncements(client, gameName) {
  const area = document.getElementById("announcementList");
  if (!area) return;

  try {
    const { data, error } = await client
      .from("announcements")
      .select("title,message,created_at")
      .eq("game_name", gameName)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    area.innerHTML = data?.length
      ? data.map(item => `
          <article class="panel">
            <h3>${esc(item.title || "Update")}</h3>
            <p>${esc(item.message || "")}</p>
            <p class="small">
              Frost Survival Team
              ${item.created_at
                ? " • " + new Date(item.created_at).toLocaleDateString()
                : ""}
            </p>
          </article>
        `).join("")
      : '<div class="panel">No updates yet.</div>';

  } catch (error) {
    area.innerHTML =
      '<div class="panel">Announcements could not be loaded.</div>';
  }
}

// GAME SETTINGS

function findHeroDescription() {
  return document.querySelector(".hero > p");
}

function renderExtraLinks(links) {
  if (!Array.isArray(links) || !links.length) return "";

  return `
    <section class="section" id="adminExtraLinks">
      <h2>Useful Links</h2>
      <div class="actions">
        ${links.map(link => {
          if (!link || typeof link !== "object" || !link.url) return "";

          return `
            <a class="btn secondary"
               href="${esc(link.url)}"
               target="_blank"
               rel="noopener noreferrer">
              ${esc(link.label || "Open Link")} ↗
            </a>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderInstallationGuide(guide) {
  if (!Array.isArray(guide) || !guide.length) return null;

  const section = document.querySelector(".section .steps");

  if (!section) return null;

  section.innerHTML = guide.map((step, index) => {
    if (!step || typeof step !== "object") return "";

    return `
      <div class="step">
        <h3>${esc(step.title || `Step ${index + 1}`)}</h3>
        <p>${esc(step.description || step.text || "")}</p>
      </div>
    `;
  }).join("");

  return section;
}

function renderGameSettings(settings) {
  if (!settings) return;

  // Description
  const description = findHeroDescription();

  if (description && settings.description) {
    description.textContent = settings.description;
  }

  // Main download button
  const downloadButton = document.querySelector(".hero .actions .btn");

  const downloadURL =
    settings.download_url || settings.registration_url;

  if (downloadButton && downloadURL) {
    downloadButton.href = downloadURL;
  }

  // Version information
  if (settings.version_info) {
    let versionBox = document.getElementById("adminVersionInfo");

    if (!versionBox) {
      versionBox = document.createElement("div");
      versionBox.id = "adminVersionInfo";
      versionBox.className = "notice";

      const hero = document.querySelector(".hero");
      if (hero) hero.appendChild(versionBox);
    }

    versionBox.textContent = settings.version_info;
  }

  // Promoter information
  if (settings.promoter_code) {
    let promoterBox = document.getElementById("adminPromoterInfo");

    if (!promoterBox) {
      promoterBox = document.createElement("div");
      promoterBox.id = "adminPromoterInfo";
      promoterBox.className = "promo";

      const hero = document.querySelector(".hero");
      if (hero) hero.appendChild(promoterBox);
    }

    promoterBox.innerHTML = `
      <strong>${esc(settings.promoter_label || "Promoter Code")}:</strong>
      <span class="code">${esc(settings.promoter_code)}</span>
      <button onclick="copyText(${JSON.stringify(settings.promoter_code)},this)">
        Copy Code
      </button>
    `;
  }

  // APK and iOS links
  let appLinks = document.getElementById("adminAppLinks");

  if (!appLinks && (settings.apk_url || settings.ios_url)) {
    appLinks = document.createElement("section");
    appLinks.id = "adminAppLinks";
    appLinks.className = "section";

    const guide = document.querySelector(".section .steps");
    const parent = guide?.closest(".section");

    if (parent) parent.after(appLinks);
  }

  if (appLinks) {
    appLinks.innerHTML = `
      <h2>Download Options</h2>
      <div class="actions">
        ${settings.apk_url
          ? `<a class="btn" href="${esc(settings.apk_url)}"
               target="_blank" rel="noopener noreferrer">Download APK ↗</a>`
          : ""}
        ${settings.ios_url
          ? `<a class="btn secondary" href="${esc(settings.ios_url)}"
               target="_blank" rel="noopener noreferrer">iOS Download ↗</a>`
          : ""}
      </div>
    `;
  }

  // Installation instructions
  renderInstallationGuide(settings.installation_guide);

  // Extra links
  const oldLinks = document.getElementById("adminExtraLinks");
  if (oldLinks) oldLinks.remove();

  const community = document.getElementById("community");

  if (community) {
    community.insertAdjacentHTML(
      "beforebegin",
      renderExtraLinks(settings.extra_links)
    );
  }
}

async function loadGameSettings(client, gameName) {
  try {
    const { data, error } = await client
      .from("game_settings")
      .select("*")
      .eq("game_name", gameName)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      renderGameSettings(data);
    }

  } catch (error) {
    console.error("Game settings error:", error);
  }
}

// STARTUP

async function loadGameData(gameName) {
  const status = document.getElementById("codeLoadStatus");

  try {
    const client = getClient();

    await Promise.all([
      loadGameSettings(client, gameName),
      loadGiftCodes(client, gameName),
      loadAnnouncements(client, gameName)
    ]);

  } catch (error) {
    if (status) {
      status.textContent = error.message;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const gameName = document.body.dataset.game;

  if (!gameName) return;

  if (!window.supabase) {
    const script = document.createElement("script");

    script.src =
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

    script.onload = () => loadGameData(gameName);

    script.onerror = () => {
      const status = document.getElementById("codeLoadStatus");
      if (status) status.textContent = "Could not load Supabase.";
    };

    document.head.appendChild(script);

  } else {
    loadGameData(gameName);
  }
});
