import { MailAccount01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { emailVariants } from "@/emails/previewProps";
import { renderEmail } from "@/emails/renderEmail";
import { EmailPreviewCard } from "./EmailPreviewCard";

// Server component — renders the real HTML output, no sends.
export async function EmailsPreviewView() {
  const variants = emailVariants();
  const previews = await Promise.all(
    variants.map(async (v) => {
      const { html } = await renderEmail(v.element);
      return { badge: v.badge, subject: v.subject, html };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HugeiconsIcon
              icon={
                MailAccount01Icon as unknown as Parameters<
                  typeof HugeiconsIcon
                >[0]["icon"]
              }
              size={18}
              strokeWidth={1.8}
              color="currentColor"
            />
          </span>
          Email previews
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demo only — designed HTML for every template with sample data. No
          emails are sent from this page.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {previews.map((p) => (
          <EmailPreviewCard
            key={p.badge}
            badge={p.badge}
            subject={p.subject}
            html={p.html}
          />
        ))}
      </div>
    </div>
  );
}
