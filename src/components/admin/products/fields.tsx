import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-full border border-cream-300 bg-white px-4 text-sm text-ink-800 " +
  "placeholder:text-ink-600 transition-colors duration-200 " +
  "focus-visible:outline-none focus-visible:border-champagne-400 focus-visible:ring-2 " +
  "focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 " +
  "aria-[invalid=true]:border-wine-600";

function Shell({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-xs font-medium text-ink-600">
        {label}
        {required && <span aria-hidden className="text-wine-700"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-wine-700">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-600">{hint}</p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type FieldChrome = { id: string; label: string; hint?: string; error?: string; wrapClass?: string };

export function TextField({
  id,
  label,
  hint,
  error,
  wrapClass,
  ...props
}: FieldChrome & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={props.required} className={wrapClass}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
        className={cn(inputClass, props.className)}
      />
    </Shell>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  error,
  wrapClass,
  ...props
}: FieldChrome & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={props.required} className={wrapClass}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
        className={cn(
          inputClass,
          "h-auto min-h-32 rounded-2xl py-3 leading-relaxed",
          props.className,
        )}
      />
    </Shell>
  );
}

export function SelectField({
  id,
  label,
  hint,
  error,
  wrapClass,
  children,
  ...props
}: FieldChrome & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell id={id} label={label} hint={hint} error={error} required={props.required} className={wrapClass}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
        className={cn(inputClass, "appearance-none bg-white pr-10", props.className)}
      >
        {children}
      </select>
    </Shell>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-cream-300 bg-white p-6 md:p-7">
      <h2 className="font-display text-lg text-ink-900">{title}</h2>
      {description && <p className="mt-1 text-xs text-ink-600">{description}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
