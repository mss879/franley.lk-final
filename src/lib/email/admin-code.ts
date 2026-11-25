import "server-only";
import { Resend } from "resend";
import { shell, P, BRAND, FONT, SANS, escapeHtml } from "./layout";

/**
 * The admin two-step sign-in email (see 0022_admin_email_2fa.sql). Sent with
 * the same Resend account and sender as the order emails, to the admin's own
 * Supabase Auth address.
 *
 * The code is deliberately NOT in the subject or the inbox preview line: those
 * show on a locked phone's screen, and the point of the code is that holding
 * the password (or the phone) alone is not enough.
 *
 * Not written to email_log: that table is for customer and order mail, and a
 * sign-in code has no business sitting in an admin-readable list.
 */
export function adminCodeEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendAdminSignInCode(opts: {
  to: string;
  code: string;
  device?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false, reason: "resend-not-configured" };
  if (!/^\d{6}$/.test(opts.code)) return { sent: false, reason: "bad-code" };

  const codeBlock = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td align="center" bgcolor="${BRAND.creamPanel}" style="padding:18px 28px;border:1px solid ${BRAND.hairline};border-radius:12px;">
      <div style="font-family:${FONT};font-size:34px;letter-spacing:0.32em;color:${BRAND.ink};">${opts.code}</div>
    </td></tr>
  </table>`;

  const html = shell({
    preheader: "Your sign-in code for the Franley admin panel. It expires in 10 minutes.",
    heading: "Your sign-in code",
    body: [
      P("Enter this code on the Franley admin sign-in page to finish signing in."),
      codeBlock,
      P("It expires in 10 minutes and works once, for the browser you just signed in on."),
      opts.device
        ? `<p style="margin:0 0 14px;font-family:${SANS};font-size:12px;line-height:1.7;color:#8C8279;">Requested from: ${escapeHtml(opts.device)}</p>`
        : "",
      P(
        "<strong>Did not just sign in?</strong> Someone has your admin password. Do not share this code with anyone — " +
          "change the password in Supabase (Authentication &rarr; Users) straight away.",
      ),
    ].join(""),
  });

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to: [opts.to],
      subject: "Your Franley admin sign-in code",
      html,
      text:
        `Your Franley admin sign-in code is ${opts.code}\n\n` +
        "It expires in 10 minutes. If you did not just sign in, someone has your admin password: change it in Supabase straight away.",
    });
    if (error) throw new Error(error.message);
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("admin sign-in code email failed", message);
    return { sent: false, reason: message };
  }
}
