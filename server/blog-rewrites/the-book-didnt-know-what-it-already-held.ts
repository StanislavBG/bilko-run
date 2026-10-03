import type { BlogRewrite } from './types.js';

const CONTENT = `Open [Social Signals Trader](https://bilko.run/projects/social-signals-trader/) right now and you see a real trading account, live. The dashboard shows the account's value next to SPY, a popular fund that tracks the stock market. You also see every open trade and every order sent to the broker.

The bot trades credit spreads. A credit spread is a bet that a stock stays inside a price range. You collect cash up front and keep it if you are right. The trade log on the dashboard shows each one it opens and closes, in order.

On September 2, 2026, the account's own history taught the bot a lesson twice in one morning. At 6:30am it tried to open a new spread that shared a strike price with one it already held. The broker, Alpaca, turned the order down flat. Two hours earlier, a different trade got stuck closing. The bot kept sending copies of the same close order, and each one failed too, because the first one was already holding the contracts.

Both problems trace back to one gap. The bot was planning its next move without first asking the broker what it already held. The fix makes it check twice: once before it plans a trade, and again right before it sends one. Now it only blocks a new trade when it truly collides, meaning it bets the opposite way on a strike it already holds. A second trade going the same way is still allowed. A stuck close now gets tracked by name, so the bot keeps working it until it actually goes through.

You can watch this show up for yourself. Open the dashboard, pick any open position, and the trade log under it shows every order the bot sent for that position, failed orders included. The fund also writes its own rules down in one place: a target of 500% account return per year, a cap on how much it can hold in stocks that move together, and rules for when it has to cut a loss.

What is next for the bot is a harder trade shape: spreads paired together into one position instead of one at a time. That only works once the bot reliably knows what it already holds, which is exactly what this fix built.`;

export const rewrite: BlogRewrite | null = {
  slug: 'the-book-didnt-know-what-it-already-held',
  migrationId: '2026-10-03-rewrite-the-book-didnt-know-what-it-already-held',
  title: 'A Trading Account You Can Watch, Live, in Public',
  excerpt:
    "Social Signals Trader runs a real options-trading account and shows it live on its public dashboard, measured against SPY. A September 2026 fix makes the bot check what it already holds before it trades again.",
  content: CONTENT,
};
