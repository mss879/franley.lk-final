"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Loader2, Share, SquarePlus } from "lucide-react";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  type PushActionResult,
} from "@/app/admin/(guarded)/settings/push-actions";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/admin/content/ui";
import { formatDateTime } from "@/components/admin/orders/format";
import { cn } from "@/lib/utils";

export type PushDevice = {
  id: string;
  endpoint: string;
  device_label: string | null;
  created_at: string;
  last_success_at: string | null;
  last_error: string | null;
};

type Status = "checking" | "install" | "unsupported" | "denied" | "off" | "on";

const SW_URL = "/push-sw.js";
const SW_SCOPE = "/admin";

function applicationServerKey(base64url: string) {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIOS() {
  // iPadOS reports itself as a Mac; the touch screen gives it away.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Admin → Settings → Order alerts. Turns new-order notifications on or off for
 * the device in hand, and lists the admin's other devices.
 *
 * On an iPhone, push exists only inside a web app opened from the Home
 * Screen (iOS 16.4 and later), so in Safari itself this explains how to add
 * the admin there instead of offering a button that cannot work.
 */
export function PushAlerts({
  publicKey,
  devices,
  setupProblem,
}: {
  publicKey: string | null;
  devices: PushDevice[];
  setupProblem: string | null;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [ios, setIos] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [result, setResult] = useState<PushActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const serverEndpoints = devices.map((d) => d.endpoint).join("\n");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const onIOS = isIOS();
      if (!pushSupported()) {
        if (!cancelled) {
          setIos(onIOS);
          setStatus(onIOS && !isInstalled() ? "install" : "unsupported");
        }
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE, updateViaCache: "none" });
        const sub = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setIos(onIOS);
        setEndpoint(sub?.endpoint ?? null);
        if (Notification.permission === "denied") setStatus("denied");
        else setStatus(sub && serverEndpoints.split("\n").includes(sub.endpoint) ? "on" : "off");
      } catch (err) {
        console.error("order alerts: service worker registration failed", err);
        if (!cancelled) setStatus("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serverEndpoints]);

  function enable() {
    if (!publicKey) return;
    setResult(null);
    // Asked straight from the tap, before anything else is awaited: iOS only
    // shows the permission prompt in direct response to a user gesture.
    const permission = Notification.requestPermission();
    startTransition(async () => {
      try {
        if ((await permission) !== "granted") {
          setStatus(Notification.permission === "denied" ? "denied" : "off");
          setResult({ ok: false, message: "Notifications were not allowed on this device." });
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        // A subscription the store does not know about may have been made with
        // an older key; start clean so the server can always reach it.
        const existing = await reg.pushManager.getSubscription();
        if (existing) await existing.unsubscribe();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        });
        const saved = await savePushSubscription(sub.toJSON());
        setResult(saved);
        setEndpoint(sub.endpoint);
        setStatus(saved.ok ? "on" : "off");
      } catch (err) {
        console.error("order alerts: subscribe failed", err);
        setResult({ ok: false, message: "This device could not turn alerts on. Please try again." });
      }
    });
  }

  function disable() {
    setResult(null);
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        const target = sub?.endpoint ?? endpoint;
        if (sub) await sub.unsubscribe();
        const removed = target ? await removePushSubscription({ endpoint: target }) : { ok: true, message: "Order alerts are off for this device." };
        setResult(removed);
        setEndpoint(null);
        setStatus("off");
      } catch (err) {
        console.error("order alerts: unsubscribe failed", err);
        setResult({ ok: false, message: "Could not turn alerts off. Please try again." });
      }
    });
  }

  function test() {
    if (!endpoint) return;
    setResult(null);
    startTransition(async () => setResult(await sendTestPush(endpoint)));
  }

  function removeDevice(id: string) {
    setResult(null);
    startTransition(async () => setResult(await removePushSubscription({ id })));
  }

  const otherDevices = devices.filter((d) => d.endpoint !== endpoint || status !== "on");

  return (
    <section className="rounded-3xl border border-cream-300 bg-white p-6 md:p-7">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-wine-700" aria-hidden />
        <div className="min-w-0">
          <h2 className="font-display text-lg text-ink-900">Order alerts</h2>
          <p className="mt-1 text-xs text-ink-600">
            A notification on your phone the moment an order comes in — cash on delivery and bank transfer straight away, card orders once
            PayHere confirms the payment. Turn it on separately on each phone or computer that should ring.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {setupProblem ? (
          <p role="alert" className="rounded-2xl bg-wine-700/10 px-4 py-3 text-sm text-wine-800">
            {setupProblem}
          </p>
        ) : status === "checking" ? (
          <p className="flex items-center gap-2 text-sm text-ink-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking this device…
          </p>
        ) : status === "install" ? (
          <div className="rounded-2xl border border-cream-300 bg-cream-50 px-4 py-4 text-sm text-ink-800">
            <p className="font-medium">On iPhone, add the admin to your Home Screen first</p>
            <p className="mt-1 text-xs text-ink-600">iPhones only allow notifications from a web app opened from the Home Screen (iOS 16.4 or later).</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
              <li>
                In Safari, tap the Share button <Share className="inline h-4 w-4 align-[-2px]" aria-label="Share" />.
              </li>
              <li>
                Choose <span className="font-medium">Add to Home Screen</span>{" "}
                <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden />, keep the name “Franley Admin” and tap Add.
              </li>
              <li>Open <span className="font-medium">Franley Admin</span> from your Home Screen and sign in.</li>
              <li>Come back to Settings and tap <span className="font-medium">Turn on order alerts</span>.</li>
            </ol>
          </div>
        ) : status === "unsupported" ? (
          <p className="rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 text-sm text-ink-800">
            {ios
              ? "This iPhone cannot receive web notifications. Update to iOS 16.4 or later (Settings → General → Software Update), then open Franley Admin from the Home Screen again."
              : "This browser cannot receive notifications. Use Safari on iPhone (from the Home Screen), or Chrome, Edge, Firefox or Safari on a computer."}
          </p>
        ) : status === "denied" ? (
          <p className="rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3 text-sm text-ink-800">
            Notifications are blocked for this {ios ? "app" : "site"}.{" "}
            {ios
              ? "Open the iPhone's Settings → Notifications → Franley Admin and turn on Allow Notifications, then come back here."
              : "Allow notifications for this site in the browser's settings (the icon beside the address), then reload this page."}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {status === "on" ? (
              <>
                <Pill tone="live">On for this device</Pill>
                <Button size="sm" variant="outline" onClick={test} disabled={pending}>
                  Send a test alert
                </Button>
                <Button size="sm" variant="ghost" onClick={disable} disabled={pending}>
                  Turn off
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={enable} disabled={pending || !publicKey}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Turn on order alerts
              </Button>
            )}
            {pending && status === "on" && <Loader2 className="h-4 w-4 animate-spin text-ink-600" aria-hidden />}
          </div>
        )}

        <div aria-live="polite" className="min-h-5">
          {result && (
            <p className={cn("text-xs leading-relaxed", result.ok ? "text-wine-700" : "text-wine-800")}>
              {!result.ok && <span className="font-medium">Not done — </span>}
              {result.message}
            </p>
          )}
        </div>

        {otherDevices.length > 0 && (
          <div>
            <h3 className="eyebrow text-ink-600">{status === "on" ? "Your other devices" : "Your devices with alerts on"}</h3>
            <ul className="mt-2 divide-y divide-cream-200 rounded-2xl border border-cream-300">
              {otherDevices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-800">{d.device_label ?? "Device"}</p>
                    <p className="text-xs text-ink-600">
                      Added {formatDateTime(d.created_at)}
                      {d.last_success_at && <> · last alert {formatDateTime(d.last_success_at)}</>}
                    </p>
                    {d.last_error && <p className="mt-0.5 text-xs text-wine-800">Last alert failed: {d.last_error}</p>}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeDevice(d.id)} disabled={pending}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
