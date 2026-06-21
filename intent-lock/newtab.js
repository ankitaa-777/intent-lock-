// newtab.js — Intent Lock

const N_BLADES = 8;
const OUTER_R = 90;
const HOLE_CLOSED = 14; // focused: aperture stopped down
const HOLE_OPEN = 58;   // no intent set: aperture wide open
const OVERLAP_DEG = 7;

const bladesGroup = document.getElementById("blades");
const frame = document.getElementById("frame");
const readout = document.getElementById("readout");
const hint = document.getElementById("hint");
const toast = document.getElementById("toast");

// build the 8 blade <path> elements once
for (let i = 0; i < N_BLADES; i++) {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.dataset.index = i;
  bladesGroup.appendChild(p);
}

function annularSectorPath(cx, cy, rInner, rOuter, startDeg, endDeg) {
  const pt = (r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const [x1, y1] = pt(rOuter, startDeg);
  const [x2, y2] = pt(rOuter, endDeg);
  const [x3, y3] = pt(rInner, endDeg);
  const [x4, y4] = pt(rInner, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

function paintAperture(openness) {
  const holeR = HOLE_CLOSED + (HOLE_OPEN - HOLE_CLOSED) * openness;
  const sector = 360 / N_BLADES;
  bladesGroup.querySelectorAll("path").forEach((p) => {
    const i = Number(p.dataset.index);
    const start = i * sector - OVERLAP_DEG;
    const end = i * sector + sector + OVERLAP_DEG;
    p.setAttribute("d", annularSectorPath(100, 100, holeR, OUTER_R, start, end));
  });
}

// --- animation: ease current openness toward a target ----------------------

let currentOpenness = 1;
let animFrame = null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateTo(target, durationMs = 550) {
  if (animFrame) cancelAnimationFrame(animFrame);
  if (reducedMotion) {
    currentOpenness = target;
    paintAperture(currentOpenness);
    return;
  }
  const start = currentOpenness;
  const t0 = performance.now();
  function step(now) {
    const t = Math.min(1, (now - t0) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    currentOpenness = start + (target - start) * eased;
    paintAperture(currentOpenness);
    if (t < 1) {
      animFrame = requestAnimationFrame(step);
    } else {
      currentOpenness = target;
    }
  }
  animFrame = requestAnimationFrame(step);
}

function driftPulse() {
  const settleTo = currentSession ? 0 : 1;
  animateTo(Math.min(0.6, settleTo + 0.55), 300);
  setTimeout(() => animateTo(settleTo, 650), 320);
}

// --- view rendering ----------------------------------------------------------

let currentSession = null;
let timerInterval = null;
let lastSeenDrift = null;

function renderEntryForm() {
  frame.innerHTML = `
    <div class="prompt">what are you actually here to do?</div>
    <input type="text" id="intentInput" placeholder="e.g. finish the lab report, not browse reddit" autocomplete="off" maxlength="120" />
  `;
  hint.textContent = "this becomes today's frame until you say otherwise.";
  document.getElementById("intentInput").focus();
  document.getElementById("intentInput").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const val = e.target.value.trim();
      if (!val) return;
      const res = await sendMessage({ type: "START_SESSION", intent: val });
      currentSession = res.session;
      lastSeenDrift = null;
      renderLockedIn();
      animateTo(0);
    }
  });
}

function renderLockedIn() {
  frame.innerHTML = `
    <div class="intent-text">${escapeHtml(currentSession.intent)}</div>
    <div class="timer" id="timer">00:00</div>
    <div class="actions">
      <button id="doneBtn" class="primary">done for now</button>
      <button id="switchBtn">new intent</button>
    </div>
  `;
  hint.textContent = "";
  tickTimer();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);

  document.getElementById("doneBtn").addEventListener("click", endSession);
  document.getElementById("switchBtn").addEventListener("click", endSession);
}

function tickTimer() {
  const el = document.getElementById("timer");
  if (el && currentSession) el.textContent = formatElapsed(currentSession.startTime);
}

async function endSession() {
  if (timerInterval) clearInterval(timerInterval);
  const res = await sendMessage({ type: "END_SESSION" });
  currentSession = null;
  renderEntryForm();
  animateTo(1);
  renderReadout(res.stats);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderReadout(stats) {
  if (!stats) return;
  const parts = [`${stats.totalSessions} logged`];
  if (stats.totalDistractions > 0) parts.push(`${stats.totalDistractions} caught`);
  readout.textContent = parts.join(" · ");
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 4000);
}

// --- boot + polling -----------------------------------------------------------

async function boot() {
  const res = await sendMessage({ type: "GET_STATE" });
  currentSession = res.session;
  renderReadout(res.stats);

  if (currentSession) {
    renderLockedIn();
    currentOpenness = 0;
    paintAperture(0);
    lastSeenDrift = currentSession.lastDriftAt || null;
  } else {
    renderEntryForm();
    currentOpenness = 1;
    paintAperture(1);
  }

  setInterval(pollForDrift, 8000);
}

async function pollForDrift() {
  const res = await sendMessage({ type: "GET_STATE" });
  if (!res.session) return;
  currentSession = res.session;
  if (res.session.lastDriftAt && res.session.lastDriftAt !== lastSeenDrift) {
    lastSeenDrift = res.session.lastDriftAt;
    driftPulse();
    showToast(`weren't you here to: "${res.session.intent}"?`);
  }
}

boot();
