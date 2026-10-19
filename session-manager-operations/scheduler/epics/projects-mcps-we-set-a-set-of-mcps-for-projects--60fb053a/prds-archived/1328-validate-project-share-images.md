---
title: Validate: projects can publish their own icon or share image and each X link shows it
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T04:04:16.722Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
tag: build
agentType: validator
dependsOn: [listing-share-image-fields, og-custom-share-image, publish-gate-share-assets, og-card-icon, catalog-share-image-url, doc-share-images]
planId: pl-mv653d38-529056
---
# Goal

validate: verify listing-share-image-fields (registry icon/shareImage), og-custom-share-image (/og serves shareImage), publish-gate-share-assets (share-assets publish gate), og-card-icon (icon on generated card + ?v= cache-bust), catalog-share-image-url (catalog share_image_url), doc-share-images (host-contract docs).

# Acceptance criteria

- [ ] listing-share-image-fields: every AC in /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a/prds/1321-listing-share-image-fields.md (or prds-archived/) holds and its gate passes.
- [ ] og-custom-share-image: every AC in .../prds/1322-og-custom-share-image.md (or prds-archived/) holds and its gate passes.
- [ ] publish-gate-share-assets: every AC in .../prds/1323-publish-gate-share-assets.md (or prds-archived/) holds and its gate passes.
- [ ] og-card-icon: every AC in .../prds/1324-og-card-icon.md (or prds-archived/) holds and its gate passes.
- [ ] catalog-share-image-url: every AC in .../prds/1325-catalog-share-image-url.md (or prds-archived/) holds and its gate passes.
- [ ] doc-share-images: every AC in .../prds/1326-doc-share-images.md (or prds-archived/) holds and its gate passes.
- [ ] Write and commit session-manager-operations/reviews/validation/projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a/validate-project-share-images.md with one verdict per PRD and combined-diff findings (pay attention to path traversal in server/og-assets.ts and the share-assets gate).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a/validate-project-share-images.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 7dc9cf91eabaf4cc01a7dc2d831eb2daba68d844
PRD files: /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a/ (prds/ or prds-archived/, find by slug). Also run `timeout 600 pnpm test` once for cross-PRD breakage.

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
