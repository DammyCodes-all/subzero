// Fixture emails for forwarding ingestion — plain text, no secrets.
export const fixtures = {
  adobeTrial: {
    subject: "Your Adobe Creative Cloud trial ends September 3, 2026",
    from: "Adobe <no-reply@adobe.com>",
    text: `Hi there,

Your trial ends September 3, 2026 and your plan will renew at $54.99/month.

Manage your plan at https://account.adobe.com/plans

Thanks,
Adobe

---------- Forwarded message ---------
From: Adobe <no-reply@adobe.com>
Date: Mon, 25 Aug 2026 10:00:00 -0700
Subject: Your Adobe Creative Cloud trial ends September 3, 2026
To: you@gmail.com`,
    html: `<p>Your trial ends September 3, 2026 and your plan will renew at $54.99/month.</p><p>Manage at <a href="https://account.adobe.com/plans">account.adobe.com/plans</a></p>`,
  },
  canvaReceipt: {
    subject: "Receipt from Canva - $15.00",
    from: "Canva <receipts@canva.com>",
    text: `Receipt for Canva Pro - $15.00 charged on Aug 25, 2026. Your subscription renews monthly.`,
    html: `<p>Receipt for Canva Pro - $15.00</p>`,
  },
  chatgptViaGoogle: {
    subject: "Your Google Play subscription - ChatGPT Plus $20.00",
    from: "Google Play <no-reply@google.com>",
    text: `ChatGPT Plus - $20.00 billed through Google Play. Renewal date: Sep 10, 2026. Manage at https://play.google.com/store/account/subscriptions`,
    html: `<p>ChatGPT Plus billed through Google Play</p>`,
  },
  cancelled: {
    subject: "Your Adobe subscription has been cancelled",
    from: "Adobe <no-reply@adobe.com>",
    text: `Your Adobe Creative Cloud subscription has been cancelled. You will not be charged again. Confirmation: ABC123`,
    html: `<p>Your Adobe Creative Cloud subscription has been cancelled.</p>`,
  },
} as const;
