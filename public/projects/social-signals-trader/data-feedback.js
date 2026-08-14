window.FEEDBACK_THREADS = {
  "counts": {
    "active": 3,
    "answered": 2,
    "archived": 0,
    "proposal": 1,
    "system": 0,
    "total": 3,
    "trade": 2,
    "unanswered": 1
  },
  "generatedAt": "2026-08-14T00:06:56Z",
  "schema": 2,
  "threads": [
    {
      "answered": false,
      "archivedAt": null,
      "contractKey": "NFLX-P-75-74-2026-08-21",
      "createdAt": "2026-08-13T23:36:06.000Z",
      "description": "What made you go with PUT over CALL?",
      "hasImage": false,
      "id": "fb_mss5pq4b_crdgipdi",
      "lastActivityAt": "2026-08-13T23:36:06.000Z",
      "messages": [
        {
          "author": "visitor",
          "authorLabel": "Visitor",
          "body": "What made you go with PUT over CALL?",
          "createdAt": "2026-08-13T23:36:06.000Z",
          "hasImage": false,
          "id": "fb_mss5pq4b_crdgipdi",
          "role": "user",
          "title": "This is looking sus"
        }
      ],
      "replies": [],
      "route": "#options",
      "scope": "proposal",
      "stage": "proposal",
      "status": "open",
      "targetId": "proposal-NFLX-put-75-74-2026-08-21",
      "targetKind": "component",
      "targetLabel": "NFLX 75/74 put spread, expires 2026-08-21",
      "title": "This is looking sus",
      "type": "feedback"
    },
    {
      "answered": true,
      "archivedAt": null,
      "contractKey": "BABA-C-143-144-2026-08-14",
      "createdAt": "2026-08-09T23:17:11.000Z",
      "description": "Which value is true? And why it is a loss at all?",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz",
      "lastActivityAt": "2026-08-13T22:43:19Z",
      "messages": [
        {
          "author": "visitor",
          "authorLabel": "Visitor",
          "body": "Which value is true? And why it is a loss at all?",
          "createdAt": "2026-08-09T23:17:11.000Z",
          "hasImage": false,
          "id": "fb_msmf9zlo_v0a1ebjz",
          "role": "user",
          "title": "[B] Why are we showing 4k loss here? 7k on detail?"
        },
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "Good catch \u2014 they're two different quantities, and one of them is wrong. The -$4,032 on the Options Log is the position's open (unrealised) P&L; the $7,448 on the detail page is labelled max loss and means the worst case if the spread finishes fully in the money, not money lost. So they were never meant to agree. But neither number checks out: this is 56 contracts of a $1-wide 143/144 call spread opened for a $0.33 credit, now marked $0.39. Open P&L should be (0.39 - 0.33) x 56 x 100 = -$336, and worst case should be (1.00 x 56 x 100) - $1,848 = $3,752. Both figures we showed are exactly what you get if the entry credit is added instead of subtracted, so we're treating this as a sign bug in how the entry credit is carried and it's queued for a fix. And on 'why is it a loss at all' \u2014 a small open loss just means the spread is marked slightly wider than we sold it; BABA is at $128.41 with the short strike at $143, so the trade is still 11% out of the money with 5 days left. Nothing has been realised. We'll update this thread once the numbers are corrected.",
          "createdAt": "2026-08-09T23:22:44Z",
          "hasImage": false,
          "id": "fb_msmf9zlo_v0a1ebjz.r1",
          "role": "agent"
        },
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "Correction to our earlier answer \u2014 we got this wrong, and the original $7,448 figure you asked about was in fact the correct one. We described this as a credit spread. It was not. The broker record shows we sold the 143 call at $0.05 and bought the 144 call at $0.38 \u2014 short the lower strike, long the higher one, which is a bear call spread, but entered for a net $0.33 DEBIT of $1,848 rather than for a credit. That structure cannot make money at any price: the best possible outcome is both legs expiring worthless and losing the $1,848 we paid, and the worst is the full $1 width against us. Max loss really was $5,600 + $1,848 = $7,448, exactly as the detail page said. Our previous reply's '-$336 open P&L' and '$3,752 max loss' were both wrong, because they assumed a credit we never collected. The real open loss was -$4,704. We have now closed the position: we bought the short 143 call back at $0.51 today, and the long 144 call has no bid left and expires worthless tomorrow, for a realised loss of about $4,704. Two separate problems stand behind your question. The display bug you spotted is real and still queued. The bigger one is that the fund opened a spread that was mathematically incapable of profiting, and no entry check caught it \u2014 that is the more valuable half of this feedback, and it is the one we are treating as serious. Thank you for pushing on it.",
          "createdAt": "2026-08-13T18:26:09Z",
          "hasImage": false,
          "id": "fb_msmf9zlo_v0a1ebjz.r2",
          "role": "agent"
        },
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "Closing the loop from our last reply here: the guard we said was 'queued' is now live. A hard min_net_credit floor is enforced twice for every CREDIT_SPREAD candidate \u2014 once in the scan (with its own funnel line so a rejected name stays visible instead of silently vanishing) and again as the final check right before an order is built, against the exact price about to be submitted rather than the earlier scan estimate. Zero and negative net credit are both refused unconditionally; a missing/unreadable price is treated the same as a non-positive one. And if a fill somehow still reconciles to a non-positive credit despite that, it now triggers a loud WARNING (trade, scored credit, actual credit, slippage) plus a durable audit-log entry, not just a quiet log line. This trade (and INTC 88/87 the same week) is what these checks exist to stop from happening again.",
          "createdAt": "2026-08-13T22:43:19Z",
          "hasImage": false,
          "id": "fb_msmf9zlo_v0a1ebjz.r3",
          "role": "agent"
        }
      ],
      "replies": [
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "Good catch \u2014 they're two different quantities, and one of them is wrong. The -$4,032 on the Options Log is the position's open (unrealised) P&L; the $7,448 on the detail page is labelled max loss and means the worst case if the spread finishes fully in the money, not money lost. So they were never meant to agree. But neither number checks out: this is 56 contracts of a $1-wide 143/144 call spread opened for a $0.33 credit, now marked $0.39. Open P&L should be (0.39 - 0.33) x 56 x 100 = -$336, and worst case should be (1.00 x 56 x 100) - $1,848 = $3,752. Both figures we showed are exactly what you get if the entry credit is added instead of subtracted, so we're treating this as a sign bug in how the entry credit is carried and it's queued for a fix. And on 'why is it a loss at all' \u2014 a small open loss just means the spread is marked slightly wider than we sold it; BABA is at $128.41 with the short strike at $143, so the trade is still 11% out of the money with 5 days left. Nothing has been realised. We'll update this thread once the numbers are corrected.",
          "createdAt": "2026-08-09T23:22:44Z",
          "id": "fb_msmf9zlo_v0a1ebjz.r1"
        },
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "Correction to our earlier answer \u2014 we got this wrong, and the original $7,448 figure you asked about was in fact the correct one. We described this as a credit spread. It was not. The broker record shows we sold the 143 call at $0.05 and bought the 144 call at $0.38 \u2014 short the lower strike, long the higher one, which is a bear call spread, but entered for a net $0.33 DEBIT of $1,848 rather than for a credit. That structure cannot make money at any price: the best possible outcome is both legs expiring worthless and losing the $1,848 we paid, and the worst is the full $1 width against us. Max loss really was $5,600 + $1,848 = $7,448, exactly as the detail page said. Our previous reply's '-$336 open P&L' and '$3,752 max loss' were both wrong, because they assumed a credit we never collected. The real open loss was -$4,704. We have now closed the position: we bought the short 143 call back at $0.51 today, and the long 144 call has no bid left and expires worthless tomorrow, for a realised loss of about $4,704. Two separate problems stand behind your question. The display bug you spotted is real and still queued. The bigger one is that the fund opened a spread that was mathematically incapable of profiting, and no entry check caught it \u2014 that is the more valuable half of this feedback, and it is the one we are treating as serious. Thank you for pushing on it.",
          "createdAt": "2026-08-13T18:26:09Z",
          "id": "fb_msmf9zlo_v0a1ebjz.r2"
        },
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "Closing the loop from our last reply here: the guard we said was 'queued' is now live. A hard min_net_credit floor is enforced twice for every CREDIT_SPREAD candidate \u2014 once in the scan (with its own funnel line so a rejected name stays visible instead of silently vanishing) and again as the final check right before an order is built, against the exact price about to be submitted rather than the earlier scan estimate. Zero and negative net credit are both refused unconditionally; a missing/unreadable price is treated the same as a non-positive one. And if a fill somehow still reconciles to a non-positive credit despite that, it now triggers a loud WARNING (trade, scored credit, actual credit, slippage) plus a durable audit-log entry, not just a quiet log line. This trade (and INTC 88/87 the same week) is what these checks exist to stop from happening again.",
          "createdAt": "2026-08-13T22:43:19Z",
          "id": "fb_msmf9zlo_v0a1ebjz.r3"
        }
      ],
      "route": "#options",
      "scope": "position",
      "stage": "position",
      "status": "answered",
      "targetId": "BABA-C-143/144-2026-08-14",
      "targetKind": "position",
      "targetLabel": "BABA 143/144 call spread, expires Aug 14",
      "title": "[B] Why are we showing 4k loss here? 7k on detail?",
      "type": "feedback"
    },
    {
      "answered": true,
      "archivedAt": null,
      "contractKey": "INTC-P-88-87-2026-08-12",
      "createdAt": "2026-08-09T23:42:16.000Z",
      "description": "how come we sell a put spread but pay debit? this should never happen!",
      "hasImage": false,
      "id": "fb_msmg68hc_h8sokn3z",
      "lastActivityAt": "2026-08-13T22:43:19Z",
      "messages": [
        {
          "author": "visitor",
          "authorLabel": "Visitor",
          "body": "how come we sell a put spread but pay debit? this should never happen!",
          "createdAt": "2026-08-09T23:42:16.000Z",
          "hasImage": false,
          "id": "fb_msmg68hc_h8sokn3z",
          "role": "user",
          "title": "Put spread fundamental problem"
        },
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "You were right, and it wasn't just this trade. The fund's INTC 88/87 put spread scored a +$364 credit at scan time but the broker fill came back at -$84 \u2014 a $448 slippage that flipped a credit spread into a debit, and risk on the position rose from $2,436 to $2,884 as a result. BABA 143/144 the same week was the identical class of bug: a structure we called a credit spread that could not profit at any price, entered for a net debit no entry check ever looked at. Root cause: the pre-submission check only ever looked at the credit the SCAN estimated, never the actual price about to be sent to the broker, so a quote move (or, in an earlier version of this bug, a sign error in how the limit price was built) could slip a non-positive-credit order through untouched. Two fixes now: (1) a hard min_net_credit floor is checked twice \u2014 once during the scan (its own 'non_positive_credit' line in the funnel, so a rejected name is visible, not silently dropped) and a second time as the final choke point right before the order is built, using the exact number that becomes the broker limit price, not the earlier scan estimate. A missing or unreadable price is refused the same as a non-positive one. (2) If a fill still somehow reconciles to a non-positive credit, it now pages loudly: a WARNING naming the trade, the scored credit, the actual credit and the slippage, plus a durable audit-log entry, from both the immediate-fill path and the later reconcile pass. The rule and the live floor are now shown on every proposed trade's check list and on the CREDIT_SPREAD policy card, so this is reviewable going forward, not just fixed in code. Thanks for catching it and for not letting it go.",
          "createdAt": "2026-08-13T22:43:19Z",
          "hasImage": false,
          "id": "fb_msmg68hc_h8sokn3z.r1",
          "role": "agent"
        }
      ],
      "replies": [
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "You were right, and it wasn't just this trade. The fund's INTC 88/87 put spread scored a +$364 credit at scan time but the broker fill came back at -$84 \u2014 a $448 slippage that flipped a credit spread into a debit, and risk on the position rose from $2,436 to $2,884 as a result. BABA 143/144 the same week was the identical class of bug: a structure we called a credit spread that could not profit at any price, entered for a net debit no entry check ever looked at. Root cause: the pre-submission check only ever looked at the credit the SCAN estimated, never the actual price about to be sent to the broker, so a quote move (or, in an earlier version of this bug, a sign error in how the limit price was built) could slip a non-positive-credit order through untouched. Two fixes now: (1) a hard min_net_credit floor is checked twice \u2014 once during the scan (its own 'non_positive_credit' line in the funnel, so a rejected name is visible, not silently dropped) and a second time as the final choke point right before the order is built, using the exact number that becomes the broker limit price, not the earlier scan estimate. A missing or unreadable price is refused the same as a non-positive one. (2) If a fill still somehow reconciles to a non-positive credit, it now pages loudly: a WARNING naming the trade, the scored credit, the actual credit and the slippage, plus a durable audit-log entry, from both the immediate-fill path and the later reconcile pass. The rule and the live floor are now shown on every proposed trade's check list and on the CREDIT_SPREAD policy card, so this is reviewable going forward, not just fixed in code. Thanks for catching it and for not letting it go.",
          "createdAt": "2026-08-13T22:43:19Z",
          "id": "fb_msmg68hc_h8sokn3z.r1"
        }
      ],
      "route": "#trade/CREDIT_SPREAD_INTC_20260812_8800",
      "scope": "trade",
      "stage": "trade",
      "status": "answered",
      "targetId": "CREDIT_SPREAD_INTC_20260812_8800",
      "targetKind": "trade",
      "targetLabel": "INTC Bull put credit spread",
      "title": "Put spread fundamental problem",
      "type": "feedback"
    }
  ]
};
