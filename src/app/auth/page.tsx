"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SignInButton } from "@/components/SignInButton";

export default function AuthPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, isLoading, router]);

  if (isLoading)
    return <p className="p-8 text-sm text-muted-foreground">Loading...</p>;
  if (isAuthenticated) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-6 bg-background">
      <div className="text-center space-y-3 max-w-md">
        <h1 className="text-2xl font-heading font-bold">
          Connect your subscriptions
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in with Google to let SubZero find renewals. We request Gmail
          read-only and store only what’s needed — you can disconnect anytime.
        </p>
      </div>
      <SignInButton />
      <p className="text-xs text-muted-foreground font-mono">
        SubZero Auth · Convex Auth + Google
      </p>
    </main>
  );
}
