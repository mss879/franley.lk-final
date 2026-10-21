/*
 * Franley admin — order alerts.
 *
 * Registered by Admin → Settings → Order alerts with scope /admin, so it only
 * ever runs for the admin. It does one thing: show the notification the
 * server pushes (src/lib/push/index.ts) and open the order when it is tapped.
 * There is no fetch handler on purpose — nothing is cached, and every admin
 * page still comes straight from the server.
 *
 * Lives at the site root rather than under /admin because the proxy sends any
 * signed-out request for /admin/* to the login page, and the browser checks
 * for a new version of this file without a session.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }

  const title = message.title || "Franley";
  const url = typeof message.url === "string" && message.url.startsWith("/admin") ? message.url : "/admin/orders";

  // iOS revokes push for a site that receives one without showing a
  // notification, so a notification is shown for every push, whatever it holds.
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: message.body || "",
        tag: message.tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url },
      }),
      // The red count on the Home Screen icon, where the platform has one.
      self.navigator && "setAppBadge" in self.navigator
        ? self.navigator.setAppBadge().catch(() => {})
        : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin/orders", self.location.origin).href;

  event.waitUntil(
    (async () => {
      if (self.navigator && "clearAppBadge" in self.navigator) {
        await self.navigator.clearAppBadge().catch(() => {});
      }
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) return client.navigate(target).catch(() => self.clients.openWindow(target));
          return;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
