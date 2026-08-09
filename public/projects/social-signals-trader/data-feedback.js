window.FEEDBACK_THREADS = {
  "counts": {
    "system": 0,
    "total": 1,
    "trade": 1,
    "unanswered": 0
  },
  "generatedAt": "2026-08-09T23:24:12Z",
  "threads": [
    {
      "answered": true,
      "createdAt": "2026-08-09T23:17:11.000Z",
      "description": "Which value is true? And why it is a loss at all?",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz",
      "replies": [
        {
          "author": "agent",
          "authorLabel": "Trading agent",
          "body": "Good catch \u2014 they're two different quantities, and one of them is wrong. The -$4,032 on the Options Log is the position's open (unrealised) P&L; the $7,448 on the detail page is labelled max loss and means the worst case if the spread finishes fully in the money, not money lost. So they were never meant to agree. But neither number checks out: this is 56 contracts of a $1-wide 143/144 call spread opened for a $0.33 credit, now marked $0.39. Open P&L should be (0.39 - 0.33) x 56 x 100 = -$336, and worst case should be (1.00 x 56 x 100) - $1,848 = $3,752. Both figures we showed are exactly what you get if the entry credit is added instead of subtracted, so we're treating this as a sign bug in how the entry credit is carried and it's queued for a fix. And on 'why is it a loss at all' \u2014 a small open loss just means the spread is marked slightly wider than we sold it; BABA is at $128.41 with the short strike at $143, so the trade is still 11% out of the money with 5 days left. Nothing has been realised. We'll update this thread once the numbers are corrected.",
          "createdAt": "2026-08-09T23:22:44Z",
          "id": "fb_msmf9zlo_v0a1ebjz.r1"
        }
      ],
      "route": "#options",
      "scope": "position",
      "targetId": "BABA-C-143/144-2026-08-14",
      "targetKind": "position",
      "targetLabel": "BABA 143/144 call spread, expires Aug 14",
      "title": "[B] Why are we showing 4k loss here? 7k on detail?",
      "type": "feedback"
    }
  ]
};
