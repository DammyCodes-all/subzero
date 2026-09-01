"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import {
  GOOGLE_OAUTH_REDIRECT,
  markGoogleOAuthAttempt,
} from "@/lib/googleAuth";

export function SignInButton() {
  const { signIn } = useAuthActions();
  return (
    <Button
      type="button"
      onClick={() => {
        markGoogleOAuthAttempt();
        void signIn("google", { redirectTo: GOOGLE_OAUTH_REDIRECT });
      }}
      className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/80"
    >
      Find my subscriptions
    </Button>
  );
}
