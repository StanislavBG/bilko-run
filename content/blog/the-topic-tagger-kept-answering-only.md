---
slug: "the-topic-tagger-kept-answering-only"
title: "The topic tagger kept answering „само\""
excerpt: "Measuring how Bulgarians react to Sigma on Facebook meant asking a 3B local model to tag topics — and it answered with the word \"only.\" Three rounds of tag garbage, a format contract that broke silently, and the filter that removes noise and headlines alike."
category: "deep-dive"
published: true
published_at: "2026-07-11T16:00:00.000Z"
order: 25
---

Sigma-plus is a measurement pipeline that asks one question: is anyone actually reacting to [СИГМА](https://sigma.midt.bg), and what are they saying? Burrow monitors the two Facebook pages where the platform gets discussed, and a local model (qwen2.5:3b via Ollama, deliberately on-machine — the corpus is public speech by named citizens, and it stays here) tags each comment with sentiment and up to three Bulgarian topic tags.

The topic tags came back garbage, three times, differently each time.

Round one: on a corpus where every single item is about Sigma, the model tagged everything „сигма" and „платформа". Useless. The fix was a blocklist plus a rule that generalizes it: drop any tag attached to more than 60% of items, because a tag that describes most of the corpus describes none of it.

Round two: with the catch-alls gone, the model reached for function words. The blocklist additions from that commit are the whole story: „само" (only), „още" (still), „вече" (already), „обаче" (however), „значи" (so). Ask a 3B model to name a topic and it hands you the word "only." The database still holds the fossil: a cached summary keyed to the topic „само", earnestly stitching together two unrelated citizen comments. What survived the filters was real — „реформа" (116 items), „корупция" (112).

Round three was the summarizer. Fed a numbered list of tagged quotes and asked for two flowing sentences, it echoed the input format straight back — numbered list, `[positive]` labels and all. The fix bans the format in the prompt *and* strips it with a regex, because I didn't trust the prompt to hold.

Meanwhile the corpus itself grew up. The first harvest crawled Burrow's embedding index with ~40 hand-written probe queries and snowballed from there — 120 queries recovered roughly 35 items from a 985-chunk collection, with no way to know the true fraction. Two things fixed that. A flag I'd simply missed (`include_body:true`, surfaced by Burrow's own root-cause writeup after I filed a "posts have no text" report that turned out to be reader-side) took one page's comments from 23 to 129 in a single run. Then Burrow shipped `list_chunks` on my request — plain cursor pagination over the whole collection — and coverage became exact: 1,005 of 1,005 chunks enumerated, footer switched from „частична извадка" to „ПЪЛНО".

The sting came a day later. Burrow had declined to add structured comment fields because my parser read its excerpt labels fine — "parses beautifully — nice format." Then a new ingest changed the label prefix from `[Facebook comment …]` to `[SIGMA comment …]`. No error anywhere; about a thousand comments silently vanished from the classified set, caught only because a human noticed a reel with 200+ comments while the page total showed ~130.

What I'd do differently: the moment two systems agree on a text format, write the format down and test it on both sides. The prefix-agnostic parser with its own test file exists now; it should have existed before the compliment.

The cost worth admitting: the 60% cap that removes noise also removes the most common genuine tag — „прозрачност" (transparency), on 73% of items, which is both the corpus's actual subject and invisible in the topic list. The heuristic can't tell a catch-all from a headline.