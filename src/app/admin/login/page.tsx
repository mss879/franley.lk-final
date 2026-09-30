import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Admin Sign In",
  robots: { index: false, follow: false },
};

/**
 * The only messages ?error= can put on this page. The URL carries a code, never
 * text — otherwise anyone could send the owner a link to the real sign-in page
 * with words of their choosing on it.
 */
const ERRORS: Record<string, string> = {
  "not-admin": "That account does not have admin access.",
  "not-configured": "Supabase is not configured yet. Add your keys to .env.local.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="focus-on-dark silk-texture grid min-h-dvh place-items-center bg-ink-900 px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Image
            src="/brand/logo-dark.png"
            alt="Franley"
            width={200}
            height={40}
            preload
            className="mx-auto h-8 w-auto brightness-0 invert"
          />
          <p className="eyebrow mt-6 text-champagne-300">Store administration</p>
        </div>

        <div className="mt-8 rounded-3xl bg-cream-50 p-8">
          <h1 className="font-display text-2xl">Sign in</h1>
          <p className="mt-2 text-sm text-ink-600">
            Use the account created for you in Supabase.
          </p>
          <LoginForm nextPath={next} initialError={error ? ERRORS[error] : undefined} />
        </div>

        <p className="mt-6 text-center text-xs text-cream-100/60">
          Staff access only. All actions are logged.
        </p>
      </div>
    </main>
  );
}
