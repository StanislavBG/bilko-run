---
slug: "the-web-remote-now-survives-a-reload"
title: "The web remote now survives a page reload"
excerpt: "Pairing a phone to the desktop cockpit meant re-verifying the SAS code on every reload, because the browser key was born fresh each time. The fix rests on a browser fact worth knowing: IndexedDB can store a non-extractable CryptoKey directly."
category: "product"
published: true
published_at: "2026-07-21T16:00:00.000Z"
order: 27
---

I shipped v0.35.17 and v0.35.18 of [Session Manager](/projects/session-manager/) this week; the part I want to write down is the phone remote's trust model.

The web remote lets a browser drive the desktop cockpit end-to-end encrypted, with a short SAS code you compare on both screens to confirm the pairing. It worked, with one grinding flaw: every page reload generated a fresh browser keypair, so the desktop saw a stranger and demanded the SAS ceremony again. Reload, re-verify, forever.

The naive fix is to persist the key in localStorage — which requires marking the private key extractable, trading a reload annoyance for an actual weakening of the encryption. The fix that shipped rests on a browser fact I didn't know: IndexedDB, unlike localStorage, can store a **non-extractable** CryptoKey directly via structured clone. The private key persists across reloads without ever existing in exportable form. The desktop side is trust-on-first-use: a manual SAS confirmation pins that browser's public key to the device, exact key match reconnects silently, any other key still gets the full ceremony.

Same release, same theme of silent failure: the desktop's terminal-write handler reported success to the remote unconditionally — including when the write failed — so keystrokes from the phone could vanish while the phone showed everything fine. The write path now returns a real result and the remote surfaces it.

One more fix worth its sentence: the scheduler was flagging jobs for review because they "passed without committing anything," when the true story was that someone else had already merged the target PR. The verifier now checks the world before judging the diff.

Still rough, honestly: the fix for the mobile app hanging on its connect screen after pairing landed a day *after* the release tag, so it rides the next one. And the 772-test suite briefly broke main the morning after the big sweep — a test file written in the wrong framework's idiom, repaired the same day.