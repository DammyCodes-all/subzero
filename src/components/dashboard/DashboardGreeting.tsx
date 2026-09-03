"use client";

function getDaypart(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function DashboardGreeting({ name }: { name?: string | null }) {
  const daypart = getDaypart(new Date().getHours());

  return (
    <div className="space-y-1.5">
      <h1 className="font-heading text-[26px] font-bold leading-tight tracking-tight md:text-[28px]">
        Good {daypart}
        {name ? `, ${name}` : ""}
      </h1>
      <p className="text-sm text-muted-foreground">
        {new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(new Date())}
      </p>
    </div>
  );
}
