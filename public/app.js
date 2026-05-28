// Frontend logic. Talks to the backend with the saved server URL + app token.
const $ = (id) => document.getElementById(id);
const cfg = {
  get server() { return localStorage.getItem("coach_server") || location.origin; },
  set server(v) { localStorage.setItem("coach_server", v); },
  get token() { return localStorage.getItem("coach_token") || ""; },
  set token(v) { localStorage.setItem("coach_token", v); },
};

function api(path, opts = {}) {
  return fetch(cfg.server + "/api" + path, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-app-token": cfg.token, ...(opts.headers || {}) },
  });
}
function urlB64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
function setStatus(msg) { $("status").textContent = msg; }

// ---- voice picker ----
let VOICES = [];
let activeVoice = "coach";
async function loadVoices() {
  try {
    const c = await (await api("/config")).json();
    VOICES = c.voices || [];
    activeVoice = c.voice || "coach";
    renderVoices();
  } catch {}
}
function renderVoices() {
  const grid = $("voiceGrid");
  if (!grid) return;
  grid.innerHTML = "";
  for (const v of VOICES) {
    const b = document.createElement("button");
    b.className = "voice-btn" + (v.id === activeVoice ? " sel" : "");
    b.innerHTML = `<span class="voice-name">${escapeHtml(v.label)}</span><span class="voice-blurb">${escapeHtml(v.blurb)}</span>`;
    b.onclick = async () => {
      const r = await api("/voice", { method: "POST", body: JSON.stringify({ voice: v.id }) });
      if (r.ok) { activeVoice = v.id; renderVoices(); setStatus(`Voice set: ${v.label}.`); }
      else setStatus("Couldn't set voice — check settings.");
    };
    grid.appendChild(b);
  }
}

// ---- service worker + push subscription ----
let swReg = null;
async function registerSW() {
  if (!("serviceWorker" in navigator)) return setStatus("This browser can't run the coach.");
  swReg = await navigator.serviceWorker.register("/sw.js");
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "open" && e.data.url) handleDeepLink(new URL(e.data.url, location.origin));
  });
}

async function enablePush() {
  try {
    if (!swReg) await registerSW();
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setStatus("Notifications blocked. Coach can't reach you.");
    const { vapidPublicKey } = await (await api("/config")).json();
    if (!vapidPublicKey) return setStatus("Server missing VAPID key — run npm run gen-vapid.");
    const sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(vapidPublicKey),
    });
    const r = await api("/subscribe", { method: "POST", body: JSON.stringify({ subscription: sub }) });
    setStatus(r.ok ? "✓ Locked in. Coach can reach this phone." : "Subscribe failed — check token/server.");
  } catch (e) { setStatus("Error: " + e.message); }
}

// ---- render today ----
function renderCheckins(checkins) {
  const ul = $("checkinList");
  ul.innerHTML = "";
  if (!checkins?.length) { ul.innerHTML = '<li class="ci-task">No check-ins scheduled.</li>'; return; }
  checkins.sort((a, b) => a.fireAt - b.fireAt);
  for (const c of checkins) {
    const li = document.createElement("li");
    const state = c.status || (c.firedAt ? "fired" : "");
    li.innerHTML = `<span class="ci-dot ${state}"></span>
      <span class="ci-time">${c.time}</span>
      <span class="ci-task">${escapeHtml(c.task || c.block)}</span>`;
    ul.appendChild(li);
  }
}
function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])); }

let CHECKINS = [];
async function loadToday() {
  try {
    const r = await api("/plan/today");
    if (!r.ok) return;
    const { plan, checkins } = await r.json();
    CHECKINS = checkins || [];
    if (plan) {
      $("planDate").textContent = plan.date + (plan.mode ? "" : "");
      $("planMode").textContent = plan.mode || "";
    }
    renderCheckins(CHECKINS);
    renderNext();
  } catch {}
}

function renderNext() {
  const upcoming = CHECKINS.filter((c) => !c.firedAt).sort((a, b) => a.fireAt - b.fireAt)[0];
  const live = $("liveCard");
  if (!upcoming) { live.classList.add("hidden"); return; }
  live.classList.remove("hidden");
  $("liveTime").textContent = upcoming.time;
  $("liveTask").textContent = upcoming.task || upcoming.block;
  const mins = Math.max(0, Math.round((upcoming.fireAt - Date.now()) / 60000));
  $("liveCountdown").textContent = mins > 90 ? `in ${Math.round(mins / 60)}h ${mins % 60}m` : `in ${mins} min`;
}

// ---- responding ----
let activeCheckin = null;
let activeStatus = null;
function openRespond(id, presetStatus) {
  activeCheckin = id; activeStatus = presetStatus || null;
  $("respondCard").classList.remove("hidden");
  document.querySelectorAll(".status-btn").forEach((b) => b.classList.toggle("sel", b.dataset.status === presetStatus));
  $("respondPrompt").textContent = "Report in.";
  $("respondCard").scrollIntoView({ behavior: "smooth" });
  if (presetStatus) sendReply(); // came from a notification action — fire immediately
}
async function sendReply() {
  if (!activeCheckin || !activeStatus) { setStatus("Pick a status first."); return; }
  const text = $("replyText").value.trim();
  const r = await api(`/checkin/${encodeURIComponent(activeCheckin)}/respond`, {
    method: "POST", body: JSON.stringify({ status: activeStatus, text }),
  });
  const data = await r.json().catch(() => ({}));
  if (data.message) {
    const v = VOICES.find((x) => x.id === activeVoice);
    document.querySelector(".coach-bubble__tag").textContent = (v?.label || "COACH").toUpperCase();
    $("coachReplyText").textContent = data.message;
    $("coachReply").classList.remove("hidden");
    $("coachReply").scrollIntoView({ behavior: "smooth" });
  }
  $("replyText").value = "";
  loadToday();
}

// ---- deep link from a notification tap ----
function handleDeepLink(url) {
  const id = url.searchParams.get("respond");
  const status = url.searchParams.get("status");
  if (id) openRespond(id, status);
}

// ---- import plan ----
async function loadPlan() {
  let plan;
  try { plan = JSON.parse($("planJson").value); }
  catch { return setStatus("That's not valid JSON."); }
  const r = await api("/plan", { method: "POST", body: JSON.stringify({ plan }) });
  const d = await r.json().catch(() => ({}));
  setStatus(r.ok ? `✓ Loaded ${d.scheduled} check-ins.` : "Load failed: " + (d.error || r.status));
  loadToday();
}

// ---- wire up ----
$("enableBtn").onclick = enablePush;
$("testBtn").onclick = async () => { const r = await api("/test-push", { method: "POST" }); setStatus(r.ok ? "Test sent." : "Failed — check settings."); };
$("loadPlanBtn").onclick = loadPlan;
$("sendReply").onclick = sendReply;
document.querySelectorAll(".status-btn").forEach((b) => b.onclick = () => {
  activeStatus = b.dataset.status;
  document.querySelectorAll(".status-btn").forEach((x) => x.classList.toggle("sel", x === b));
});
$("settingsBtn").onclick = () => {
  $("serverUrl").value = cfg.server; $("appToken").value = cfg.token; $("settingsDlg").showModal();
};
$("settingsDlg").addEventListener("close", () => {
  if ($("settingsDlg").returnValue === "save") {
    cfg.server = $("serverUrl").value.trim().replace(/\/$/, "");
    cfg.token = $("appToken").value.trim();
    setStatus("Settings saved."); loadToday();
  }
});

// ---- boot ----
(async function boot() {
  await registerSW();
  handleDeepLink(new URL(location.href));
  await loadVoices();
  await loadToday();
  setInterval(renderNext, 30000);
})();
