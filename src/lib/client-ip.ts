/**
 * The shopper's IP address — for rate limits only, never for anything that
 * must be true.
 *
 * Netlify's edge writes the address it actually saw into
 * x-nf-client-connection-ip, and a client cannot set that header. The others
 * are fallbacks for local runs and other hosts: x-forwarded-for is only safe
 * where the host replaces it, because a proxy that appends leaves the client's
 * own value first.
 */
export function clientIp(headers: Headers): string | null {
  return (
    headers.get("x-nf-client-connection-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}
