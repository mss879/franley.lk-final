"use server";

import { z } from "zod";
import { sendContactEnquiry, emailEnabled } from "@/lib/email/send";
import { SITE } from "@/lib/constants";

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
    return {
      ok: false,
      message: `Our contact form is not connected yet. Please WhatsApp us on ${SITE.phoneLocal} or email ${SITE.email}.`,
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
    return {
      ok: false,
      message: `We could not send that just now. Please WhatsApp us on ${SITE.phoneLocal} instead.`,
    };
  }

  return { ok: true, message: "Thank you — we have your message and will reply shortly." };
}
