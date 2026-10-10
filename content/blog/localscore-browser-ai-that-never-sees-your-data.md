---
slug: "localscore-browser-ai-that-never-sees-your-data"
title: "Read a contract with AI that stays on your computer"
excerpt: "Paste a contract, bill or meeting notes into LocalScore and get a plain English summary. The AI runs in your browser, so your text is never uploaded."
category: "deep-dive"
published: true
published_at: "2026-04-04T09:12:07.754Z"
order: 3
---

Paste a lease, an invoice, or a messy meeting thread into LocalScore and get a plain English summary back. The AI runs inside your browser tab, so your words are not uploaded anywhere. After the first setup, you can even turn off your wi-fi and keep going.

## Paste a contract, get plain English back

Most AI tools make you choose. Paste a private paper into a cloud chatbot and it travels to someone else's server. Skip the tool and you read every line yourself.

LocalScore removes that choice. You pick what kind of text you have: a contract, a bill or invoice, meeting notes, or your own website copy. Then you paste it in.

Each kind comes with its own questions. For a contract, the tool asks the AI to explain what each side has to do. It also asks for the key dates and the money involved. Anything that looks risky comes with a reason why, and anything that seems to be missing gets flagged. Legal terms are explained in parentheses.

![The LocalScore page with a Private and Free card and a green Get Started button](/blog-images/localscore-browser-ai-that-never-sees-your-data/landing.jpg "The top of the live page: one button starts the setup, and the card says nothing gets uploaded.")

## What stays on your computer

The AI is Gemma 2B, a small open model from Google. It runs on your graphics chip through WebGPU, a browser feature. Your text goes to that model inside the tab, not to a server.

The project's README calls the app 100% client-side: documents never leave the browser. The page says the only network request is the one-time model download on your first visit. After that it says the work happens on your device.

There is one more thing to know. The project's rules ban any network call that carries your document. The page does send small usage counts, such as which kind of text you picked. If you open your browser's developer tools and watch the Network tab, you will see those. Your text should not be in any of them.

![The old way, where words travel the internet to a big server, next to the new way, where they stay in your browser](/blog-images/localscore-browser-ai-that-never-sees-your-data/how-it-works.jpg "The page's own comparison: the old way sends your words to a server, the new way keeps them in your browser.")

## Who it helps, and where it stops

It helps anyone holding papers they would rather not upload. Think of a renter with a lease, a freelancer with an NDA, or a shop owner with a stack of invoices. A thread on r/SideProject with 53 upvotes found that people praise tools that never upload their files, and bookmark them even for small jobs.

The tool is free. It needs no account and no password.

The limits are real. It runs in Chrome or Edge on a computer, not on phones yet. The first visit takes 1 to 2 minutes while the model sets up. The model is small. Its context setting is 4,096 tokens, which are small chunks of words. A long contract may need to go in pieces.

![The public GitHub page for the local-score repository](/blog-images/localscore-browser-ai-that-never-sees-your-data/github-repo.jpg "The source is public: three commits, no releases, last pushed in May 2026.")

The repo is small. The phone gap and the short context window are the two things worth fixing next.

You can [try LocalScore](https://bilko.run/projects/local-score/) in Chrome or Edge on a computer, and [read the code](https://github.com/StanislavBG/local-score) on GitHub.
