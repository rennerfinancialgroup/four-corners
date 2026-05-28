# Four Corners

**Four corners to your day. A partner in every one.**

A small **PWA + backend** that does the one thing a Claude chat can't: fire your
coach check-ins to your **locked phone, on a schedule, with no app open** — then
reads your reply and coaches you back using the Claude API.

The division of labor that makes this work:

- **Claude (in chat)** is the *planner*. It has your calendar, email, Drive, and
  history. It builds the mini-day plan and hands you a small **plan JSON**.
- **This app** is the *scheduler + pusher + responder*. You paste the plan in
  once; from then on it pings you on time, in coach voice, and adapts to your
  replies — autonomously.

```
  Claude chat  ──plan JSON──▶  Coach app  ──web push──▶  your phone
       ▲                          │  ▲                       │
       └─ replan when needed      │  └──── your reply ────────┘
                                  └─ Claude API writes the coach lines
```

---

## What you need
- **Node 18+**
- An **Anthropic API key** — https://console.anthropic.com
- A place to run it over **HTTPS** (push + service workers require it). Render's
  free tier is the easiest; see Deploy below. `localhost` also works for desktop
  testing without HTTPS.

## Setup (local)
```bash
npm install
npm run gen-vapid          # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
cp .env.example .env       # then paste in the VAPID keys + your API key + a token
npm start
```
Open http://localhost:8080 on your computer. Tap **⚙ Settings**, set the server
URL (`http://localhost:8080`) and the **same APP_TOKEN** you put in `.env`, save,
then **Enable check-ins** and **Send a test ping**.

> Phones need HTTPS — you can't fully test push from a phone against
> `localhost`. Either use a tunnel (`ngrok http 8080`) or just deploy.

## Deploy (Render, ~5 min, free tier works)
1. Push this folder to a GitHub repo.
2. Render → **New → Web Service** → pick the repo.
3. Build command `npm install`, start command `npm start`.
4. Add environment variables from your `.env` (ANTHROPIC_API_KEY, APP_TOKEN,
   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, TZ, COACH_MODEL).
5. Open the `https://...onrender.com` URL **on your phone**, then **Add to Home
   Screen** (required on iOS). Open it from the home-screen icon, go to Settings,
   enter the URL + token, Enable check-ins, send a test.

> Free Render instances sleep after idle and may delay a ping by a few seconds
> on first wake. For exact timing, use a paid instance or a cheap always-on VPS.

## Using it day to day
1. In Claude chat: *"plan my day, coach check-ins on."* Claude gathers context
   and gives you a plan **plus a JSON block**.
2. In the app: paste the JSON into **Import Plan → Load plan**.
3. Go live your day. The app pings you at each check-in. Tap **On it / Drifting /
   Behind** right from the notification, or open it and type a reply. The coach
   answers — and that answer pushes back to you too.

## Plan JSON schema
```json
{
  "date": "2026-05-28",
  "mode": "diurnal",
  "tz": "America/New_York",
  "blocks": [
    { "name": "Mind", "kind": "Peak", "window": "14:00-15:30", "task": "Eric APV doc" }
  ],
  "checkins": [
    {
      "time": "14:00",
      "block": "Mind",
      "kind": "Peak",
      "task": "finish the Eric APV doc",
      "intent": "is he actually starting or stalling?"
    },
    { "time": "15:30", "block": "Mind", "kind": "Close", "task": "doc done", "intent": "did he finish + protect the boundary?" }
  ]
}
```
- `time` is `HH:mm` in 24-hour, interpreted in `tz` (or the server `TZ`).
- `task` and `intent` are what the coach uses to write a sharp, specific ping.
- Only `date` and `checkins[]` are required.

## Voices
Pick the voice that gets *you* moving — tap one in the **VOICE** card (it applies
to every ping and reply from then on, and it's saved server-side):

- **Coach** *(default)* — no-nonsense head coach in your corner. Tough love.
- **Operator** — cool, surgical chief-of-staff. Just the next move, no feelings.
- **Stoic** — calm, grounding. One task, one breath at a time.
- **Hype** — warm, electric best friend who's fired up for you.

All four share two hard rules baked into `server/coach.js`: every message is a
short **text** (≤45 words), and every voice goes after the *behavior*, never your
worth. Switch them by mood — Coach when you're slacking, Stoic when you're
overwhelmed, Operator when you just want signal, Hype when you need a lift.

## How the coaching adapts
When you respond, the backend sends your status + the recent thread to Claude
with the coach system prompt (`server/coach.js`). The four branches:
- **On it** → quick nod, bar raised, next play.
- **Drifting** → called out, next step shrunk to something you can't refuse.
- **Behind** → heat dropped, plan re-cut around what's left, one non-negotiable protected.
- **Ease off** → say it in your reply text and the tone dials down immediately.

The voice rule baked in: **hard on the behavior, loyal to the man.** It never
attacks your worth — only the excuse.

## Cost
Each ping and each reply is one short Claude call (~a few hundred tokens). A
typical day of 6–10 check-ins is pennies. To cut it further, set
`COACH_MODEL=claude-haiku-4-5-20251001` in `.env`. Model names change over time —
confirm current strings at https://docs.claude.com.

## Security
- The API is locked by `APP_TOKEN`; keep it long and private. Without it, anyone
  who finds your URL could spend your API credits.
- Your API key lives only on the server, never in the browser.

## iOS caveat (read this)
- Web push on iPhone works only on **iOS 16.4+** and only after you **Add to Home
  Screen** and open it from that icon. Delivery is slightly less reliable than
  Android. If iOS push gives you trouble, the cleanest fallback is wrapping this
  in a thin native shell (Capacitor) for real APNs — a later upgrade.

## Upgrade paths
- Swap `server/store.js` (JSON file) for SQLite when you want history/analytics.
- Add a "nudge if quiet for N minutes" rule in `server/scheduler.js`.
- Capacitor/Tauri wrapper for native push + an app-store presence.
- Multi-client (your team) → add real auth + per-user plans.

## Files
```
server/
  index.js       bootstrap (express + static + scheduler)
  scheduler.js   node-cron: fires due check-ins as push
  push.js        web-push send + dead-sub cleanup
  coach.js       THE COACH — Claude calls + system prompt + adaptation
  routes.js      API (subscribe, plan, respond, test)
  store.js       single-user JSON persistence
  time.js        luxon fire-time math
public/
  index.html / styles.css / app.js   the PWA
  sw.js          service worker (push + notification taps)
  manifest.webmanifest / icons/
scripts/gen-vapid.js
```
