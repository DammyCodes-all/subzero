"use client";

import { useConvexAuth } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";

function AuthPageInner() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(initialMode);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "signup" || m === "login") setMode(m);
  }, [searchParams]);

  const { signIn } = useAuthActions();

  if (isLoading)
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="h-7 w-48 animate-pulse rounded bg-border/60" />
      </main>
    );
  if (isAuthenticated) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8 bg-background">
      <h1 className="text-2xl font-heading font-bold">
        {mode === "signup" ? "Create account" : "Log in"}
      </h1>

      <div className="w-full max-w-sm rounded-xl border bg-card p-6 space-y-6">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "login" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "signup" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
          onClick={() => void signIn("google", { redirectTo: "/dashboard" })}
          className="w-full"
        >
          Continue with Google
        </Button>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center p-8 bg-background"><div className="h-7 w-48 animate-pulse rounded bg-border/60" /></main>}>
      <AuthPageInner />
    </Suspense>
  );
}
