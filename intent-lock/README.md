# Intent Lock

A new-tab takeover for the exact moment your focus usually dies: the second you open a laptop and forget why.

Every time you open a new tab, Intent Lock asks you one question — *what are you actually here to do* — and locks that intent in as a small brass aperture that closes down while you work. Open a burst of unrelated tabs and it flickers, nudges you with a one-line notification, and quietly logs the catch. Say you're done, and it gets filed into a tiny history so you can see, over time, whether you're actually following through.

No streaks, no guilt bars, no gamified nagging. Just a single honest question, asked at the one moment that matters.

## Why this exists

I kept opening my laptop with something specific in mind and ending up twenty tabs deep doing everything and nothing. This is the smallest possible tool that interrupts that pattern — built in a weekend, for myself first.

## How it works

- **New tab → one question.** No intent set yet? You get a short prompt instead of your usual new-tab page.
- **The aperture.** A brass iris animates closed the moment your intent is locked in — visually, you're "in focus." It's the one indulgent design detail in an otherwise quiet UI.
- **Drift detection.** Opening a burst of new tabs while an intent is active (5+ within 10 minutes) triggers a gentle one-line notification reminding you what you said you'd do, and ticks up a "caught" counter. No tracking of *what* the tabs are — just how many, how fast.
- **The popup.** Click the toolbar icon any time to see your current intent, a live timer, and your recent history (intent, duration, distractions caught).
- **Everything is local.** All data lives in `chrome.storage.local` on your machine. Nothing is sent anywhere.

## Install it

This isn't on the Chrome Web Store — load it as an unpacked extension:

1. Download/clone this repo.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. Open a new tab.

## Preview without installing

`newtab.html` and `popup.html` fall back to `localStorage` if there's no extension context, so you can just open `newtab.html` directly in a browser tab to click around the UI. (Drift notifications won't fire in this mode — that part genuinely needs the extension's background worker.)

## Stack

Vanilla JS, HTML, CSS. Manifest V3. No frameworks, no build step, no dependencies — on purpose, so the whole thing stays readable in one sitting.

## Project structure

```
manifest.json     – extension config (MV3)
background.js     – service worker: session state, tab-burst detection, notifications
newtab.html/css/js – the new-tab takeover and aperture animation
popup.html/css/js  – toolbar popup: current intent + history
common.js          – shared storage/messaging helper (with localStorage preview fallback)
icons/             – extension icons
``'

## Ideas for later

- Optional sound or haptic cue on drift instead of just a notification
- Weekly recap view (focus time vs. distraction catches)
- Configurable burst threshold / cooldown in a small settings panel
- Firefox/Edge packaging

## License

MIT — do whatever you want with it.
