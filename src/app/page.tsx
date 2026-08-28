import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8 bg-background">
      <div className="absolute top-4 right-4">
        <UserMenu />
      </div>
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-4xl font-heading font-bold tracking-tight">
          Meet SubZero
        </h1>
        <p className="text-xl text-muted-foreground">
          Your subscriptions shouldn&apos;t surprise you.
        </p>
        <p className="text-sm text-muted-foreground">
          SubZero finds your subscriptions, warns you before renewals, and
          researches the exact way to cancel.
        </p>
      </div>
      <div className="flex gap-4">
        <Link href="/auth">
          <Button className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/80">
            Find my subscriptions
          </Button>
        </Link>
      </div>
      <p className="text-xs text-muted-foreground font-mono">
        Convex + Firecrawl + AgentMail + OpenAI
      </p>
    </main>
  );
}
