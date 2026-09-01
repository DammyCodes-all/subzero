"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { sileo, Toaster } from "sileo";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { Button } from "@/components/ui/button";
import {
  clearGoogleOAuthAttempt,
  GOOGLE_OAUTH_REDIRECT,
  hasGoogleOAuthAttempt,
  markGoogleOAuthAttempt,
} from "@/lib/googleAuth";

export function AuthView() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      clearGoogleOAuthAttempt();
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "signup" || m === "login") setMode(m);
  }, [searchParams]);

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (searchParams.get("oauth") !== "google" || searchParams.has("code"))
      return;
    if (!hasGoogleOAuthAttempt()) return;

    clearGoogleOAuthAttempt();
    sileo.error({
      title: "Google sign-in failed",
      description:
        "This email may already be connected to another SubZero account. Sign in to that account instead.",
    });

    const url = new URL(window.location.href);
    url.searchParams.delete("oauth");
    router.replace(
      url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash,
      {
        scroll: false,
      },
    );
  }, [isAuthenticated, isLoading, router, searchParams]);

  const { signIn } = useAuthActions();

  async function handleGoogleSignIn() {
    markGoogleOAuthAttempt();
    try {
      await signIn("google", { redirectTo: GOOGLE_OAUTH_REDIRECT });
    } catch {
      clearGoogleOAuthAttempt();
      sileo.error({
        title: "Google sign-in failed",
        description: "Something went wrong starting Google sign-in. Try again.",
      });
    }
  }

  if (isLoading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="h-7 w-48 animate-pulse rounded bg-border/60" />
      </main>
    );
  if (isAuthenticated) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
      <h1 className="font-heading text-2xl font-bold">
        {mode === "signup" ? "Create account" : "Log in"}
      </h1>

      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Sign up
          </button>
        </div>

        {mode === "signup" ? <SignupForm /> : <LoginForm />}

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void handleGoogleSignIn()}
          className="w-full"
        >
          Continue with Google
        </Button>
      </div>
      <Toaster position="top-right" theme="dark" />
    </main>
  );
}
