#!/usr/bin/env node
import { initDb, dbGet, dbRun } from '../server/db.js';

const COST_PER_CALL_USD = 0.001;   // ~$1 per 1000 calls, conservative high-side estimate
const COGS_RATIO_ALERT = 0.25;     // alert if Gemini COGS > 25% of Stripe revenue
const ABS_SPEND_ALERT_USD = 50;    // also alert if absolute daily spend > $50

async function main() {
  await initDb();

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

  const callsRow = await dbGet<{ total: number }>(
    `SELECT SUM(calls) AS total FROM usage_daily WHERE date = ?`, yesterday,
  );
  const calls = callsRow?.total ?? 0;
  const cost = calls * COST_PER_CALL_USD;

  let revenue = 0;
  if (process.env.STRIPE_API_KEY) {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_API_KEY, { apiVersion: '2024-12-18.acacia' as any });
    const dayStart = Math.floor(new Date(`${yesterday}T00:00:00Z`).getTime() / 1000);
    const charges = await stripe.charges.list({ created: { gte: dayStart, lt: dayStart + 86400 }, limit: 100 });
    revenue = charges.data
      .filter(c => c.paid && !c.refunded)
      .reduce((acc, c) => acc + c.amount / 100, 0);
  }

  const ratio = revenue > 0 ? cost / revenue : (cost > 0 ? Infinity : 0);

  console.log(
    `cost-monitor ${yesterday}: ${calls} calls, ~$${cost.toFixed(2)} cost, $${revenue.toFixed(2)} rev, ratio ${isFinite(ratio) ? (ratio * 100).toFixed(1) : 'N/A'}%`,
  );

  if (ratio > COGS_RATIO_ALERT || cost > ABS_SPEND_ALERT_USD) {
    const alertKind = cost > ABS_SPEND_ALERT_USD ? 'absolute_spend' : 'daily_cogs';
    await dbRun(
      `INSERT INTO cost_alerts (alert_kind, details_json, created_at) VALUES (?, ?, ?)`,
      alertKind,
      JSON.stringify({ date: yesterday, calls, cost, revenue, ratio: isFinite(ratio) ? ratio : null }),
      Math.floor(Date.now() / 1000),
    );
    console.error(`COST ALERT [${alertKind}]: ratio ${isFinite(ratio) ? (ratio * 100).toFixed(1) + '%' : 'N/A'} / spend $${cost.toFixed(2)}`);
  }
}

main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
