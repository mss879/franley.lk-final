"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { isLive } from "@/lib/data";
import { sendContactEnquiry, emailEnabled } from "@/lib/email/send";
import { getSiteSettings } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";

export type ContactState = { ok: boolean; message: string } | null;

const schema = z.object({
  name: z.string().trim().min(2, "Please tell us your name.").max(120),
  email: z.email("Enter an email address we can reply to."),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  orderNumber: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Tell us a little more so we can help.").max(2000),
  // Honeypot. A real person never fills a field they cannot see; bots fill
  // everything. Cheaper and less hostile than a CAPTCHA.
  website: z.string().max(0).optional().or(z.literal("")),
});

/**
 * Flood control, checked before any email is sent: five messages an hour from
 * one address, sixty a day from everyone together. This action can be called
 * by a script as easily as by the form, and every call is an email through
 * the same Resend quota the order confirmations depend on.
 *
 * Fails open — a missing key or an unapplied migration (0016) must not silence
 * a real customer — and says why in the log.
 */
async function withinContactLimits(): Promise<boolean> {
  if (!isLive()) return true;
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
    const supabase = createServiceClient();
    const limits = [
      { p_key: `ip|${ip}`, p_limit: 5, p_window_seconds: 60 * 60 },
      { p_key: "all", p_limit: 60, p_window_seconds: 24 * 60 * 60 },
    ];
    for (const limit of limits) {
      const { data, error } = await supabase.rpc("throttle_take", { p_kind: "contact", ...limit });
      if (error) throw error;
      if (data === false) return false;
    }
    return true;
  } catch (err) {
    console.error("contact form throttle unavailable", err);
    return true;
  }
}

export async function submitEnquiry(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const raw = Object.fromEntries(
    ["name", "email", "phone", "orderNumber", "message", "website"].map((k) => [
      k,
      String(formData.get(k) ?? "").trim(),
    ]),
  );

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  // Silently accept the bot's submission — telling it why it failed only helps
  // it try again.
  if (parsed.data.website) return { ok: true, message: "Thank you — we will be in touch shortly." };

  if (!emailEnabled()) {
    const { phone, email } = await getSiteSettings();
    return {
      ok: false,
      message: `Our contact form is not connected yet. Please WhatsApp us on ${phone} or email ${email}.`,
    };
  }

  if (!(await withinContactLimits())) {
    const { phone } = await getSiteSettings();
    return {
      ok: false,
      message: `We have had a lot of messages just now. Please WhatsApp us on ${phone} instead.`,
    };
  }

  const result = await sendContactEnquiry({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    orderNumber: parsed.data.orderNumber || null,
    message: parsed.data.message,
  });

  if (!result.sent) {
    const { phone } = await getSiteSettings();
    return {
      ok: false,
      message: `We could not send that just now. Please WhatsApp us on ${phone} instead.`,
    };
  }

  return { ok: true, message: "Thank you — we have your message and will reply shortly." };
}
