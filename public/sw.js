// Service worker — runs in the background, even when the app is closed.
// Receives pushes from the server and turns them into lock-screen notifications.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: "COACH", body: event.data?.text() || "" }; }

  const options = {
    body: payload.body || "",
    tag: payload.tag,
    renotify: true,
    requireInteraction: !!payload.requireInteraction,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge.png",
    vibrate: [120, 60, 120],
    data: payload.data || {},
    actions: payload.actions || [],
  };
  event.waitUntil(self.registration.showNotification(payload.title || "COACH", options));
});

// Tapping the notification (or one of its action buttons) opens the app.
// We pass the check-in id + chosen status in the URL; the page does the
// authenticated POST (keeps the app token out of the service worker).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = "/";
  if (data.kind === "checkin" && data.checkinId) {
    url = `/?respond=${encodeURIComponent(data.checkinId)}`;
    if (event.action) url += `&status=${encodeURIComponent(event.action)}`;
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.postMessage({ type: "open", url }); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
