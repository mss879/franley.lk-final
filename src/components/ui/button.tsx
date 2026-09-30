import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "cream" | "outline" | "outlineLight" | "ghost" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide " +
  "transition-all duration-300 ease-[--ease-lux] whitespace-nowrap " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Solid ink — the default CTA on cream surfaces. Brand maroon is the hover
  // state, so the colour shows up as a response rather than as a slab.
  primary: "bg-ink-900 text-cream-50 hover:bg-wine-700 active:bg-wine-800 ring-offset-cream-50",
  // Solid cream — the CTA on dark surfaces (Board 1's nested pill button)
  cream: "bg-cream-100 text-ink-900 hover:bg-white active:bg-cream-200 ring-offset-ink-900 focus-on-dark",
  outline: "border border-ink-800/20 text-ink-800 hover:border-ink-900 hover:text-ink-900 ring-offset-cream-50",
  outlineLight: "border border-cream-100/30 text-cream-100 hover:border-cream-100/70 hover:bg-cream-100/5 ring-offset-ink-900 focus-on-dark",
  ghost: "text-ink-800 hover:bg-ink-800/5 ring-offset-cream-50",
  link: "text-ink-800 underline-offset-4 hover:text-wine-700 rounded-none px-0",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-9 text-sm",
};

type CommonProps = { variant?: Variant; size?: Size; className?: string; children: React.ReactNode };

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: CommonProps & { href: string } & Omit<React.ComponentProps<typeof Link>, "href">) {
  return <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
