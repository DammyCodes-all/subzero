# Email Packages Research — Designed HTML Subscription Emails

Date: 2026-09-10. Stack: Next.js 16.3 + React 19.2 + TypeScript, Convex backend, all sends via `@agentmail/convex` (`convex/lib/agentmail.ts` → `enqueueSend`). Sources are primary only (official docs, npm registry, GitHub source, first-party changelogs); every claim links its source.

## Key finding up front

No new transport package is needed. The installed `@agentmail/convex@0.1.0` client already accepts `html` and forwards it to the AgentMail send API — only `convex/lib/agentmail.ts` needs an optional `html` arg (code change, out of scope here). Verified in the shipped package source (`SendArgs.html?: string`, `toSendPayload` maps `html → html`) and the REST reference (body accepts `text` + `html`, best practice is to always send both).

- `node_modules/@agentmail/convex/dist/client/payload.d.ts` + `payload.js` (`SendArgs`, `toSendPayload`)
- https://www.agentmail.to/docs/api-reference/inboxes/messages/send
- https://www.agentmail.to/docs/messages ("Best Practice: Always send both `text` and `html` versions")

## Comparison table

| Package | Latest (Sept 2026) | React 19 / Next 16 | Gmail-safe HTML story | Text fallback | Preview story | Verdict |
|---|---|---|---|---|---|---|
| `react-email` (unified) | 6.9.5 (npm, ~1.5M wk dl) | Peer `react ^18 \|\| ^19` — OK for 19.2.4; Node ≥ 20 | Table-based primitives, inlined CSS, MSO conditionals; tested matrix Gmail/Apple/Outlook/Yahoo/HEY/Superhuman | Built-in `toPlainText()`, `render(x, { plainText })`, `htmlToTextOptions`, `data-skip-in-text` | `email dev` standalone dev server (dev-only, not embeddable); in-app preview via `render()` + iframe | **Adopt** |
| `@react-email/render` | 2.1.0 (npm, ~4.7M wk dl) | Same peers; explicit **`convex` export condition → edge build** | Same (it is the renderer) | Same (bundles `html-to-text ^9`) | n/a (render-to-string) | **Adopt** (companion) |
| `@react-email/components` + per-component pkgs | 1.0.12, **deprecated** | Frozen | Same | Same | — | **Skip** |
| `email dev` preview server / `@react-email/ui` | Ships inside `react-email` 6.x | n/a | n/a | n/a | Local server, `--dir`/`--port` flags, hot reload; separate prod build via `email build`/`email start` | **Skip** for embedding; optional local-only script |
| `mjml` + `@faire/mjml-react` | mjml 5.4.0; mjml-react 4.0.1 | React 19 supported since 3.5.0; v4 `render()` now async (MJML 5) | Excellent (its own table compiler) | Via MJML only, no React-text pipeline | None built in | **Skip** |
| `html-to-text` standalone | 10.0.0 (~13M wk dl, MIT) | Runtime-agnostic | n/a | It *is* the converter | n/a | **Skip** (already inside render) |
| Mailpit / MailHog-class | Mailpit: single binary, SMTP :1025 + UI :8025 | n/a | n/a | n/a | SMTP catch-all inbox | **Skip** (architecturally incompatible) |
| Ethereal | Fake SMTP service for Nodemailer/SMTP users | n/a | n/a | n/a | Preview URL per message | **Skip** (SMTP-only + Nodemailer-tied) |
| Spam-check libs (`spamc`, `spamassassin-client`, `node-spamd`) | Stale (`spamc` 2014) | n/a | n/a | n/a | n/a | **Skip** (all require self-hosted `spamd` daemon) |
| `spamscanner` (Forward Email) | Actively maintained (Dec 2025) | Pure JS | n/a | n/a | Programmatic score | **Optional** later, skip now |

## Per-candidate notes

### 1. `react-email` + `@react-email/render` — ADOPT

- **Unification (v6).** Since 6.0.0 (2026-04-16) all components and render utilities live in one `react-email` package; `@react-email/components` (last: 1.0.12, 2026-04-09) and individual component packages are deprecated and frozen. Do not install them. ([release notes](https://github.com/resend/react-email/releases/tag/react-email%406.0.0), [npm @react-email/components](https://www.npmjs.com/package/@react-email/components))
- **Versions.** `react-email@6.9.5`, `@react-email/render@2.1.0`. ([npm react-email](https://www.npmjs.com/package/react-email), [npm @react-email/render](https://www.npmjs.com/package/@react-email/render))
- **Compat.** Both declare `peerDependencies: react ^18 \|\| ^19`, `react-dom` same, `engines: node >= 20`. Covers this repo (React 19.2.4, Next 16.3). ([react-email package.json](https://raw.githubusercontent.com/resend/react-email/canary/packages/react-email/package.json), [render package.json](https://raw.githubusercontent.com/resend/react-email/canary/packages/render/package.json))
- **Async render.** `render()` returns `Promise<string>` — every call site must `await`. Old sync `render` / `renderAsync` are deprecated. ([React Email 3.0 blog](https://resend.com/blog/react-email-3), [render docs](https://react.email/docs/utilities/render))
- **Convex compatibility.** `@react-email/render` ships an explicit `"convex"` export condition resolving to the edge build (`dist/edge`), the same build used for workerd/edge-light. This is first-party evidence it runs in Convex's V8 isolate; the default Convex runtime otherwise only supports browser/Deno/Workers-compatible libs, with `"use node"` actions as the escape hatch. ([render package.json exports](https://raw.githubusercontent.com/resend/react-email/canary/packages/render/package.json), [Convex runtimes](https://docs.convex.dev/functions/runtimes), [Convex actions runtime](https://docs.convex.dev/functions/actions))
- **Recommended architecture anyway: render in Next, send via mutation.** Templates live in `src/emails/`; a Next server context (Route Handler / Server Component, Node runtime) calls `await render(<Template/>)` + `toPlainText()`, then passes plain `{ to, subject, text, html }` strings into `enqueueSend`. This keeps JSX and the heavier `react-email` graph out of `convex/` entirely and makes preview and dispatch share one code path so copy can't drift. Rendering inside a Convex action is a fallback, not the default — and if ever needed, import the renderer from `@react-email/render` (convex condition), keep `"use node"` actions free of queries/mutations, and verify with `npx convex dev --once` + `pnpm typecheck` per repo rules.
- **Tailwind included.** The `<Tailwind>` component ships in the unified package and targets tailwindcss 4.1.12; use `pixelBasedPreset` (px, not rem) for email clients. Known limits: no context providers *inside* `<Tailwind>`, no `@tailwindcss/typography` `prose`, no `space-*`. ([Tailwind docs](https://react.email/docs/components/tailwind))
- **Weight caveat.** `react-email` 6.x bundles the CLI (esbuild, chokidar, socket.io, tailwindcss…) as package dependencies, so the install footprint is larger than the old split packages. `@react-email/render` alone is 4 deps (`entities`, `html-to-text`, `html5parser`, `prettier`). Author with `react-email`, call `render`/`toPlainText` from `@react-email/render`. ([react-email package.json](https://raw.githubusercontent.com/resend/react-email/canary/packages/react-email/package.json))

### 2. Preview server (`email dev`) — SKIP for embedding, optional local script

- `email dev` is a standalone file-watching server over an `emails/` dir (`--dir`/`--port` flags; default port 3000 collides with `next dev`, so configure e.g. `--port 3100`). It cannot be embedded in the dashboard route. `email build` / `email start` / `email export` are deploy/export helpers, with `export` explicitly documented as a discouraged fallback to manual templating. ([CLI docs](https://react.email/docs/cli), [skill reference](https://github.com/resend/react-email/blob/canary/skills/react-email/SKILL.md))
- Fit: extend the existing `src/app/dashboard/emails/page.tsx` pattern instead — call `render()` server-side and show the real HTML in an `<iframe srcDoc>` next to the current text cards. Same output the inbox will receive (Chromium frame, not a client-fidelity guarantee — see risks). The community production-preview pattern (auth-gated, fixture-only data, `noindex`/`no-store`) matches this approach. Keep fixtures synthetic (today's `demoInput()`); never feed real user rows into preview.

### 3. MJML — SKIP

- `mjml@5.4.0` (2026-06-29, ~1.7M wk dl) + `@faire/mjml-react@4.0.1` (2026-06-01) are alive and React-19-compatible, and MJML 5 fixed the stale `html-minifier` CVEs by moving to `htmlnano`/`cssnano`. ([npm mjml](https://www.npmjs.com/package/mjml), [v4.0.0 release](https://github.com/Faire/mjml-react/releases/tag/v4.0.0), [MJML5 upgrade PR](https://github.com/Faire/mjml-react/pull/147))
- Skip anyway: second paradigm (own XML-ish compiler, async `render` since v4), heavier dependency surface (umbrella pulls `mjml-cli` + `mjml-core` + `mjml-preset-core` + `mjml-validator`), no Tailwind story, no Convex/edge export condition, no text-fallback pipeline. It duplicates what react-email already covers.

### 4. `html-to-text` standalone — SKIP

- `html-to-text@10.0.0` (2026-04-30, ~13M wk dl, MIT) is healthy, but redundant: `@react-email/render` already bundles `html-to-text ^9` and exposes `toPlainText()`, the `plainText` render option, and `htmlToTextOptions` passthrough. Revisit only if text fallbacks must be generated somewhere react-email can't reach. ([npm html-to-text](https://www.npmjs.com/package/html-to-text), [render docs §4](https://react.email/docs/utilities/render))

### 5. Test dispatch — SKIP new infra; use an app-level guard

- **Mailpit** is an SMTP server (default `:1025`) plus UI (`:8025`); the app must deliver mail over SMTP to use it. This stack sends over HTTPS via the AgentMail Convex component — there is no SMTP transport to redirect, so Mailpit/MailHog-class tools have nothing to catch. ([Mailpit README](https://github.com/axllent/mailpit))
- **Ethereal** is a fake SMTP service for Nodemailer/SMTP users (`createTestAccount` → `createTransport`); same incompatibility, plus Nodemailer is banned by repo constraints. ([ethereal.email FAQ](https://ethereal.email/faq), [Nodemailer Ethereal guide](https://nodemailer.com/guides/testing-with-ethereal))
- **AgentMail has no test/dry-run mode.** The send body is exactly `to/cc/bcc/subject/text/html/attachments/headers/track_opens/labels` — every call is a real send. ([send reference](https://www.agentmail.to/docs/api-reference/inboxes/messages/send))
- Fit: gate at the app layer, no new infra — a `convex/lib/safeSend.ts`-style wrapper reading Convex env (e.g. `EMAIL_TEST_RECIPIENT` + flag): when enabled, force `to` to self, prefix subject with `[TEST]`, add a `test-send` label. Preview page stays no-send (as today). Note: AgentMail drafts support idempotent `clientId` sends, but the Convex component client (0.1.0) exposes no drafts API — only `sendMessage`/`replyToMessage`/`forwardMessage`/`cancel`/`status` — so that pattern is unavailable without bypassing the component. ([preventing-duplicate-sends](https://www.agentmail.to/docs/knowledge-base/preventing-duplicate-sends), installed `dist/client/index.d.ts`)

### 6. Deliverability checks — SKIP libs; manual checklist

- `spamc` (2014), `spamassassin-client`, `node-spamd` are thin TCP clients to a self-hosted SpamAssassin `spamd` daemon — new infra for stale packages. ([registry: spamc](https://registry.npmjs.org/spamc), [registry: spamassassin-client](https://registry.npmjs.org/spamassassin-client))
- `spamscanner` (Forward Email, published Dec 2025) is the only maintained pure-JS option (Bayes/phishing/ClamAV), but it is threat-scanning weight this stage doesn't need. Revisit if outbound volume or phishing-adjacent content ever justifies it. ([npm spamscanner](https://www.npmjs.com/package/spamscanner))
- Enough for now: keep rendered HTML under ~102 KB (Gmail clips above), absolute HTTPS image URLs, always send `text` + `html` (AgentMail best practice), and run one manual pass over a seed list + mail-tester-style check before launch. ([react-email skill guide](https://github.com/resend/react-email/blob/canary/skills/react-email/SKILL.md), [AgentMail messages doc](https://www.agentmail.to/docs/messages))

## Recommended install list (exact names)

```sh
pnpm add react-email@6.9.5 @react-email/render@2.1.0
```

Do not install: `@react-email/components`, `mjml`, `@faire/mjml-react`, `html-to-text`, `mailpit`, `nodemailer`, any `spamc`/`spamassassin*` client.

## Recommended file layout (lean, one concern per file)

```text
src/emails/
  SubscriptionEmail.tsx  # 4 templates as typed react-email components (renewal/trial/cancelled/reminder)
  emailLayout.tsx        # shared shell: Html/Head/Preview/Container/header/footer/CTA
  previewProps.ts        # synthetic fixtures only (extend today's demoInput; no user data)
  renderEmail.ts         # renderEmail(element) -> Promise<{ subject, html, text }> via render() + toPlainText()
src/app/dashboard/emails/
  page.tsx               # existing route: keep text cards, add iframe srcDoc HTML pane per template
convex/lib/
  agentmail.ts           # add html?: v.optional(v.string()) and forward to sendMessage (code change)
  safeSend.ts            # env-gated recipient override + [TEST] prefix + test-send label (code change)
  emailTemplates.ts      # keep as text source-of-truth until migration, then retire
```

Rules preserved: sends still go only through `enqueueSend`; secrets stay in Convex env; Hugeicons stays in app UI (email HTML uses react-email `<Button>`/text CTAs, not SVG icon components); after any `convex/` change run `npx convex dev --once` + `pnpm typecheck`.

## Risks / caveats

- **Churn.** `react-email` moved fast in 2026 (6.0 unification in April → 6.9.x by September). Pin exact versions; re-check the [changelog](https://react.email/docs/changelog) on every upgrade. Never import from `@react-email/components` — deprecated path.
- **Async everywhere.** `render()` is a Promise; forgetting `await` ships `[object Promise]` as the email body. A single `renderEmail.ts` choke point prevents this class of bug.
- **Preview ≠ inbox.** The dashboard iframe shows Chromium rendering; Outlook (Word engine), Gmail clipping/stripping, and dark-mode inversion still need real-inbox spot checks before launch. (Workflow rationale: [Postdrop guide](https://blog.postdrop.io/post/how-to-preview-react-email-templates-across-clients).)
- **Convex bundling.** If templates ever get imported under `convex/`, the default V8 isolate may reject Node-only transitive deps — `@react-email/render`'s `convex` condition is the supported path, `"use node"` files may not also export queries/mutations, and `emailTemplates.ts` is currently imported by a client component, so moving it must preserve that boundary. ([Convex runtimes](https://docs.convex.dev/functions/runtimes))
- **Tailwind limits.** No context providers inside `<Tailwind>`; no `prose` / `space-*` utilities (documented, not bugs). ([Tailwind docs](https://react.email/docs/components/tailwind))
- **Every AgentMail send is real.** There is no sandbox inbox or dry-run flag; the safe-send guard and fixture-only previews are the entire safety story until team's process adds a seed-list step.
