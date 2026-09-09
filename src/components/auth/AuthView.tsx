"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { sileo, Toaster } from "sileo";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { SubzeroWithWordmark } from "@/components/brand/SubzeroLogo";
import { Button } from "@/components/ui/button";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import {
  clearGoogleOAuthAttempt,
  GOOGLE_OAUTH_REDIRECT,
  hasGoogleOAuthAttempt,
  markGoogleOAuthAttempt,
} from "@/lib/googleAuth";

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2 3.7-5.1 3.7-8.9z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5l-3.7 2.9C3.5 21.3 7.5 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4L1.5 6.7C.5 8.7 0 10.3 0 12s.5 3.3 1.4 4.7l3.8-2.3z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 7.3l3.8 2.9c1-2.9 3.7-5.5 6.8-5.5z"
      />
    </svg>
  );
}

export function AuthView() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [googlePending, setGooglePending] = useState(false);

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
    if (googlePending) return;
    markGoogleOAuthAttempt();
    setGooglePending(true);
    try {
      await signIn("google", { redirectTo: GOOGLE_OAUTH_REDIRECT });
    } catch {
      clearGoogleOAuthAttempt();
      setGooglePending(false);
      sileo.error({
        title: "Google sign-in failed",
        description: "Something went wrong starting Google sign-in. Try again.",
      });
    }
  }

  if (isLoading)
    return <AuthSkeleton fields={initialMode === "signup" ? 3 : 2} />;
  if (isAuthenticated) return null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Full-page dark gradient pattern */}
      <div aria-hidden className="absolute inset-0">
        <DarkGradientBg className="absolute inset-0" />
      </div>

      <section className="relative z-10 flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <Rise delay={0}>
            <a href="/" aria-label="SubZero home" className="flex items-center">
              <SubzeroWithWordmark width={120} height={36} />
            </a>
          </Rise>

          <Rise delay={0.06} className="mt-6">
            <h1 className="font-heading text-[28px] font-bold leading-[1.15] tracking-tight">
              {mode === "signup"
                ? "Stop paying for what you forgot."
                : "Welcome back."}
            </h1>
          </Rise>
          <Rise delay={0.1} className="mt-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === "signup"
                ? "One tap with Google."
                : "Still saving you money while you were gone."}
            </p>
          </Rise>

          <Rise delay={0.15} className="mt-6">
            <Button
              type="button"
              size="lg"
              onClick={() => void handleGoogleSignIn()}
              disabled={googlePending}
              className="h-12 w-full gap-2.5 text-[15px]"
            >
              <GoogleG />
              {googlePending ? "Connecting…" : "Continue with Google"}
            </Button>
          </Rise>

          <Rise delay={0.19} className="my-5">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-[11px] text-muted-foreground">
                or with email
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </Rise>

          <Rise delay={0.23}>
            {mode === "signup" ? <SignupForm /> : <LoginForm />}

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  New to SubZero?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Create an account
                  </button>
                </>
              )}
            </p>
          </Rise>
        </div>
      </section>
      <Toaster position="top-right" theme="dark" />
    </main>
  );
}

function Rise({
  delay,
  className,
  children,
}: {
  delay: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}
