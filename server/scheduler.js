// The autonomous loop. Every minute it looks for check-ins that have come
// due, asks the coach to write the ping, and pushes it to your phone — whether
// or not any app or chat is open. THIS is the thing the chat couldn't do.
import cron from "node-cron";
import { store } from "./store.js";
import { writeCheckinPing, voiceLabel } from "./coach.js";
import { sendToAll } from "./push.js";

export function startScheduler() {
  const tz = process.env.TZ || "America/New_York";

  cron.schedule(
    "* * * * *", // every minute
    async () => {
      const due = store.dueCheckins(Date.now());
      for (const c of due) {
        // mark fired first so a slow API call can't double-fire it next minute
        store.updateCheckin(c.id, { firedAt: Date.now() });
        try {
          const message = await writeCheckinPing(c);
          store.updateCheckin(c.id, { pingMessage: message });
          store.log({ type: "ping", label: c.clock, message });
          await sendToAll({
            title: voiceLabel(),
            body: message,
            tag: `checkin-${c.id}`,
            requireInteraction: true,
            data: { kind: "checkin", checkinId: c.id },
            actions: [
              { action: "on_track", title: "On it" },
              { action: "drifting", title: "Drifting" },
              { action: "behind", title: "Behind" },
            ],
          });
          console.log(`[scheduler] fired ${c.id}: ${message}`);
        } catch (e) {
          console.error(`[scheduler] failed to fire ${c.id}:`, e.message);
        }
      }
    },
    { timezone: tz }
  );

  console.log(`[scheduler] running every minute (tz=${tz})`);
}
