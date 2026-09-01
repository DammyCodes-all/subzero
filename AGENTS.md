# AGENTS.md

Keep every file lean and modular — one concern per file, small surface area, no duplication.

Icons: Use [Hugeicons](https://hugeicons.com) only (`@hugeicons/react` + `@hugeicons/core-free-icons` via `HugeiconsIcon`). Do not add lucide-react, heroicons, or other icon libs.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
