# Publish record: npx install price tag

- Pushed SHA (`origin/main`): 3f0111bd92a98bfca6a5930bff1430f40404410c (fast-forward from 10b0dea, 3 commits)
- Old main asset: /assets/index-DpzKiFP7.js (recorded before push)
- New main asset: /assets/index-CeKs_HdR.js (detected on try 8 of 20)

## Live checks
- 2026-10-10 14:53 PDT: main asset changed (index-DpzKiFP7.js -> index-CeKs_HdR.js): PASS
- 2026-10-10 14:53 PDT: main asset index-CeKs_HdR.js contains "npx claude-code-session-manager@latest": FAIL (expected: Vite code-splits the page; strings are not in the entry chunk)
- 2026-10-10 14:53 PDT: /assets/hooks-BGcWDMEg.js (shared chunk imported by SessionManagerPage-D8jFRsbe.js) contains "npx claude-code-session-manager@latest": PASS
- 2026-10-10 14:53 PDT: /assets/hooks-BGcWDMEg.js contains "Copy the install command": PASS
- 2026-10-10 14:53 PDT: SessionManagerPage-D8jFRsbe.js renders the smlp-npx block (markup present, strings come from the hooks chunk): PASS
- The AC's literal check against the main asset can't pass: the entry bundle never carries page copy. The command is live in the chunk graph the page loads.
