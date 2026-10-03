import type { BlogRewrite } from './types.js';

const CONTENT = `Sigma tracks public procurement in Bulgaria. That means government contracts paid for with tax money. You can search who won a contract and how much it paid. Now you can go one step further. Open any company on [sigma-plus.replit.app](https://sigma-plus.replit.app). A new page shows the real people behind it: who holds a role there, and what else they are tied to.

That is the one big change in Sigma's September update: a person page for everyone in the public records. Type a company name. Click through to its leaders. Click again and you see every other company or contract tied to that same person. A new connection graph draws those links out, so you see the web at a glance instead of reading a long list.

One safeguard ships with it. Profiles of individual people are hidden from search engines. Company and institution pages stay fully visible. This keeps Sigma from turning into a tool people can use to find a private person by name. A link in the graph is a fact from the public record. It is not proof of wrongdoing.

Also shipped: company and institution pages now show role history and ownership stakes next to the contracts. A new "related persons" view lets you filter and group the people tied to any contractor, instead of scrolling one long list. Behind the scenes, Sigma now gives each person one stable ID across its data sources. The same person no longer shows up as several disconnected entries.

Sigma is built for anyone who wants to follow public money without being a procurement expert. That covers a journalist, a researcher, or someone just curious who won the contract down the street. Try it now at [sigma-plus.replit.app](https://sigma-plus.replit.app). Search a company, open its page, and follow the people. The code is open source at [github.com/midt-bg/sigma](https://github.com/midt-bg/sigma).

Next up: the new pages still need to work well on a phone screen. That work is already underway.`;

export const rewrite: BlogRewrite = {
  slug: 'sigma-now-shows-who-sits-behind-a-contract',
  migrationId: '2026-10-03-rewrite-sigma-now-shows-who-sits-behind-a-contract',
  title: 'Sigma Now Shows Who Is Behind a Government Contract',
  excerpt:
    "Sigma tracks Bulgaria's public contracts and now shows the real people behind each company. Search a business and follow who runs it, not just what it won.",
  content: CONTENT,
};
