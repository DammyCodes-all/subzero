"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  const { signIn } = useAuthActions();
  return (
    <Button
      type="button"
      onClick={() => void signIn("google", { redirectTo: "/dashboard" })}
      className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/80"
    >
      Find my subscriptions
    </Button>
  );
}
