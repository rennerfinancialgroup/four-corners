# DEPLOY — get Four Corners live on your phone

No coding. ~30 minutes. You'll create three free accounts, paste in three
secrets, and end with an app on your home screen that pings you on schedule.

---

## Step 0 — Anthropic API key  (2 min)
1. Go to **console.anthropic.com** → sign in.
2. **Settings → API Keys → Create Key**. Copy it (starts with `sk-ant-`).
3. Add a little credit under **Billing** (a few dollars lasts a long time —
   each ping/reply is a fraction of a cent).
Keep that key somewhere safe for Step 3.

## Step 1 — VAPID push keys  (2 min)
These let the server push to your phone.
- **Easiest:** open **web-push-codelab.glitch.me** → it shows a
  "Public Key" and "Private Key." Copy both.
- *(Or, if you have Node installed: run `npm run gen-vapid` and copy the two
  values it prints.)*

## Step 2 — Put the code on GitHub  (5 min)
1. Make a free account at **github.com**.
2. **New repository** → name it `four-corners` → Create.
3. On the repo page: **Add file → Upload files** → drag in everything from this
   folder (or the unzipped contents) → **Commit changes**.

## Step 3 — Deploy on Render  (10 min)
1. Make a free account at **render.com** and connect your GitHub.
2. Click **New + → Blueprint**. Pick your `four-corners` repo.
   Render reads `render.yaml` and sets almost everything up automatically.
3. It will ask you to fill in the three secrets:
   - `ANTHROPIC_API_KEY` → the key from Step 0
   - `VAPID_PUBLIC_KEY` → from Step 1
   - `VAPID_PRIVATE_KEY` → from Step 1
4. Click **Apply / Deploy**. Wait for it to go live. You'll get a URL like
   `https://four-corners-xxxx.onrender.com`.
5. Open the service's **Environment** tab and copy the value of **`APP_TOKEN`**
   (Render generated it for you) — you'll need it in Step 4.

## Step 4 — Put it on your phone  (5 min)
1. Open the Render URL **on your phone's browser**.
2. **Add to Home Screen** (iPhone: Share → Add to Home Screen — this is
   *required* for push on iOS). Open it from the new icon.
3. Tap **⚙ Settings** → paste the **URL** and the **APP_TOKEN** → Save.
4. Tap **Enable check-ins on this phone** → allow notifications.
5. Tap **Send a test ping**. Lock your phone. It should buzz. Pipes work.

## Step 5 — Run a day
1. In Claude: *"plan my day, coach check-ins on."* Claude gives you a plan + a
   JSON block.
2. In the app: paste the JSON into **Import Plan → Load plan**.
3. Pick your **Voice** (Coach / Operator / Stoic / Hype). Go live your day.

---

## Known limits on the free tier (and the fixes)
- **It sleeps when idle.** First ping after a quiet stretch can be a few seconds
  late, or miss if the box is cold. Fix: upgrade that service to a paid
  always-on instance (a few dollars/mo).
- **Storage resets on redeploy.** The free tier has no permanent disk, so your
  saved plan + push subscription reset whenever you redeploy. Fix: add a Render
  **persistent disk** to the service (cheap), or move storage to a database
  later. Until then, just re-enable push and re-load your plan after a redeploy.

That's it — you've shipped an app.
