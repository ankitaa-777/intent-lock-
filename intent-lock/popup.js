// popup.js — Intent Lock

const currentEl = document.getElementById("current");
const historyEl = document.getElementById("history");
const clearBtn = document.getElementById("clearBtn");

let timerInterval = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderCurrent(session) {
  if (!session) {
    currentEl.classList.add("empty");
    currentEl.innerHTML = `<div class="intent">open a new tab to set today's intent</div>`;
    if (timerInterval) clearInterval(timerInterval);
    return;
  }
  currentEl.classList.remove("empty");
  currentEl.innerHTML = `
    <div class="label">right now</div>
    <div class="intent">${escapeHtml(session.intent)}</div>
    <div class="timer" id="popTimer">${formatElapsed(session.startTime)}</div>
  `;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const el = document.getElementById("popTimer");
    if (el) el.textContent = formatElapsed(session.startTime);
  }, 1000);
}

function renderHistory(history) {
  if (!history.length) {
    historyEl.innerHTML = `<li class="empty-history">nothing logged yet — lock in an intent from a new tab.</li>`;
    return;
  }
  historyEl.innerHTML = history
    .slice(0, 6)
    .map((h) => {
      const caught = h.distractionCount > 0 ? `<span class="caught">${h.distractionCount} caught</span>` : "";
      return `<li>
        <span class="h-intent" title="${escapeHtml(h.intent)}">${escapeHtml(h.intent)}</span>
        <span class="h-meta">${formatDate(h.dateKey)} · ${h.durationMin}m ${caught}</span>
      </li>`;
    })
    .join("");
}

async function refresh() {
  const res = await sendMessage({ type: "GET_STATE" });
  renderCurrent(res.session);
  renderHistory(res.history);
}

clearBtn.addEventListener("click", async () => {
  if (!confirm("Clear all logged history? This can't be undone.")) return;
  const res = await sendMessage({ type: "CLEAR_HISTORY" });
  renderHistory(res.history);
});

refresh();
