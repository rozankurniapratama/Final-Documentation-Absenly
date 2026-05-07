"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(loginAction, {
    error: null,
  });

  useEffect(() => {
    if (state.error === null && !isPending) {
      // Check if we just successfully logged in (no error and form was submitted)
      const checkSession = async () => {
        const res = await fetch("/api/check-session");
        if (res.ok) {
          router.push("/documentation");
        }
      };
      checkSession();
    }
  }, [state, isPending, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card brutal-border brutal-shadow p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
              TiLabs Documentation
            </h1>
            <p className="text-muted-foreground font-mono text-sm">
              Enter password to access dashboard
            </p>
          </div>

          <form action={formAction} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-bold uppercase tracking-wide mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoFocus
                className="w-full px-4 py-3 brutal-border bg-background font-mono text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                placeholder="Enter password..."
              />
            </div>

            {state.error && (
              <div className="bg-destructive/10 brutal-border border-destructive p-3">
                <p className="text-destructive font-mono text-sm font-bold">
                  {state.error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-4 bg-primary text-primary-foreground font-black uppercase tracking-wide brutal-border brutal-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Authenticating..." : "Access Dashboard"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t-2 border-dashed border-muted">
            <p className="text-center text-xs font-mono text-muted-foreground uppercase">
              Odoo Module Documentation Tracker
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
