"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({
  nextPath,
  initialError,
}: {
  nextPath?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });

    if (signInError) {
      // Deliberately vague: never reveal whether the address exists.
      setError("Those credentials did not work. Check and try again.");
      setBusy(false);
      return;
    }

    // The admin layout re-checks authorisation server-side; a signed-in user
    // who is not an admin is bounced there, not here.
    router.replace(nextPath && nextPath.startsWith("/admin") ? nextPath : "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-5">
      <div>
        <label htmlFor="email" className="eyebrow block text-ink-600">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="mt-2 h-12 w-full rounded-full border border-cream-300 bg-white px-5 text-sm focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        />
      </div>

      <div>
        <label htmlFor="password" className="eyebrow block text-ink-600">Password</label>
        <div className="relative mt-2">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-12 w-full rounded-full border border-cream-300 bg-white pl-5 pr-12 text-sm focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full text-ink-400 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {showPassword
              ? <EyeOff className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              : <Eye className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-wine-700/10 px-4 py-3 text-xs text-wine-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="grid h-12 w-full place-items-center rounded-full bg-wine-700 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Sign in"}
      </button>
    </form>
  );
}
