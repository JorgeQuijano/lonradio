// lonradio — channel directory + player + live log
// All streams are public embeds from upstream providers; we never proxy their bytes.

const CHANNELS = [
  {
    id: "cyxu-tower",
    icon: "🛫",
    name: "CYXU Tower",
    freq: "119.4 MHz",
    sub: "London Intl Airport — Tower (North + South)",
    agency: "NAV Canada",
    type: "ATC",
    url: "https://www.liveatc.net/hlisten.php?mount=cyxu1_twr",
    source: "LiveATC",
    sourceUrl: "https://www.liveatc.net/hlisten.php?mount=cyxu1_twr",
    live: true,
  },
  {
    id: "cyxu-ground",
    icon: "🛬",
    name: "CYXU Ground",
    freq: "121.9 MHz",
    sub: "London Intl Airport — Ground control",
    agency: "NAV Canada",
    type: "ATC",
    url: "https://www.liveatc.net/hlisten.php?mount=cyxu1_gnd",
    source: "LiveATC",
    sourceUrl: "https://www.liveatc.net/hlisten.php?mount=cyxu1_gnd",
    live: true,
  },
  {
    id: "london-fire",
    icon: "🚒",
    name: "London Fire + Public Works",
    freq: "P25 OneVoice",
    sub: "Fire Dispatch · Fire-Tac · Public Works",
    agency: "City of London",
    type: "Scanner",
    url: "https://www.broadcastify.com/listen/feed/34296",
    source: "Broadcastify (community)",
    sourceUrl: "https://www.broadcastify.com/listen/feed/34296",
    live: true,
  },
  {
    id: "opp-mto",
    icon: "🚓",
    name: "OPP + MTO",
    freq: "VHF/UHF",
    sub: "Ontario Provincial Police + Ministry of Transport",
    agency: "OPP",
    type: "Scanner",
    url: "https://www.broadcastify.com/listen/feed/31107",
    source: "Broadcastify (community)",
    sourceUrl: "https://www.broadcastify.com/listen/feed/31107",
    live: true,
  },
  {
    id: "weatheradio",
    icon: "🌦️",
    name: "Weatheradio London",
    freq: "162.xxx MHz",
    sub: "Environment Canada weather alerts + forecasts",
    agency: "ECCC",
    type: "Weather",
    url: "https://www.canada.ca/en/environment-climate-change/services/weatheradio/find-your-network/ontario.html",
    source: "Canada.ca",
    sourceUrl: "https://www.canada.ca/en/environment-climate-change/services/weatheradio/find-your-network/ontario.html",
    live: true,
    note: "Requires an SDR receiver (RTL-SDR, etc.) — included for reference; no public internet stream.",
  },
  {
    id: "lps-police",
    icon: "🔒",
    name: "London Police Service",
    freq: "P25 PSRN",
    sub: "Encrypted — not streamable",
    agency: "LPS",
    type: "Encrypted",
    url: null,
    live: false,
    encrypted: true,
    note: "Migrated to Ontario PSRN; AES encrypted. Cannot be legally received or streamed.",
  },
  {
    id: "ems-dispatch",
    icon: "🔒",
    name: "EMS Dispatch",
    freq: "P25 PSRN",
    sub: "Encrypted — not streamable",
    agency: "Ontario CACC",
    type: "Encrypted",
    url: null,
    live: false,
    encrypted: true,
    note: "Moved to Ontario PSRN and encrypted in 2024. Not streamable.",
  },
];

// State
let currentId = null;
let audio = null;
let analyser = null;
let canvasCtx = null;
let rafId = null;
let log = [];
let startedAt = 0;

// DOM
const $channels = document.getElementById("channels");
const $cards = document.getElementById("cards");
const $nowTitle = document.getElementById("now-title");
const $nowMeta = document.getElementById("now-meta");
const $playerTitle = document.getElementById("player-title");
const $playerSub = document.getElementById("player-sub");
const $playBtn = document.getElementById("play-btn");
const $playIcon = document.getElementById("play-icon");
const $volume = document.getElementById("volume");
const $status = document.getElementById("status");
const $statusText = document.getElementById("status-text");
const $loading = document.getElementById("loading");
const $loadingElapsed = document.getElementById("loading-elapsed");
const $log = document.getElementById("log");
const $logCount = document.getElementById("log-count");
const $themeToggle = document.getElementById("theme-toggle");
const $canvas = document.getElementById("viz");

function renderSidebar() {
  $channels.innerHTML = CHANNELS.map(c => `
    <button class="channel" role="listitem" data-id="${c.id}" aria-selected="${c.id === currentId}">
      <span class="channel-icon" aria-hidden="true">${c.icon}</span>
      <span>
        <div class="channel-name">${c.name}</div>
        <div class="channel-freq">${c.freq}</div>
      </span>
      <span class="channel-dot ${c.encrypted ? "encrypted" : c.live ? "live" : ""}" title="${c.encrypted ? "Encrypted" : "Live"}"></span>
    </button>
  `).join("");
  $channels.querySelectorAll(".channel").forEach(el => {
    el.addEventListener("click", () => selectChannel(el.dataset.id));
  });
}

function renderCards(c) {
  if (!c) { $cards.innerHTML = ""; return; }
  const items = [
    { label: "Channel", value: c.name },
    { label: "Frequency", value: c.freq },
    { label: "Agency", value: c.agency },
    { label: "Type", value: c.type },
  ];
  $cards.innerHTML = items.map(i => `
    <div class="card">
      <div class="card-label">${i.label}</div>
      <div class="card-value">${i.value}</div>
    </div>
  `).join("") + (c.note ? `
    <div class="card" style="grid-column: 1/-1">
      <div class="card-label">Note</div>
      <div class="card-sub">${c.note}</div>
      ${c.sourceUrl ? `<a class="card-link" href="${c.sourceUrl}" target="_blank" rel="noopener">Open source ↗</a>` : ""}
    </div>
  ` : "");
}

function setStatus(state, text) {
  $status.classList.remove("live", "error");
  if (state === "live") $status.classList.add("live");
  if (state === "error") $status.classList.add("error");
  $statusText.textContent = text;
}

function showLoading(show) {
  $loading.hidden = !show;
  if (show) {
    startedAt = performance.now();
    const tick = () => {
      if (!show) return;
      const s = ((performance.now() - startedAt) / 1000).toFixed(1);
      $loadingElapsed.textContent = s + "s";
      if (show) requestAnimationFrame(tick);
    };
    tick();
  }
}

function logEntry(text) {
  const t = new Date();
  const time = t.toTimeString().slice(0, 8);
  log.unshift({ time, text });
  if (log.length > 40) log.pop();
  $log.innerHTML = log.map(e => `
    <div class="log-entry">
      <span class="log-time">${e.time}</span>
      <span class="log-text">${e.text}</span>
    </div>
  `).join("");
  $logCount.textContent = `${log.length} entries`;
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.volume = parseFloat($volume.value);
  audio.addEventListener("playing", () => {
    showLoading(false);
    setStatus("live", "live");
    $playIcon.textContent = "❚❚";
    setupAnalyser();
  });
  audio.addEventListener("waiting", () => {
    setStatus("idle", "buffering");
  });
  audio.addEventListener("error", () => {
    showLoading(false);
    setStatus("error", "stream error");
    logEntry("Stream error — provider may require manual open in a new tab.");
    $playIcon.textContent = "▶";
  });
  audio.addEventListener("pause", () => {
    setStatus("idle", "paused");
    $playIcon.textContent = "▶";
  });
  return audio;
}

function setupAnalyser() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    canvasCtx = $canvas.getContext("2d");
    draw();
  } catch (e) {
    logEntry("Audio visualization unavailable: " + e.message);
  }
}

function draw() {
  if (!analyser || !canvasCtx) return;
  const buf = new Uint8Array(analyser.frequencyBinCount);
  const drawFrame = () => {
    analyser.getByteFrequencyData(buf);
    const w = $canvas.width;
    const h = $canvas.height;
    canvasCtx.clearRect(0, 0, w, h);
    const bars = 64;
    const step = Math.floor(buf.length / bars);
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      const v = buf[i * step] / 255;
      const bh = v * h * 0.9;
      const x = i * bw;
      const y = h - bh;
      const grad = canvasCtx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, "#00d4aa");
      grad.addColorStop(1, "#00d4aa22");
      canvasCtx.fillStyle = grad;
      canvasCtx.fillRect(x + 1, y, bw - 2, bh);
    }
    rafId = requestAnimationFrame(drawFrame);
  };
  drawFrame();
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio.src = "";
  }
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  analyser = null;
  canvasCtx = null;
  if (canvasCtx) {
    canvasCtx.clearRect(0, 0, $canvas.width, $canvas.height);
  }
  $playIcon.textContent = "▶";
  setStatus("idle", "idle");
}

function selectChannel(id) {
  const c = CHANNELS.find(x => x.id === id);
  if (!c) return;
  currentId = id;
  stopAudio();
  renderSidebar();
  renderCards(c);
  $nowTitle.textContent = c.name;
  $nowMeta.textContent = c.sub;
  $playerTitle.textContent = c.name;
  $playerSub.textContent = c.freq + " · " + c.agency;
  logEntry(`Switched to ${c.name} (${c.freq})`);

  if (c.encrypted || !c.url) {
    $playBtn.disabled = true;
    setStatus("error", "unavailable");
    logEntry(`${c.name} is encrypted or has no public stream.`);
    return;
  }

  $playBtn.disabled = false;
  showLoading(true);
  setStatus("idle", "connecting");
  const a = ensureAudio();
  a.src = c.url;
  a.play().catch(err => {
    showLoading(false);
    setStatus("error", "blocked");
    logEntry("Autoplay blocked — click play to start.");
    console.warn(err);
  });
}

$playBtn.addEventListener("click", () => {
  if (!audio || !currentId) return;
  if (audio.paused) {
    audio.play().catch(e => logEntry("Play failed: " + e.message));
  } else {
    audio.pause();
  }
});

$volume.addEventListener("input", () => {
  if (audio) audio.volume = parseFloat($volume.value);
});

$themeToggle.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "light" ? "" : "light";
  if (next) document.documentElement.setAttribute("data-theme", next);
  else document.documentElement.removeAttribute("data-theme");
  localStorage.setItem("lonradio-theme", next);
});

(function init() {
  const saved = localStorage.getItem("lonradio-theme");
  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
  renderSidebar();
  selectChannel("cyxu-tower"); // default: airport tower (always chatty)
})();