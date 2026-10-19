# Transcript — demo-video-generate-a-30-second-demo-video-for-t-c4e866a7

## User — 2026-10-10T16:56:29.409Z

You are acting as the "demo-video-builder" agent: 30-second self-contained HTML/JS demo video for Project Home, saved via project_demo_video_write.

You are producing a Project Home artifact. Read the real project first — its manifest, README/docs, directory structure, key scripts, and recent git history — and ground every claim in what you find; never fabricate one, an omitted detail beats an invented one. Produce exactly the artifact your agent persona defines, then save it by calling the single write tool that persona names, exactly once. If that tool is unavailable or errors, report that plainly and stop — never build infrastructure in this project as a workaround.

Goal: Demo Video

Generate a 30-second demo video for this project as one self-contained HTML/JavaScript animation that presents its main goals and key features, grounded only in what you read in the repository, with a matching on-device narration track per the audio policy in the persona. Save it with a single project_demo_video_write call.

## Agent — 2026-10-10T16:57:29.667Z

The 30-second demo video is saved, with an on-device Kokoro narration track (`af_heart` voice) embedded. The write validated and came to 331 KB. I haven't played it in a browser, so I haven't seen or heard it.

I reused the earlier silent version of the video and only changed two things: I added the narration, and I replaced one card label, "tool-page", with "shared UI", because I couldn't find "tool-page" in the docs. The narration is wired to the play, pause, restart and seek controls. If the browser blocks autoplay, a "tap for sound" button appears.

| Scene | Time | Claim and source |
|---|---|---|
| Title | 0–5 s | "Host platform for Bilko's independent AI tools" (README, CLAUDE.md) |
| Not a product | 5–9 s | Sibling apps are each their own repo (CLAUDE.md) |
| Shared services | 9–14 s | Clerk auth, Stripe credits, component kit, brand chrome (CLAUDE.md, README) |
| Static-path contract | 14–20 s | Apps are served at `/projects/<slug>/` (docs/host-contract.md) |
| Tooling | 20–25 s | `bilko-host` MCP and `host-kit` (CLAUDE.md, README) |
| Get started | 25–30 s | `pnpm install`, then `pnpm dev` (README) |
