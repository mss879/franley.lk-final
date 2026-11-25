"use server";

import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthSession, readAdminMfaStatus } from "@/lib/supabase/admin-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { adminCodeEmailEnabled, sendAdminSignInCode } from "@/lib/email/admin-code";
import { safeAdminNext as safeNext } from "./next-path";

export type VerifyActionResult = { ok: boolean; message: string; done?: boolean };


/** Shown to anyone who is not an active admin. Says nothing about codes. */
const GENERIC = "If this account has admin access, a code has been emailed to it.";

function deviceLabel(ua: string) {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\/|FxiOS/.test(ua) ? "Firefox"
    : /Chrome\/|CriOS/.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  return [os, browser].filter(Boolean).join(" · ") || null;
}

/** Emails a fresh code for this session. At most one per 60 s, ten per hour. */
export async function sendAdminCode(): Promise<VerifyActionResult> {
  const { supabase, user, sessionId } = await getAuthSession();
  if (!user || !sessionId) return { ok: false, message: "Your session has ended. Sign in again." };

  const status = await readAdminMfaStatus(supabase);
  if (status === "legacy") return { ok: true, message: "Two-step sign-in is not set up yet.", done: true };
  if (!status) return { ok: true, message: GENERIC };
  if (status.sessionVerified) return { ok: true, message: "You are already verified.", done: true };

  const to = user.email;
  if (!to) return { ok: false, message: "This account has no email address to send a code to." };
  if (!adminCodeEmailEnabled()) {
    return {
      ok: false,
      message: "Email is not set up on the server (RESEND_API_KEY / RESEND_FROM_EMAIL), so no code can be sent. The owner can switch two-step sign-in off from the Supabase SQL editor — see migration 0022.",
    };
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

  let result: string | null = null;
  try {
    const { data, error } = await createServiceClient().rpc("admin_mfa_issue_code", {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_code: code,
    });
    if (error) throw error;
    result = typeof data === "string" ? data : null;
  } catch (err) {
    console.error("admin_mfa_issue_code failed", err);
    return { ok: false, message: "Could not create a code just now. Try again in a moment." };
  }

  switch (result) {
    case "ok":
      break;
    case "too_soon":
      return { ok: false, message: "A code was sent less than a minute ago. Check your inbox (and spam) or wait a moment." };
    case "rate_limited":
      return { ok: false, message: "Too many codes requested. Try again in an hour." };
    default:
      return { ok: true, message: GENERIC };
  }

  const ua = (await headers()).get("user-agent") ?? "";
  const sent = await sendAdminSignInCode({ to, code, device: deviceLabel(ua) });
  if (!sent.sent) {
    return { ok: false, message: "The code could not be emailed. Try again in a minute; if it keeps failing, check the Resend settings." };
  }

  return { ok: true, message: "We emailed you a 6-digit code. It expires in 10 minutes." };
}

/** Checks the code; on success this session may act as admin. */
export async function verifyAdminCode(rawCode: string, next?: string): Promise<VerifyActionResult> {
  const { supabase, user, sessionId } = await getAuthSession();
  if (!user || !sessionId) return { ok: false, message: "Your session has ended. Sign in again." };

  const code = String(rawCode ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, message: "Enter the 6-digit code from the email." };

  const status = await readAdminMfaStatus(supabase);
  if (status === "legacy" || (status && status.sessionVerified)) redirect(safeNext(next));
  if (!status) return { ok: false, message: "That code is not valid." };

  let result: string | null = null;
  try {
    const { data, error } = await createServiceClient().rpc("admin_mfa_verify_code", {
      p_session_id: sessionId,
      p_user_id: user.id,
      p_code: code,
    });
    if (error) throw error;
    result = typeof data === "string" ? data : null;
  } catch (err) {
    console.error("admin_mfa_verify_code failed", err);
    return { ok: false, message: "Could not check the code just now. Try again in a moment." };
  }

  if (result === "ok") redirect(safeNext(next));

  switch (result) {
    case "expired":
      return { ok: false, message: "That code has expired or was replaced. Send a new one." };
    case "locked":
      return { ok: false, message: "Too many wrong tries. Send a new code." };
    default:
      return { ok: false, message: "That code is not right. Check the latest email and try again." };
  }
}

/**
 * Signs out: drops this session's verified-admin row first (so the access
 * token, which stays valid for up to an hour, stops being an admin token at
 * once), then ends the Supabase session.
 */
export async function signOutAdmin(): Promise<void> {
  const { supabase, sessionId } = await getAuthSession();

  if (sessionId) {
    try {
      const service = createServiceClient();
      await Promise.all([
        service.from("admin_mfa_sessions").delete().eq("session_id", sessionId),
        service.from("admin_mfa_codes").delete().eq("session_id", sessionId),
      ]);
    } catch (err) {
      // Not fatal: the row also dies with the Supabase session and expires in 12 hours.
      console.error("could not clear admin_mfa rows on sign-out", err);
    }
  }

  await supabase.auth.signOut();
  redirect("/admin/login");
}
