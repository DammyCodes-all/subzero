import { Suspense } from "react";
import { AuthView } from "@/components/auth/AuthView";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="h-7 w-48 animate-pulse rounded bg-border/60" />
        </main>
      }
    >
      <AuthView />
    </Suspense>
  );
}
