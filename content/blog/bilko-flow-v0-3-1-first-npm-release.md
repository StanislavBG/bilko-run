---
slug: "bilko-flow-v0-3-1-first-npm-release"
title: "Shipping bilko-flow v0.3.1: Our First Public npm Package"
excerpt: "We open-sourced the workflow library that powers the NPR ad skipper. Two commits, one license change, one missing folder in the tarball — and a pile of lessons about what it actually takes to publish a usable package."
category: "deep-dive"
published: true
published_at: "2026-04-20T07:27:07.994Z"
order: 8
---

## What bilko-flow is

[bilko-flow](https://www.npmjs.com/package/bilko-flow) is a TypeScript library for describing, validating, and executing deterministic workflows from natural language. It's the piece that sits between "a user describes what they want" and "an executor runs a reproducible pipeline."

Three capabilities that matter:

- **Text-to-pipeline**: an `LLMPlanner` turns a natural-language description into a validated DSL document
- **Determinism grades**: every workflow declares itself `Pure`, `Replayable`, or `Best-Effort`, and the compiler enforces it
- **Provenance**: the reference executor hashes inputs with SHA-256 and signs runs with HMAC, so you can prove what actually ran

It also ships React components (`FlowProgress`, `FlowCanvas`, `FlowTimeline`) for visualizing running pipelines, and adapters for memory stores, Ollama, vLLM, TGI, and LocalAI.

Internally, bilko-flow has been the backbone of the [NPR ad skipper](/blog/npr-ad-skipper-gemini-only-and-97-percent-agreement) pipeline for months. This week it graduated to a public npm package.

## Commit 1: MIT license (`40636a9`)

The previous license was a boilerplate "all rights reserved" — fine for internal use, broken for everything else. npm's ecosystem assumes permissive licensing; a proprietary package can't be a transitive dependency of anything open.

Switching to MIT was a five-line change: license header, `LICENSE` file, `"license": "MIT"` in `package.json`, `README` badge, and removing `"private": true`. The important part isn't the lines — it's the decision that this library is worth more to us as something others can build on than as something we keep to ourselves.

Not every internal library clears that bar. bilko-flow does because the contract (a typed DSL with determinism grades) is the sort of thing that's genuinely useful to other people building LLM pipelines, and nothing in it is specific to what we do with it.

## Commit 2: The src/ tarball bug (`581175f`)

v0.3.0 shipped to npm. The NPR ad skipper picked it up. Build broke.

The reason: npm's default `files` whitelist includes `package.json`, `LICENSE`, and whatever `main` points to. It does *not* include `src/`. Our `package.json` had an explicit `files` list — which, because it was explicit, overrode the default — and `src` wasn't in it.

The consumer (npr-podcast) does two things that needed source:

1. **Vite import aliases** — imports resolve directly to `node_modules/bilko-flow/src/*.ts` instead of the compiled `dist/` exports, for hot reload during development.
2. **`patch-package` patches** — specifically `src/react/step-detail.tsx` had a local override applied at install time.

Without `src` in the tarball, both patterns silently break. The Vite alias resolves to a non-existent file; `patch-package` fails because there's nothing to patch.

The fix was a single line:

```diff
 "files": [
   "dist",
-  "README.md"
+  "README.md",
+  "src"
 ]
```

Bumped to v0.3.1. npr-podcast's `package.json` updated to `"bilko-flow": "^0.3.1"`. Build fixed.

## Lessons from a two-commit release

This is the kind of release people don't write build logs about. Two commits. No new features. No architecture. But it's the one that took the library from "something internal" to "something anyone can `npm install`," and the gap between those two states is full of exactly this kind of footgun.

**Publish early so you find the footguns early.** We'd have caught the missing `src/` months ago if bilko-flow had been on npm in any form. Internal consumers using Git URLs don't exercise the tarball path. Your first external consumer is your first real test.

**The `files` field is a fence, not a door.** If it's defined, npm uses it *instead of* the defaults. Every item you want shipped has to be listed.

**License first, not last.** The MIT switch was technically trivial but unblocked everything downstream. We could have done it in week 1 of the project and saved ourselves the last-minute audit.

## What bilko-flow is good for

If you're building an LLM pipeline and you're tired of:

- manually validating that the JSON your LLM emitted is a valid pipeline spec
- reasoning about whether a step is reproducible or flaky
- reimplementing the same React `<ProgressBar />` for every new workflow tool

bilko-flow gives you a typed DSL, compiler-enforced determinism grades, and drop-in React components. It's Apache-licensed (well, MIT now) and on npm:

```bash
npm install bilko-flow
```

The [NPR ad skipper](/blog/npr-ad-skipper-gemini-only-and-97-percent-agreement) is the reference consumer. Four pipelines (fetch → parse → STT → classify → play) are orchestrated through bilko-flow, visualized with `FlowProgress`, and checkpoint their state so a crash mid-episode resumes cleanly.

## What's next

The short list for v0.4:

- **`proposeRepair`** improvements — the planner protocol's four methods include `proposeRepair` for fixing broken runs, and it's the least-tested path
- **Better adapter docs** — the Ollama / vLLM / TGI / LocalAI plug-ins all exist but their docs assume you already know how to configure each
- **Streaming executor** — right now the reference executor is synchronous; streaming would unblock use cases where a long-running step wants to report progress

And if you build something on bilko-flow, tell me. The whole reason it's public is that the contract is general enough to be worth sharing.

## FAQ

**Is bilko-flow competing with Temporal / Inngest / LangGraph?**
No. Temporal and Inngest are managed workflow services; LangGraph is a graph-state library. bilko-flow is closer to a typed DSL with provenance — you could run it *inside* an Inngest function or alongside LangGraph.

**Why the determinism grades?**
Because "is this reproducible?" is the question every LLM pipeline eventually has to answer, and declaring it in the spec beats re-deriving it from the code.

**Where do I read the full docs?**
[bilko-flow on npm](https://www.npmjs.com/package/bilko-flow) — README is the canonical doc. Source is in the tarball (now) for anyone who wants to read the types directly.