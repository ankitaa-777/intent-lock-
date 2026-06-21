// common.js — shared messaging layer for newtab.js and popup.js
//
// Inside the real extension this just forwards to background.js via
// chrome.runtime.sendMessage. If the page is opened directly as a plain
// HTML file (no extension context), it falls back to a small localStorage
// mock so you can preview the UI without loading the unpacked extension.

const hasExtensionAPI = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function sendMessage(msg) {
  if (hasExtensionAPI) {
    return chrome.runtime.sendMessage(msg);
  }
  return Promise.resolve(localFallback(msg));
}

// --- preview-only fallback ---------------------------------------------------

function readLocal() {
  const session = JSON.parse(localStorage.getItem("il_session") || "null");
  const history = JSON.parse(localStorage.getItem("il_history") || "[]");
  return { session, history };
}

function writeLocal({ session, history }) {
  localStorage.setItem("il_session", JSON.stringify(session ?? null));
  localStorage.setItem("il_history", JSON.stringify(history ?? []));
}

function closeSessionLocal(session) {
  const endTime = Date.now();
  return {
    dateKey: session.dateKey,
    intent: session.intent,
    startTime: session.startTime,
    endTime,
    durationMin: Math.max(1, Math.round((endTime - session.startTime) / 60000)),
    distractionCount: session.distractionCount,
  };
}

function computeStats(history) {
  const days = new Set(history.map((h) => h.dateKey));
  const totalDistractions = history.reduce((sum, h) => sum + (h.distractionCount || 0), 0);
  return {
    totalSessions: history.length,
    daysActive: days.size,
    totalDistractions,
  };
}

function localFallback(msg) {
  let { session, history } = readLocal();

  switch (msg.type) {
    case "GET_STATE": {
      if (session && session.dateKey !== todayKey()) {
        history = [closeSessionLocal(session), ...history].slice(0, 200);
        session = null;
      }
      writeLocal({ session, history });
      return { session, history, stats: computeStats(history) };
    }
    case "START_SESSION": {
      const intent = (msg.intent || "").trim().slice(0, 120);
      if (!intent) return { error: "empty" };
      session = {
        intent,
        startTime: Date.now(),
        dateKey: todayKey(),
        distractionCount: 0,
        lastDriftAt: null,
      };
      writeLocal({ session, history });
      return { session };
    }
    case "END_SESSION": {
      if (!session) return { session: null, history };
      history = [closeSessionLocal(session), ...history].slice(0, 200);
      session = null;
      writeLocal({ session, history });
      return { session, history, stats: computeStats(history) };
    }
    case "CLEAR_HISTORY": {
      history = [];
      writeLocal({ session, history });
      return { session, history, stats: computeStats(history) };
    }
    default:
      return { error: "unknown message type" };
  }
}

function formatElapsed(startTime) {
  const totalSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
