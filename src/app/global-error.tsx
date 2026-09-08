"use client";

import { useEffect } from "react";
import { SITE } from "@/lib/constants";

/**
 * Replaces the whole document, so none of the app's CSS or fonts are loaded
 * here — every rule below has to travel with the component.
 */
const CSS = `
  :root { color-scheme: light; }
  body {
    margin: 0;
    background: #711625;
    color: #F9F5EE;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap {
    box-sizing: border-box;
    min-height: 100vh;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 2.5rem 1.25rem;
    text-align: center;
  }
  .inner { max-width: 34rem; }
  .eyebrow {
    margin: 0;
    font-size: 0.6875rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 500;
    color: #DCC79B;
  }
  h1 {
    margin: 1.25rem 0 0;
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 400;
    font-size: clamp(2.25rem, 6.5vw, 3.5rem);
    line-height: 1.02;
    letter-spacing: -0.02em;
  }
  p.lede {
    margin: 1.25rem 0 0;
    font-size: 0.9375rem;
    line-height: 1.7;
    color: rgba(249, 245, 238, 0.72);
  }
  .actions {
    margin-top: 2.25rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 3.5rem;
    padding: 0 2.25rem;
    border-radius: 999px;
    border: 1px solid transparent;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.3s, border-color 0.3s;
  }
  .btn-solid { background: #F9F5EE; color: #5C1220; }
  .btn-solid:hover { background: #FDFBF7; }
  .btn-outline { background: transparent; color: #F9F5EE; border-color: rgba(249, 245, 238, 0.3); }
  .btn-outline:hover { border-color: rgba(249, 245, 238, 0.7); }
  .btn:focus-visible {
    outline: 2px solid #CBAE73;
    outline-offset: 2px;
  }
  .help {
    margin: 2.25rem 0 0;
    font-size: 0.8125rem;
    line-height: 1.7;
    color: rgba(249, 245, 238, 0.6);
  }
  .help a { color: #DCC79B; }
  .ref {
    margin: 1rem 0 0;
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    color: rgba(249, 245, 238, 0.45);
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; }
  }
`;

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Franley: unrecoverable error", error);
  }, [error]);

  const wa = `https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}`;

  return (
    <html lang="en">
      <body>
        <title>Something went wrong · Franley</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="wrap">
          <div className="inner" role="alert">
            <p className="eyebrow">Franley</p>
            <h1>Something went wrong</h1>
            <p className="lede">
              The site stopped short of loading. It is almost always momentary —
              try again, and if it holds we would rather you message us than
              give up on the order.
            </p>
            <div className="actions">
              <button type="button" className="btn btn-solid" onClick={() => retry()}>
                Try again
              </button>
              {/* A full document load, not a client navigation — the tree that
                  failed is the one being escaped. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a className="btn btn-outline" href="/">
                Back to the shop
              </a>
            </div>
            <p className="help">
              WhatsApp or call{" "}
              <a href={wa} rel="noreferrer noopener">
                {SITE.phone}
              </a>
              , or write to{" "}
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
            </p>
            {error.digest && <p className="ref">Reference {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
