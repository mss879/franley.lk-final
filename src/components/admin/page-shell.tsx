import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminPageShell({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-xl text-sm text-ink-600">{description}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-wine-700 px-6 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
