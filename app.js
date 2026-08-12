// lonradio — channel directory + iframe player + live log + map
// Audio is embedded from upstream providers via iframe; we never proxy their bytes.

const CHANNELS = [
  // Public safety — Broadcastify iframe (works cross-origin)
  {
    id: "london-fire",
    group: "public",
    icon: "🚒",
    name: "London Fire + Public Works",
    freq: "P25 OneVoice",
    sub: "Fire Dispatch · Fire-Tac · Public Works",
    agency: "City of London",
    type: "Stream",
    src: "https://www.broadcastify.com/listen/feed/34296",
    sourceLabel: "Broadcastify",
    sourceUrl: "https://www.broadcastify.com/listen/feed/34296",
    location: { lat: 42.9849, lng: -81.2453, label: "London — City Centre" },
  },
  {
    id: "middlesex-fire",
    group: "public",
    icon: "🚒",
    name: "Middlesex County Fire",
    freq: "P25",
    sub: "Fire Tac 1 + Tac 3 — county-wide tactical",
    agency: "Middlesex County",
    type: "Stream",
    src: "https://www.broadcastify.com/listen/feed/18244",
    sourceLabel: "Broadcastify",
    sourceUrl: "https://www.broadcastify.com/listen/feed/18244",
    location: { lat: 42.9649, lng: -81.2253, label: "Middlesex County" },
  },
  {
    id: "timmins-atc",
    group: "public",
    icon: "✈️",
    name: "Timmins Airport ATC",
    freq: "VHF",
    sub: "Flight Service + local area traffic (closest public aviation stream)",
    agency: "NAV Canada",
    type: "Stream",
    src: "https://www.broadcastify.com/listen/feed/35818",
    sourceLabel: "Broadcastify",
    sourceUrl: "https://www.broadcastify.com/listen/feed/35818",
    note: "CYXU Tower/Ground are linked out below — LiveATC blocks embedding.",
    location: { lat: 48.5697, lng: -81.3767, label: "Timmins (CYTS)" },
  },
  // Aviation — LiveATC external (Cloudflare-protected, won't iframe cleanly)
  {
    id: "cyxu-tower",
    group: "aviation",
    icon: "🛫",
    name: "CYXU Tower",
    freq: "119.4 MHz",
    sub: "London Intl Airport — Tower (North + South)",
    agency: "NAV Canada",
    type: "External",
    sourceLabel: "LiveATC",
    sourceUrl: "https://www.liveatc.net/hlisten.php?mount=cyxu1_twr",
    location: { lat: 43.0356, lng: -81.1539, label: "London International (CYXU)" },
  },
  {
    id: "cyxu-ground",
    group: "aviation",
    icon: "🛬",
    name: "CYXU Ground",
    freq: "121.9 MHz",
    sub: "London Intl Airport — Ground control",
    agency: "NAV Canada",
    type: "External",
    sourceLabel: "LiveATC",
    sourceUrl: "https://www.liveatc.net/hlisten.php?mount=cyxu1_gnd",
    location: { lat: 43.0356, lng: -81.1539, label: "London International (CYXU)" },
  },
  // Weather — reference (no public internet stream)
  {
    id: "weatheradio",
    group: "weather",
    icon: "🌦️",
    name: "Weatheradio London",
    freq: "162.xxx MHz VHF",
    sub: "Environment Canada weather alerts + forecasts",
    agency: "ECCC",
    type: "Reference",
    sourceLabel: "Canada.ca",
    sourceUrl: "https://www.canada.ca/en/environment-climate-change/services/weatheradio/find-your-network/ontario.html",
    note: "No public internet stream. Receive with an SDR (RTL-SDR v3 + rtl_fm).",
    location: { lat: 42.9849, lng: -81.2453, label: "London transmitter" },
  },
  // Unavailable — encrypted
  {
    id: "lps-police",
    group: "locked",
    icon: "🔒",
    name: "London Police Service",
    freq: "P25 PSRN",
    sub: "Encrypted — not streamable",
    agency: "LPS",
    type: "Encrypted",
    note: "Migrated to Ontario PSRN; AES encrypted. Cannot be legally received or streamed.",
  },
  {
    id: "ems-dispatch",
    group: "locked",
    icon: "🔒",
    name: "EMS Dispatch",
    freq: "P25 PSRN",
    sub: "Encrypted — not streamable",
    agency: "Ontario CACC",
    type: "Encrypted",
    note: "Moved to Ontario PSRN and encrypted in 2024. Not streamable.",
  },
];

const GROUPS = {
  public: document.getElementById("channels-public"),
  aviation: document.getElementById("channels-aviation"),
  weather: document.getElementById("channels-weather"),
  locked: document.getElementById("channels-locked"),
};

// State
let currentId = null;
let logEntries = [];
let iframeLoadTimer = null;
let map = null;
let markers = [];

// DOM
const $nowTitle = document.getElementById("now-title");
const $nowMeta = document.getElementById("now-meta");
const $headerTag = document.getElementById("header-tag");
const $status = document.getElementById("status");
const $statusText = document.getElementById("status-text");
const $iframe = document.getElementById("player-iframe");
const $cta = document.getElementById("player-cta");
const $ctaIcon = document.getElementById("cta-icon");
const $ctaTitle = document.getElementById("cta-title");
const $ctaSub = document.getElementById("cta-sub");
const $ctaLink = document.getElementById("cta-link");
const $ctaSource = document.getElementById("cta-source");
const $ctaPopout = document.getElementById("cta-popout");
const $log = document.getElementById("log");
const $logCount = document.getElementById("log-count");
const $themeToggle = document.getElementById("theme-toggle");
const $cards = document.getElementById("cards");
const $clock = document.getElementById("clock");

// ---------- Sidebar ----------
function renderSidebar() {
  for (const [group, el] of Object.entries(GROUPS)) {
    if (!el) continue;
    const items = CHANNELS.filter(c => c.group === group);
    el.innerHTML = items.map(c => {
      const dotClass = c.type === "Encrypted" ? "encrypted" :
                       c.type === "External" ? "external" :
                       c.type === "Reference" ? "reference" :
                       "live";
      const disabled = c.type === "Encrypted";
      return `
        <button class="channel" role="listitem" data-id="${c.id}" aria-selected="${c.id === currentId}" ${disabled ? "disabled title=\"Encrypted — cannot stream\"" : ""}>
          <span class="channel-icon" aria-hidden="true">${c.icon}</span>
          <span>
            <div class="channel-name">${c.name}</div>
            <div class="channel-freq">${c.freq}</div>
          </span>
          <span class="channel-dot ${dotClass}" title="${c.type}"></span>
        </button>
      `;
    }).join("");
  }
  document.querySelectorAll(".channel[data-id]").forEach(el => {
    el.addEventListener("click", () => {
      if (el.disabled) return;
      selectChannel(el.dataset.id);
    });
  });
}

// ---------- Header + cards ----------
function setHeader(c) {
  $headerTag.textContent = c.type === "Stream" ? "Live stream" :
                           c.type === "External" ? "External link" :
                           c.type === "Reference" ? "Reference" :
                           "Unavailable";
  $headerTag.className = "header-tag tag-" + c.type.toLowerCase();
  $nowTitle.textContent = c.name;
  $nowMeta.textContent = c.sub;
}

function renderCards(c) {
  const items = [
    { label: "Channel", value: c.name },
    { label: "Frequency", value: c.freq },
    { label: "Agency", value: c.agency },
    { label: "Type", value: c.type },
    { label: "Source", value: c.sourceLabel || "—" },
  ];
  if (c.location) items.push({ label: "Coverage", value: c.location.label });
  $cards.innerHTML = items.map(i => `
    <div class="card">
      <div class="card-label">${i.label}</div>
      <div class="card-value">${i.value}</div>
    </div>
  `).join("");
  if (c.note || c.sourceUrl) {
    $cards.innerHTML += `
      <div class="card" style="grid-column: 1/-1">
        <div class="card-label">${c.note ? "Note" : "Source"}</div>
        ${c.note ? `<div class="card-sub">${c.note}</div>` : ""}
        ${c.sourceUrl ? `<a class="card-link" href="${c.sourceUrl}" target="_blank" rel="noopener noreferrer">Open ${c.sourceLabel} ↗</a>` : ""}
      </div>
    `;
  }
}

// ---------- Status ----------
function setStatus(state, text) {
  $status.classList.remove("live", "error", "buffering", "ready");
  $status.classList.add(state);
  $statusText.textContent = text;
}

// ---------- Activity log ----------
function logEntry(text, kind = "") {
  const t = new Date();
  const time = t.toTimeString().slice(0, 8);
  logEntries.unshift({ time, text, kind });
  if (logEntries.length > 60) logEntries.pop();
  $log.innerHTML = logEntries.map(e => `
    <div class="log-entry">
      <span class="log-time">${e.time}</span>
      <span class="log-text ${e.kind ? "log-" + e.kind : ""}">${e.text}</span>
    </div>
  `).join("");
  $logCount.textContent = `${logEntries.length} entries`;
}

// ---------- Player surfaces ----------
function showIframe(url) {
  $cta.hidden = true;
  $iframe.hidden = false;
  setStatus("buffering", "loading…");
  if (iframeLoadTimer) clearTimeout(iframeLoadTimer);
  iframeLoadTimer = setTimeout(() => {
    setStatus("live", "ready");
    logEntry("Feed loaded", "event");
  }, 2500);
  // Force reload by setting src
  if ($iframe.src !== url) $iframe.src = url;
}

function showCta(c) {
  $iframe.hidden = true;
  $iframe.removeAttribute("src");
  $cta.hidden = false;

  let icon = "📡", title = "Open in new tab", sub = "";
  if (c.type === "External") {
    icon = "🔗";
    title = "External audio source";
    sub = `This feed is on ${c.sourceLabel}. LiveATC and other providers block direct embedding, so we link you straight to it.`;
  } else if (c.type === "Reference") {
    icon = "📻";
    title = "Receive with an SDR";
    sub = "No public internet stream exists. Pick up this frequency with a $35 RTL-SDR dongle.";
  } else if (c.type === "Encrypted") {
    icon = "🔒";
    title = "Encrypted — cannot stream";
    sub = c.note || "This channel is encrypted and cannot be legally received or streamed.";
  }
  $ctaIcon.textContent = icon;
  $ctaTitle.textContent = title;
  $ctaSub.textContent = sub;
  $ctaLink.href = c.sourceUrl || "#";
  $ctaSource.textContent = c.sourceLabel || "source";
  $ctaLink.textContent = "";
  $ctaLink.appendChild(document.createTextNode(""));
  const linkText = document.createTextNode("");
  $ctaLink.innerHTML = `Open <span>${c.sourceLabel || "source"}</span> ↗`;

  // Pop out button opens in a small window for quick toggle
  $ctaPopout.onclick = () => window.open(c.sourceUrl, `${c.id}`, "width=420,height=520");
}

// ---------- Channel switching ----------
function selectChannel(id) {
  const c = CHANNELS.find(x => x.id === id);
  if (!c) return;
  const prevId = currentId;
  currentId = id;
  renderSidebar();
  renderCards(c);
  setHeader(c);
  logEntry(`Switched to ${c.name} (${c.freq})`);

  if (c.location) focusMapOn(c.location);

  if (c.type === "Stream") {
    showIframe(c.src);
  } else {
    showCta(c);
    if (c.type === "External") setStatus("ready", "external link");
    else if (c.type === "Reference") setStatus("ready", "reference");
    else if (c.type === "Encrypted") setStatus("error", "encrypted");
  }
}

// ---------- Controls ----------
let tileLayer = null;
$themeToggle.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "light" ? "" : "light";
  if (next) document.documentElement.setAttribute("data-theme", next);
  else document.documentElement.removeAttribute("data-theme");
  localStorage.setItem("lonradio-theme", next);
  // Swap map tiles to match theme
  if (map) {
    if (tileLayer) map.removeLayer(tileLayer);
    const isLight = next === "light";
    const url = isLight
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    tileLayer = L.tileLayer(url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);
  }
});

// ---------- Map ----------
function initMap() {
  if (typeof L === "undefined") {
    logEntry("Leaflet failed to load — map disabled", "warn");
    return;
  }
  map = L.map("map", { scrollWheelZoom: false }).setView([42.98, -81.25], 8);
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  const tileUrl = isLight
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  tileLayer = L.tileLayer(tileUrl, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 18,
  }).addTo(map);
  for (const c of CHANNELS) {
    if (!c.location) continue;
    const color = c.type === "Encrypted" ? "#ffb84d" :
                   c.type === "External" ? "#8a8a93" :
                   c.type === "Reference" ? "#ffb84d" :
                   "#00d4aa";
    const m = L.circleMarker([c.location.lat, c.location.lng], {
      radius: c.group === "aviation" ? 10 : 8,
      color,
      weight: 2,
      fillOpacity: 0.4,
    }).addTo(map);
    m.bindPopup(`<strong>${c.name}</strong><br>${c.freq}<br><small>${c.location.label}</small>`);
    m.on("click", () => {
      if (c.type !== "Encrypted") selectChannel(c.id);
    });
    markers.push(m);
  }
}

function focusMapOn(loc) {
  if (!map || !loc) return;
  map.flyTo([loc.lat, loc.lng], Math.max(map.getZoom(), 9), { duration: 0.6 });
  const m = markers.find(mm => {
    const ll = mm.getLatLng();
    return Math.abs(ll.lat - loc.lat) < 0.001 && Math.abs(ll.lng - loc.lng) < 0.001;
  });
  if (m) m.openPopup();
}

// ---------- Clock ----------
function tickClock() {
  if (!$clock) return;
  const d = new Date();
  $clock.textContent = d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false }) + " ET";
}
setInterval(tickClock, 30000);

// ---------- Init ----------
(function init() {
  const saved = localStorage.getItem("lonradio-theme");
  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
  tickClock();
  renderSidebar();
  initMap();
  selectChannel("london-fire"); // default to London Fire
})();