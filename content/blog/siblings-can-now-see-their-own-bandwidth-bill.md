---
slug: "siblings-can-now-see-their-own-bandwidth-bill"
title: "Siblings Can Now See Their Own Bandwidth Bill"
excerpt: "mcp-host's new usage_report tool lets any sibling project ask \"how much am I actually costing?\" — built after Bilko itself turned out to be its own biggest traffic source."
category: "build-log"
published: true
published_at: "2026-08-19T16:00:00.000Z"
order: 35
---

[mcp-host](https://github.com/StanislavBG/bilko-run/tree/main/mcp-host-server) — the MCP server that registers and publishes every static-path project on this site — can now answer a question no sibling project could ask itself before: how much bandwidth am I actually using? Any project wired to it can call a new `usage_report` tool and get its own per-project egress — bytes, requests, bytes-per-request — with no browser session or auth token required, where before that data only existed behind a Clerk-gated admin page a human had to open by hand.

The tool shipped honest about its own limits: numbers are a capacity signal, not a Render bill, they can under-report by up to a minute around a process restart, and one known attribution gap — some projects' own asset folders still get miscounted under the host's general bucket — is called out in the tool description rather than quietly left for someone to discover.

Also shipped: the platform found out it was generating a meaningful chunk of its own bill. A single page load was firing 26 CSP violation reports because the policy forbade things the site actually loads. Security nonces meant to lock down inline styles had been silently inert in production the whole time, because the static file server streams responses in a way that skipped the nonce-injection step — the site's own bundle was violating its own policy on every load. And an unlisted, "postponed" game project was still fully serving 116 MB of uncached sprite assets to every visitor, because nobody checks whether something hidden from the UI is still costing money. Compressing origin responses before they leave the server cut the biggest offender's real egress by roughly 8x — a snapshot endpoint that was billing 733 KB a request was only ever sending 93 KB over the wire.

The `usage_report` tool exists because none of that would have been visible without someone going and looking by hand — now a sibling can just ask.