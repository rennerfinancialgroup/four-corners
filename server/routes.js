// API surface. Every route is guarded by the APP_TOKEN header so an open
// endpoint can't burn your Anthropic credits.
import express from "express";
import { store } from "./store.js";
import { fireTimestamp, clockLabel } from "./time.js";
import { sendToAll, pushConfigured } from "./push.js";
import { writeCoachReply, listVoices, VOICES, voiceLabel } from "./coach.js";

const router = express.Router();
const TZ = process.env.TZ || "America/New_York";
const APP_TOKEN = process.env.APP_TOKEN || "";

// --- auth guard ---
router.use((req, res, next) => {
  if (req.path === "/config") return next(); // public: ships the VAPID public key
  const token = req.get("x-app-token");
  if (!APP_TOKEN || token !== APP_TOKEN) {
    return res.status(401).json({ error: "bad or missing x-app-token" });
  }
  next();
});

// Public config the browser needs to subscribe to push.
router.get("/config", (req, res) => {
  res.json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
    pushConfigured: pushConfigured(),
    tz: TZ,
    voices: listVoices(),
    voice: store.getVoice(),
  });
});

// Get / set the active voice.
router.get("/voice", (req, res) => res.json({ voice: store.getVoice(), voices: listVoices() }));
router.post("/voice", (req, res) => {
  const { voice } = req.body;
  if (!VOICES[voice]) return res.status(400).json({ error: "unknown voice" });
  store.setVoice(voice);
  res.json({ ok: true, voice });
});

// Save a browser push subscription.
router.post("/subscribe", (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: "no subscription" });
  store.addSubscription(subscription);
  res.json({ ok: true });
});

// Import a plan (this is what you paste from the Claude chat).
// Shape:
// {
//   date: "2026-05-28", mode: "diurnal"|"nocturnal", tz: "America/New_York",
//   blocks: [{ name, kind, window, task }],
//   checkins: [{ time:"14:00", block:"Mind", kind:"Peak",
//                task:"finish the Eric APV doc", intent:"is he starting?" }]
// }
router.post("/plan", (req, res) => {
  const plan = req.body.plan || req.body;
  if (!plan?.date || !Array.isArray(plan.checkins)) {
    return res.status(400).json({ error: "plan needs date and checkins[]" });
  }
  const tz = plan.tz || TZ;
  const checkins = plan.checkins.map((c, i) => {
    const fireAt = fireTimestamp(plan.date, c.time, tz);
    return {
      id: `${plan.date}-${i}-${c.time}`,
      time: c.time,
      clock: clockLabel(fireAt, tz),
      block: c.block || "",
      kind: c.kind || "",
      task: c.task || "",
      intent: c.intent || "is he on it?",
      fireAt,
      firedAt: null,
      pingMessage: null,
      status: null,
      reply: null,
    };
  });
  store.setPlan(plan, checkins);
  res.json({ ok: true, scheduled: checkins.length, checkins });
});

router.get("/plan/today", (req, res) => {
  res.json({ plan: store.getPlan(), checkins: store.getCheckins() });
});

// Bobby responds to a check-in. Records it, asks the coach for a comeback,
// stores + pushes the comeback, and returns it to the UI.
router.post("/checkin/:id/respond", async (req, res) => {
  const checkin = store.getCheckin(req.params.id);
  if (!checkin) return res.status(404).json({ error: "no such check-in" });
  const { status, text } = req.body; // status: on_track|drifting|behind|ease_off
  store.updateCheckin(checkin.id, { status, reply: null });
  store.log({ type: "status", label: checkin.clock, status, text });

  const message = await writeCoachReply({ checkin, status, text });
  store.updateCheckin(checkin.id, { reply: message });
  store.log({ type: "reply", message });

  // Push the coach's comeback so it lands as a notification too.
  await sendToAll({
    title: voiceLabel(),
    body: message,
    tag: `reply-${checkin.id}`,
    data: { kind: "reply" },
  });

  res.json({ ok: true, message });
});

// Manual test button in the UI.
router.post("/test-push", async (req, res) => {
  await sendToAll({
    title: voiceLabel(),
    body: "test ping. if you're reading this on your lock screen, the pipes work. now get back to it.",
    tag: "test",
    data: { kind: "test" },
  });
  res.json({ ok: true });
});

export default router;
