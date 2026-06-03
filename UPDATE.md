# UPDATING — push this new build to your live Render service

You already have `four-corners-lqtr` deployed on Render and it's connected to
your GitHub repo. Render watches the repo and **auto-redeploys on every push**.
So updating = uploading the new files to GitHub. About 5 minutes.

## What's in this build
- **In-app planner** — tap **NEW PLAN** in the app, fill the form, draft a day
  with AI in seconds. No more pasting JSON from chat.
- (The JSON paste is still available under an **Advanced** disclosure if you
  ever want it.)

## How to update GitHub (web UI, no terminal)

1. Open your repo at `github.com/<your-username>/four-corners`.
2. **Add file → Upload files.**
3. Unzip `four-corners.zip` on your computer. Open the `four-corners` folder.
4. Drag in **the contents** of that folder — same way you did the first time
   (`server/`, `public/`, `package.json`, etc. land at the repo root).
5. GitHub will detect that files already exist with the same paths and treat
   the upload as **changes**. Scroll down → **Commit changes**.
6. The commit triggers Render to redeploy automatically. Watch the
   `four-corners-lqtr` service's **Logs** tab — you'll see a new build start.
7. When it ends with `[server] up on :…`, the new code is live. Refresh the app
   on your phone — you'll see a new **NEW PLAN** card.

## After the redeploy
- Open the app, scroll to **NEW PLAN**, fill the form, tap **Draft my day**,
  review, tap **Schedule it**. Done.
- The auth issue from earlier (test ping returning *Failed — check settings*)
  is still about the **APP_TOKEN** in your phone's Settings matching the value
  in Render's Environment. Redeploys don't change `APP_TOKEN`, so re-check
  that's exact, save, then **Send a test ping**.

If anything in the build log goes red, paste me the error.
