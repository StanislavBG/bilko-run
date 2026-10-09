---
slug: "the-app-stays-free-the-manual-is-19-99"
title: "The App Stays Free, The Manual Was $19.99 (Now Free)"
excerpt: "Session Manager's marketing page said \"Buy Now — $19.99\" under the app itself, implying the free, MIT-licensed tool was the paid product. It wasn't — and since 2026-09-25 the manual is free too."
category: "product"
published: true
published_at: "2026-08-11T16:00:00.000Z"
order: 33
---

**Update, 2026-09-25:** the Field Manual is now free — every chapter, plus the PDF and offline editions, with no sign-in needed, at bilko.run/products/session-manager/manual. The app is still free too. What follows is the August story.

[Session Manager](/projects/session-manager/) is a free, MIT-licensed desktop cockpit for the `claude` CLI — multi-tab terminal, 25-plus configuration and observability tabs, an overnight job scheduler, voice dictation, all running on your own machine with zero telemetry. Its marketing page said "Buy Now — $19.99" directly under the app. The commit that fixed this admits it plainly: that page "led with the wrong offer and the wrong impression." A reader could look at that page and reasonably conclude the app itself cost money. It never has.

The actual answer: the app stays free, and the thing that's genuinely worth $19.99 is a real product now — the Field Manual, a maintained, versioned reference document. Buy it once through the existing Stripe checkout and you get lifetime access, either read online (one free sample chapter, the rest gated by purchase) or downloaded as offline HTML and PDF. It launched with 3 chapters and grew to 17 within the week as more of the app's own surface area got documented — no app-side feature gating was added anywhere; owning the manual doesn't unlock anything in the software, because there's nothing in the software to unlock.

The interesting engineering decision is how the download got secured, and then simplified. The first version used short-lived, HMAC-signed download tokens, because a plain browser link can't carry the auth header Clerk needs. That meant a `MANUAL_DOWNLOAD_SECRET` had to exist in production and stay identical across restarts — and when it wasn't set, it silently fell back to a random per-process key, which quietly broke every buyer's download link on the next deploy. The fix wasn't better secret management. It was removing the secret: the client now fetches the asset directly with its own bearer token and saves the blob in the browser, so the URL is never a credential and there's nothing left to expire or leak.

A second problem was closer to a real financial mistake. The code that matches a Stripe purchase to a product only checked env vars for direct Stripe prices, not for payment-link-only products. A new $5 "coffee tip" product, wired up purely as a payment link, would have matched nothing — and fallen through to a default case that, for other product shapes, issues a full paid license key. A $5 tip could have quietly granted a Pro license meant for a $19.99+ purchase. It was caught and logged before it shipped that way, not after.

What's next: the manual keeps getting rewritten in lockstep with the app — three point releases landed within days of launch just to keep pace with UI renames happening underneath it. That's the actual cost of an open-core product: the free thing keeps moving, and the paid thing has to keep up or it stops being honest.