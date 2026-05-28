// Web Push setup. Sends a notification payload to every saved subscription.
// Automatically prunes subscriptions the browser has revoked (410/404).
import webpush from "web-push";
import { store } from "./store.js";

const {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = "mailto:you@example.com",
} = process.env;

let configured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
} else {
  console.warn("[push] VAPID keys missing — run `npm run gen-vapid` and set them in .env");
}

export function pushConfigured() {
  return configured;
}

// payload: { title, body, tag, data:{...}, actions:[{action,title}] }
export async function sendToAll(payload) {
  const subs = store.getSubscriptions();
  const json = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((sub) => webpush.sendNotification(sub, json))
  );
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const code = r.reason?.statusCode;
      if (code === 410 || code === 404) {
        store.removeSubscription(subs[i].endpoint);
        console.log("[push] pruned dead subscription");
      } else {
        console.error("[push] send failed:", code, r.reason?.body || r.reason?.message);
      }
    }
  });
}
