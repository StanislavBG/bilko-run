window.FEEDBACK_THREADS = {
  "counts": {
    "active": 2,
    "answered": 1,
    "archived": 0,
    "proposal": 0,
    "system": 0,
    "total": 2,
    "trade": 2,
    "unanswered": 1
  },
  "generatedAt": "2026-08-13T22:15:02Z",
  "schema": 2,
  "threads": [
    {
      "answered": true,
      "archivedAt": null,
      "createdAt": "2026-08-09T23:17:11.000Z",
      "description": "Which value is true? And why it is a loss at all?",
      "hasImage": false,
      "id": "fb_msmf9zlo_v0a1ebjz",
      "lastActivityAt": "2026-08-13T18:26:09Z",
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
        }
      ],
      "route": "#options",
      "scope": "position",
      "status": "answered",
      "targetId": "BABA-C-143/144-2026-08-14",
      "targetKind": "position",
      "targetLabel": "BABA 143/144 call spread, expires Aug 14",
      "title": "[B] Why are we showing 4k loss here? 7k on detail?",
      "type": "feedback"
    },
    {
      "answered": false,
      "archivedAt": null,
      "createdAt": "2026-08-09T23:42:16.000Z",
      "description": "how come we sell a put spread but pay debit? this should never happen!",
      "hasImage": false,
      "id": "fb_msmg68hc_h8sokn3z",
      "lastActivityAt": "2026-08-09T23:42:16.000Z",
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
        }
      ],
      "replies": [],
      "route": "#trade/CREDIT_SPREAD_INTC_20260812_8800",
      "scope": "trade",
      "status": "open",
      "targetId": "CREDIT_SPREAD_INTC_20260812_8800",
      "targetKind": "trade",
      "targetLabel": "INTC Bull put credit spread",
      "title": "Put spread fundamental problem",
      "type": "feedback"
    }
  ]
};
