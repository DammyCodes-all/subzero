export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">Meet SubZero</h1>
        <p className="text-xl text-muted-foreground">
          Your subscriptions shouldn&apos;t surprise you.
        </p>
        <p className="text-sm text-muted-foreground">
          SubZero finds your subscriptions, warns you before renewals, and
          researches the exact way to cancel.
        </p>
      </div>
      <div className="flex gap-4">
        <button
          type="button"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
        >
          Find my subscriptions
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Convex + Firecrawl + AgentMail + OpenAI
      </p>
    </main>
  );
}
