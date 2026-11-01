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

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (_) {
    return "";
  }
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
          <button type="button" data-copy-code="${esc(code)}">Copy</button>
        </div>
      `).join("")
    : '<p class="muted">No active gift codes found.</p>';

  area.querySelectorAll("[data-copy-code]").forEach(button => {
    button.addEventListener("click", () => copyText(button.dataset.copyCode || "", button));
  });
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
      .in("game_name", [gameName, "All Games"])
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
  return document.querySelector(".game-hero-copy > p, .hero > p");
}

function renderExtraLinks(links) {
  if (!Array.isArray(links) || !links.length) return "";

  return `
    <section class="section" id="adminExtraLinks">
      <h2>Useful Links</h2>
      <div class="actions">
        ${links.map(link => {
          if (!link || typeof link !== "object") return "";
          const url = safeHttpUrl(link.url);
          if (!url) return "";

          return `
            <a class="btn secondary"
               href="${esc(url)}"
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

function applyShareLock(enabled) {
  if (!enabled) return;

  document.body.classList.add("share-lock-enabled");
  document.body.dataset.shareLock = "true";

  // Hide site navigation and internal links that leave this game page.
  const style = document.createElement("style");
  style.id = "shareLockStyles";
  style.textContent = `
    .share-lock-enabled header nav,
    .share-lock-enabled footer a[href*="index.html"],
    .share-lock-enabled a[href$=".html"]:not([href*="#"]) {
      display: none !important;
    }
    .share-lock-banner {
      margin: 12px auto;
      max-width: 1100px;
      padding: 10px 14px;
      border: 1px solid rgba(120,190,255,.35);
      border-radius: 10px;
      color: #dceeff;
      background: rgba(24,55,82,.75);
      text-align: center;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);

  const banner = document.createElement("div");
  banner.className = "share-lock-banner";
  banner.textContent = "🔒 This shared game page is in focused mode.";
  const main = document.querySelector("main");
  if (main) main.prepend(banner);

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    let isInternalPage = false;
    try {
      const target = new URL(href, window.location.href);
      const internalPages = new Set(["index.html", "wos-v4.html", "v5-europe.html", "v5-china.html", "kingshot-v4.html"]);
      isInternalPage = target.origin === window.location.origin && internalPages.has(target.pathname.split("/").pop().toLowerCase());
    } catch (_) {}
    if (isInternalPage) {
      event.preventDefault();
      event.stopPropagation();
      banner.textContent = "🔒 Navigation is disabled on this shared game page.";
    }
  }, true);
}

function addGameShareButton(settings) {
  if (settings.share_enabled !== true) return;

  const actions = document.querySelector(".game-hero-copy .actions, .hero .actions");
  if (!actions || document.getElementById("gameShareButton")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "gameShareButton";
  button.className = "btn secondary";
  button.textContent = "↗ Share This Page";

  button.addEventListener("click", async () => {
    const shareData = {
      title: document.title,
      text: document.querySelector(".game-hero-copy h1, .hero h1")?.textContent || "Frost Survival",
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareData.url);
        button.textContent = "Link Copied!";
        setTimeout(() => button.textContent = "↗ Share This Page", 1600);
      } else {
        window.prompt("Copy this page link:", shareData.url);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        window.prompt("Copy this page link:", shareData.url);
      }
    }
  });

  actions.appendChild(button);
}

function renderGameSettings(settings) {
  if (!settings) return;

  addGameShareButton(settings);

  if (settings.share_lock === true) applyShareLock(true);

  // Description
  const description = findHeroDescription();

  if (description && settings.description) {
    description.textContent = settings.description;
  }

  // Main download button
  const downloadButton = document.querySelector(".game-hero-copy .actions .btn:not(.secondary), .hero .actions .btn:not(.secondary)");

  const downloadURL =
    settings.download_url || settings.registration_url;

  const safeDownloadURL = safeHttpUrl(downloadURL);
  if (downloadButton && safeDownloadURL) {
    downloadButton.href = safeDownloadURL;
  }

  // Version information
  if (settings.version_info) {
    let versionBox = document.getElementById("adminVersionInfo");

    if (!versionBox) {
      versionBox = document.createElement("div");
      versionBox.id = "adminVersionInfo";
      versionBox.className = "notice";

      const hero = document.querySelector(".game-hero-copy, .hero");
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
      <button type="button" data-copy-promoter="${esc(settings.promoter_code)}">
        Copy Code
      </button>
    `;
    promoterBox.querySelector("[data-copy-promoter]")?.addEventListener("click", event => {
      copyText(event.currentTarget.dataset.copyPromoter || "", event.currentTarget);
    });
  }

  // APK and iOS links
  let appLinks = document.getElementById("adminAppLinks");

  const safeApkURL = safeHttpUrl(settings.apk_url);
  const safeIosURL = safeHttpUrl(settings.ios_url);

  if (!appLinks && (safeApkURL || safeIosURL)) {
    appLinks = document.createElement("section");
    appLinks.id = "adminAppLinks";
    appLinks.className = "section";

    const guide = document.querySelector(".section .steps");
    const parent = guide?.closest(".section");

    if (parent) parent.after(appLinks);
  }

  if (appLinks) {
    appLinks.innerHTML = (safeApkURL || safeIosURL) ? `
      <h2>Download Options</h2>
      <div class="actions">
        ${safeApkURL
          ? `<a class="btn" href="${esc(safeApkURL)}"
               target="_blank" rel="noopener noreferrer">Download APK ↗</a>`
          : ""}
        ${safeIosURL
          ? `<a class="btn secondary" href="${esc(safeIosURL)}"
               target="_blank" rel="noopener noreferrer">iOS Download ↗</a>`
          : ""}
      </div>
    ` : "";
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


// HOMEPAGE LIVE REWARDS + NEWS
const HOME_GAMES = [
  { name: "Whiteout Survival V4", label: "WOS V4", href: "wos-v4.html" },
  { name: "Whiteout Survival V5 Europe", label: "WOS V5 Europe", href: "v5-europe.html" },
  { name: "Whiteout Survival V5 China", label: "WOS V5 China", href: "v5-china.html" },
  { name: "KingShot V4", label: "KingShot V4", href: "kingshot-v4.html" }
];

async function loadHomepageHub(client) {
  const rewards = document.getElementById("homeRewards");
  const news = document.getElementById("homeNews");
  if (!rewards && !news) return;

  if (rewards) {
    try {
      const { data, error } = await client.from("gift_codes")
        .select("game_name,code,created_at")
        .eq("active", true).order("created_at", { ascending: false }).limit(40);
      if (error) throw error;
      const rows = data || [];
      rewards.innerHTML = rows.length ? rows.map(row => {
        const game = HOME_GAMES.find(item => item.name === row.game_name);
        return `<article class="hub-card reward-card"><span class="hub-tag">${esc(game?.label || row.game_name || "Game")}</span><h3>${esc(row.code)}</h3><p>Active gift code. Availability may change; redeem in the matching game.</p><div class="hub-card-actions"><button class="btn" type="button" data-home-copy="${esc(row.code || "")}">Copy Code</button><a class="outline-link" href="${esc(game?.href || "#games")}">Game page →</a></div></article>`;
      }).join("") : '<div class="hub-card"><h3>No active codes yet</h3><p>New codes will appear here when the team publishes them.</p></div>';
      rewards.querySelectorAll("[data-home-copy]").forEach(button => {
        button.addEventListener("click", () => copyText(button.dataset.homeCopy || "", button));
      });
      const status = document.getElementById("homeRewardsStatus");
      if (status) status.textContent = rows.length ? `${rows.length} active code entries loaded from the database.` : "No active codes currently published.";
    } catch (error) {
      rewards.innerHTML = '<div class="hub-card"><h3>Rewards temporarily unavailable</h3><p>Please try again later or check the game pages.</p></div>';
      const status = document.getElementById("homeRewardsStatus");
      if (status) status.textContent = "Could not connect to the rewards database.";
    }
  }

  if (news) {
    try {
      const { data, error } = await client.from("announcements")
        .select("title,message,game_name,created_at")
        .order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      const rows = data || [];
      news.innerHTML = rows.length ? rows.map(item => {
        const game = HOME_GAMES.find(g => g.name === item.game_name);
        const date = item.created_at ? new Date(item.created_at).toLocaleDateString() : "";
        return `<article class="hub-card news-card"><span class="hub-tag">${esc(item.game_name || "All Games")}</span><h3>${esc(item.title || "Frost Survival Update")}</h3><p>${esc(item.message || "")}</p><small>${esc(date)}</small>${game ? `<p><a class="outline-link" href="${esc(game.href)}">Open game page →</a></p>` : ""}</article>`;
      }).join("") : '<div class="hub-card"><h3>No announcements yet</h3><p>Team news and updates will appear here when published.</p></div>';
      const status = document.getElementById("homeNewsStatus");
      if (status) status.textContent = rows.length ? "Showing the latest published announcements." : "No news currently published.";
    } catch (error) {
      news.innerHTML = '<div class="hub-card"><h3>News temporarily unavailable</h3><p>Please check again later.</p></div>';
      const status = document.getElementById("homeNewsStatus");
      if (status) status.textContent = "Could not connect to the announcements database.";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("homeRewards") && !document.getElementById("homeNews")) return;
  const start = () => {
    try { loadHomepageHub(getClient()); }
    catch (error) {
      const status = document.getElementById("homeRewardsStatus");
      if (status) status.textContent = "Rewards database could not be initialized.";
    }
  };
  if (window.supabase) start();
  else {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = start;
    script.onerror = () => {
      const status = document.getElementById("homeRewardsStatus");
      if (status) status.textContent = "Could not load the rewards service.";
    };
    document.head.appendChild(script);
  }
});
