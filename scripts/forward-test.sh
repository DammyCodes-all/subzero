#!/usr/bin/env bash
set -euo pipefail

SITE="${NEXT_PUBLIC_CONVEX_SITE_URL:-${CONVEX_SITE_URL:-}}"
if [ -z "$SITE" ] && [ -f .env.local ]; then
  SITE=$(grep -E "^NEXT_PUBLIC_CONVEX_SITE_URL=" .env.local 2>/dev/null | cut -d= -f2- | tr -d '"' | xargs || true)
fi
SITE="${SITE:-https://aromatic-quail-684.convex.site}"
SECRET="${AGENTMAIL_API_KEY:-}"

if [ -z "$SECRET" ]; then
  SECRET=$(npx convex env list 2>/dev/null | grep AGENTMAIL_API_KEY | cut -d= -f2- | xargs || true)
fi

if [ -z "$SECRET" ]; then
  echo "No AGENTMAIL_API_KEY found — using ?secret=test bypass (dev only if no key set)"
  SECRET="test"
fi
# URL-encode secret for query param (whsec_... may contain +/=)
ENCODED_SECRET=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$SECRET" 2>/dev/null || echo "$SECRET")

echo "Testing forwarding to $SITE/agentmail/inbound"

for fixture in adobe canva figma; do
  case $fixture in
    adobe)
      SUBJECT="Your Adobe Creative Cloud trial ends September 3, 2026"
      TEXT="Your trial ends September 3, 2026 and your plan will renew at \$54.99/month. Manage at https://account.adobe.com/plans"
      ;;
    canva)
      SUBJECT="Receipt from Canva - \$15.00"
      TEXT="Receipt for Canva Pro - \$15.00 charged on Aug 25, 2026. Your subscription renews monthly."
      ;;
    figma)
      SUBJECT="Your Figma Professional renewal \$15"
      TEXT="Receipt for Figma Professional - \$15.00 renews monthly"
      ;;
  esac

  echo "→ $fixture: $SUBJECT"
  INBOX="test-subzero-456@agentmail.to"
  # Ensure inbox has a backing connections row for routing; create if missing (requires dev bypass secret)
  npx convex run agentmail:provisionInbox "{\"userId\":\"test-user-456\",\"inbox\":\"$INBOX\"}" >/dev/null 2>&1 || true
  curl -s -X POST "$SITE/agentmail/inbound?secret=$ENCODED_SECRET" \
    -H "Content-Type: application/json" \
    -d "{\"message\":{\"inbox_id\":\"$INBOX\",\"to\":\"$INBOX\",\"from\":\"Test <test@example.com>\",\"subject\":\"$SUBJECT\",\"text\":\"$TEXT\"},\"event_type\":\"message.received\"}" \
    -w " → HTTP %{http_code}\n" | head -1
  sleep 1
 done

echo "Done. Check dashboard or run: npx convex data subscriptions | grep test-user-456"
