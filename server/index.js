// Server bootstrap. Loads config, serves the PWA, mounts the API, and kicks
// off the scheduler that fires the check-ins.
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import api from "./routes.js";
import { startScheduler } from "./scheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: "256kb" }));

// API
app.use("/api", api);

// Static PWA (served from /public). Service worker must be served from root
// scope, which it is here since /public is the web root.
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/healthz", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[server] up on :${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("[server] ANTHROPIC_API_KEY not set");
  if (!process.env.APP_TOKEN) console.warn("[server] APP_TOKEN not set — API is UNLOCKED, set it!");
  startScheduler();
});
