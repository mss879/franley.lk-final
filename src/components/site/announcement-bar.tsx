import Link from "next/link";

export type AnnouncementContent = {
  text: string;
  href?: string | null;
  linkLabel?: string | null;
};

/**
 * The thin strip above the header. Driven by the `global`/`announcement` CMS
 * block, which ships unpublished — nothing renders until the admin turns it on
 * (or schedules it with publish_at / unpublish_at).
 */
export function AnnouncementBar({ content }: { content: AnnouncementContent | null }) {
  if (!content?.text) return null;

  return (
    <div className="bg-wine-900 text-cream-100">
      <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-3 px-5 py-2.5 text-center md:px-10">
        <p className="text-xs leading-snug">{content.text}</p>
        {content.href && content.linkLabel && (
          <Link
            href={content.href}
            className="shrink-0 border-b border-champagne-400/60 pb-0.5 text-xs text-champagne-300 transition-colors hover:border-champagne-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-900"
          >
            {content.linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
