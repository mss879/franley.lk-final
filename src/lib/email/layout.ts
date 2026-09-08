import { SITE } from "@/lib/constants";

/**
 * Email HTML is not web HTML. Gmail strips <style> blocks in some clients,
 * Outlook renders through Word's engine and ignores flexbox, grid, and most
 * modern CSS. So: tables for layout, inline styles only, no web fonts, and
 * hex colours written literally rather than via CSS variables.
 */

export const BRAND = {
  wine: "#711625",
  wineDark: "#400B16",
  cream: "#FDFBF7",
  creamPanel: "#F9F5EE",
  hairline: "#E6DBCA",
  ink: "#2B2825",
  inkMuted: "#55504A",
  champagne: "#CBAE73",
} as const;

const FONT = "Georgia, 'Times New Roman', serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr><td align="center" bgcolor="${BRAND.wine}" style="border-radius:999px;">
      <a href="${href}" style="display:inline-block;padding:14px 32px;font-family:${SANS};font-size:14px;font-weight:600;color:${BRAND.cream};text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

export function shell({
  preheader,
  heading,
  body,
}: {
  /** The grey line shown after the subject in an inbox list. */
  preheader: string;
  heading: string;
  body: string;
}) {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? SITE.url;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.cream};">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

      <tr><td align="center" bgcolor="${BRAND.wine}" style="padding:30px 24px;border-radius:16px 16px 0 0;">
        <div style="font-family:${FONT};font-size:26px;letter-spacing:0.16em;color:${BRAND.cream};">FRANLEY</div>
        <div style="margin-top:8px;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${BRAND.champagne};">The Art of Modern Man</div>
      </td></tr>

      <tr><td bgcolor="#FFFFFF" style="padding:36px 32px;border-left:1px solid ${BRAND.hairline};border-right:1px solid ${BRAND.hairline};">
        <h1 style="margin:0 0 18px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:normal;color:${BRAND.ink};">${escapeHtml(heading)}</h1>
        ${body}
      </td></tr>

      <tr><td bgcolor="${BRAND.creamPanel}" style="padding:26px 32px;border:1px solid ${BRAND.hairline};border-radius:0 0 16px 16px;">
        <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:1.7;color:${BRAND.inkMuted};">
          Questions? Reply to this email, or message us on WhatsApp at
          <a href="https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}" style="color:${BRAND.wine};">${SITE.phone}</a>.
        </p>
        <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:1.7;color:${BRAND.inkMuted};">
          ${SITE.address.line1}, ${SITE.address.city}, ${SITE.address.country}<br>
          ${SITE.hours.weekdays}
        </p>
        <p style="margin:0;font-family:${SANS};font-size:11px;color:#8C8279;">
          <a href="${site}" style="color:#8C8279;">franley.lk</a>
          &nbsp;·&nbsp;
          <a href="${site}/returns" style="color:#8C8279;">Returns</a>
          &nbsp;·&nbsp;
          <a href="${site}/shipping" style="color:#8C8279;">Shipping</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export const P = (text: string) =>
  `<p style="margin:0 0 14px;font-family:${SANS};font-size:14px;line-height:1.75;color:${BRAND.inkMuted};">${text}</p>`;

export const LABEL = (text: string) =>
  `<div style="font-family:${SANS};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8C8279;">${escapeHtml(text)}</div>`;

export { FONT, SANS };
