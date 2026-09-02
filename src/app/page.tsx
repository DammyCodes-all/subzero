import Link from "next/link";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { SubzeroMark } from "@/components/brand/SubzeroLogo";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8 bg-background">
      <div className="absolute top-4 right-4">
        <UserMenu />
      </div>
      <div className="flex flex-col items-center gap-5 text-center max-w-2xl">
        <Link href="/" aria-label="SubZero home">
          <SubzeroMark size={72} className="h-[72px] w-[72px] drop-shadow-[0_8px_24px_rgba(230,255,43,0.12)]" />
        </Link>
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
        <Link href="/auth?mode=signup">
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
