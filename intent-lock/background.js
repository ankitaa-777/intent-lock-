// background.js — Intent Lock
// Lives entirely in chrome.storage.local because MV3 service workers are
// ephemeral and can be killed/restarted between events at any time.

const WINDOW_MS = 10 * 60 * 1000;   // rolling window for counting new tabs
const BURST_THRESHOLD = 5;          // this many new tabs inside the window = drift
const COOLDOWN_MS = 5 * 60 * 1000;  // don't re-notify more than once per 5 min

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, local-ish enough
}

async function getAll() {
  const data = await chrome.storage.local.get(["session", "history", "tabBurstWindow"]);
  return {
    session: data.session ?? null,
    history: data.history ?? [],
    tabBurstWindow: data.tabBurstWindow ?? [],
  };
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await getAll();
  await chrome.storage.local.set(data); // ensures keys exist with sane defaults
});

// --- tab burst detection ---------------------------------------------------

chrome.tabs.onCreated.addListener(async () => {
  const { session, tabBurstWindow } = await getAll();
  if (!session) return; // only watch for drift while an intent is actually locked in

  const now = Date.now();
  const trimmed = [...tabBurstWindow, now].filter((t) => now - t < WINDOW_MS);
  await chrome.storage.local.set({ tabBurstWindow: trimmed });

  const cooledDown = !session.lastDriftAt || now - session.lastDriftAt > COOLDOWN_MS;

  if (trimmed.length >= BURST_THRESHOLD && cooledDown) {
    const updatedSession = {
      ...session,
      distractionCount: session.distractionCount + 1,
      lastDriftAt: now,
    };
    await chrome.storage.local.set({ session: updatedSession });

    const label = session.intent.length > 60
      ? session.intent.slice(0, 57) + "..."
      : session.intent;

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Quick check-in",
      message: `Weren't you here to: "${label}"?`,
      priority: 1,
    });
  }
});

// --- message handling -------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true; // keep the message channel open for the async response
});

async function handleMessage(msg) {
  const { session, history } = await getAll();

  switch (msg.type) {
    case "GET_STATE": {
      // auto-close any session left open from a previous calendar day
      if (session && session.dateKey !== todayKey()) {
        const closed = closeSession(session);
        const newHistory = [closed, ...history].slice(0, 200);
        await chrome.storage.local.set({ session: null, history: newHistory, tabBurstWindow: [] });
        return { session: null, history: newHistory, stats: computeStats(newHistory) };
      }
      return { session, history, stats: computeStats(history) };
    }

    case "START_SESSION": {
      const intent = (msg.intent || "").trim().slice(0, 120);
      if (!intent) return { error: "empty" };
      const newSession = {
        intent,
        startTime: Date.now(),
        dateKey: todayKey(),
        distractionCount: 0,
        lastDriftAt: null,
      };
      await chrome.storage.local.set({ session: newSession, tabBurstWindow: [] });
      return { session: newSession };
    }

    case "END_SESSION": {
      if (!session) return { session: null, history };
      const closed = closeSession(session);
      const newHistory = [closed, ...history].slice(0, 200);
      await chrome.storage.local.set({ session: null, history: newHistory, tabBurstWindow: [] });
      return { session: null, history: newHistory, stats: computeStats(newHistory) };
    }

    case "CLEAR_HISTORY": {
      await chrome.storage.local.set({ history: [] });
      return { session, history: [], stats: computeStats([]) };
    }

    default:
      return { error: "unknown message type" };
  }
}

function closeSession(session) {
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
