# Aluminate — Test Notes

This is where I log SubZero testing. Deployment is `dev:aromatic-quail-684`.

I forward receipts to `subzero-agent@agentmail.to` and check the dashboard. Right now when I hit forward, nothing happens for 2-3 seconds while Groq extracts and Firecrawl runs. It looks like it failed.

### Forwarded mail needs a status

We need something that shows the mail was received and is processing.

When `POST /agentmail/inbound` lands, the dashboard should say so immediately — a small banner or toast is enough. Something like “Processing ‘Google Play Receipt’…” then “Google One added” or “Not a subscription” when it’s done. Keep it for a few seconds and dismiss.

That way I know it was hit, not guessing if AgentMail worked.
