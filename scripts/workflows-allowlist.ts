/**
 * Curated allowlist for /workflows. Only jobs listed here are ever published;
 * anything else on the machine (email-agent, bills-collector, system timers,
 * private research pipelines) is dropped by buildWorkflows.
 *
 * Keys: `<project> <job>` (crontab trailing tag), `systemd:<unit>.timer`, or
 * `gha:<repo>/<workflow file>`.
 */
import type { AllowlistJob, WorkflowGroupMeta } from './lib/workflows.js';

/** Group copy. Hub groups render in PUBLIC_SLUGS order; the rest follow in
 *  this order. */
export const WORKFLOW_GROUPS: readonly WorkflowGroupMeta[] = [
  {
    slug: 'session-manager',
    name: 'Session Manager',
    href: '/projects/session-manager/',
    mechanics: 'A watchdog wakes the scheduler, which picks queued PRDs, runs each as a headless Claude executor in its own git worktree, then gates, validates, and lands the result. Most of this site was built that way.',
  },
  {
    slug: 'social-signals-trader',
    name: 'Social Signals Trader',
    href: '/projects/social-signals-trader/',
    mechanics: 'On market days a tick wakes every 15 minutes, reads the signals Burrow gathered overnight, and manages the Alpaca account. Snapshots and audits publish the results to the public dashboard.',
  },
  {
    slug: 'git-viewer',
    name: 'Git Viewer',
    href: '/projects/git-viewer/',
    mechanics: 'A scheduled GitHub Actions run pulls every repo through the GitHub API, bakes the result into one data file, and redeploys the dashboard.',
  },
  {
    slug: 'blog',
    name: 'Blog',
    href: '/blog',
    mechanics: 'A cadence watchdog checks how long it has been since the last post and drafts a catch-up when the gap gets too long. A second timer checks that the watchdog itself is still alive.',
  },
  {
    slug: 'burrow',
    name: 'Burrow — the agency engine',
    mechanics: "Burrow is the local agent under everything else. It drives a real browser through Reddit, X, LinkedIn, Discord, and Facebook at human speed, indexes what it reads into a searchable knowledge base, and gathers the ticker data that feeds Social Signals Trader. Each pipeline has its own cron line.",
  },
];

const SST = 'social-signals-trader';
const DASHBOARD = { label: 'Dashboard', href: '/projects/social-signals-trader/' };

export const WORKFLOW_ALLOWLIST: Readonly<Record<string, AllowlistJob>> = {
  // ── Session Manager ──
  'systemd:scheduler-watchdog.timer': { id: 'sm-scheduler', project: 'session-manager', name: 'Scheduler watchdog', desc: 'Keeps the PRD scheduler running: picks up queued work and launches headless executors.' },

  // ── Social Signals Trader ──
  [`${SST} trader-tick`]: { id: 'sst-tick', project: SST, name: 'Trader tick', desc: 'Reads fresh signals, sizes positions, and places or manages orders. The first and last ticks of the day only manage open positions.', output: DASHBOARD },
  [`${SST} snapshot`]: { id: 'sst-snapshot', project: SST, name: 'Snapshot', desc: 'Captures account value vs SPY, positions, and the trade log for the public dashboard.', output: DASHBOARD },
  [`${SST} snapshot-market-hours`]: { id: 'sst-snapshot', project: SST, name: 'Snapshot', desc: 'Captures account value vs SPY, positions, and the trade log for the public dashboard.', output: DASHBOARD },
  [`${SST} execution-audit`]: { id: 'sst-audit', project: SST, name: 'Execution audit', desc: 'Checks that every intended trade actually filled the way the strategy said it should.' },
  [`${SST} options-status-refresh-summary`]: { id: 'sst-options', project: SST, name: 'Options status', desc: 'Refreshes the summary of open options positions.' },
  [`${SST} rotate-data-logs`]: { id: 'sst-rotate', project: SST, name: 'Log rotation', desc: 'Rolls over the day’s data logs after the close.' },
  [`${SST} trader-boot-catchup`]: { id: 'sst-catchup', project: SST, name: 'Boot catch-up', desc: 'If the machine restarts mid-session, runs any tick it missed.' },

  // ── Git Viewer ──
  'gha:git-viewer/pages.yml': { id: 'gv-sync', project: 'git-viewer', name: 'Data sync + deploy', desc: 'Fetches repo stats through the GitHub API, bakes them into the dashboard, and redeploys it.', output: { label: 'Git Viewer', href: '/projects/git-viewer/' } },

  // ── Blog ──
  'systemd:blog-cadence-watchdog.timer': { id: 'blog-cadence', project: 'blog', name: 'Cadence watchdog', desc: 'Measures the gap since the last live post and drafts a catch-up post when it is too long.', output: { label: 'Blog', href: '/blog' } },
  'systemd:blog-watchdog-heartbeat-check.timer': { id: 'blog-heartbeat', project: 'blog', name: 'Watchdog heartbeat', desc: 'A dead-man’s switch: confirms the cadence watchdog has run recently.' },

  // ── Burrow ──
  'burrow mcp-keepalive': { id: 'bw-keepalive', project: 'burrow', name: 'Knowledge server keepalive', desc: 'Restarts the knowledge-base server if it stops answering.' },
  'burrow pipe:research_worker': { id: 'bw-research', project: 'burrow', name: 'Research worker', desc: 'Works through queued research questions against the knowledge base.' },
  'burrow pipe:targeted_ticker_gather': { id: 'bw-ticker-targeted', project: 'burrow', name: 'Targeted ticker gather', desc: 'Pulls fresh discussion for the tickers the trader is watching right now.' },
  'burrow pipe:ticker_data_state': { id: 'bw-ticker-state', project: 'burrow', name: 'Ticker data state', desc: 'Tracks how fresh the data is for each watched ticker, so gathers go where they are needed.' },
  'burrow pipe:internet_search_opinion': { id: 'bw-web-opinion', project: 'burrow', name: 'Web opinion search', desc: 'Searches the open web for opinions on watched tickers.' },
  'burrow pipe:health_snapshot': { id: 'bw-health', project: 'burrow', name: 'Health snapshot', desc: 'Records whether every pipeline is running on time.' },
  'burrow pipe:ticker_search_gather': { id: 'bw-ticker-search', project: 'burrow', name: 'Ticker search gather', desc: 'Broad search for ticker mentions across sources.' },
  'burrow bilko-run-ping': { id: 'bw-ping', project: 'burrow', name: 'bilko.run ping', desc: 'Checks that this site is up.' },
  'burrow pipe:discord_session': { id: 'bw-discord', project: 'burrow', name: 'Discord session', desc: 'Reads trading Discord channels and captures ticker discussion.' },
  'burrow pipe:distill': { id: 'bw-distill', project: 'burrow', name: 'Distill', desc: 'Condenses new captures into short insights with Claude.' },
  'burrow pipe:index': { id: 'bw-index', project: 'burrow', name: 'Knowledge indexer', desc: 'Chunks and embeds new captures into the knowledge base.' },
  'burrow pipe:ticker_tag': { id: 'bw-ticker-tag', project: 'burrow', name: 'Ticker tagging', desc: 'Tags indexed posts with the tickers they mention, for the trader’s signal scoring.' },
  'burrow pipe:fb_football_post': { id: 'bw-fb-football', project: 'burrow', name: 'FB Football news', desc: 'Posts as European Football Daily: web-sourced news plus a generated image.', output: { label: 'European Football Daily', href: 'https://www.facebook.com/profile.php?id=61587170666602' } },
  'burrow pipe:stats_snapshot': { id: 'bw-stats', project: 'burrow', name: 'Stats snapshot', desc: 'Rolls up posts, replies, captures, and knowledge-base growth.' },
  'burrow pipe:fb_bilko_post': { id: 'bw-fb-bilko', project: 'burrow', name: 'FB Bilko post', desc: 'Posts short AI-education essays with generated images as Bilko Bibitkov.', output: { label: 'Bilko Bibitkov', href: 'https://www.facebook.com/profile.php?id=61586788196871' } },
  'burrow pipe:short_interest_collect': { id: 'bw-short-interest', project: 'burrow', name: 'Short interest', desc: 'Collects short-interest data for watched tickers.' },
  'burrow pipe:reddit_session': { id: 'bw-reddit', project: 'burrow', name: 'Reddit session', desc: 'Human-paced scroll through followed subreddits; captures posts for the knowledge base and the trader.' },
  'burrow pipe:x_session': { id: 'bw-x', project: 'burrow', name: 'X session', desc: 'Scrolls X, captures posts, and drafts the day’s post and replies.', output: { label: '@BilkoBibitkov', href: 'https://x.com/BilkoBibitkov' } },
  'burrow pipe:linkedin_session': { id: 'bw-linkedin', project: 'burrow', name: 'LinkedIn session', desc: 'Reads the LinkedIn feed and captures posts into the knowledge base.' },
  'burrow pipe:catalyst_calendar_collect': { id: 'bw-catalysts', project: 'burrow', name: 'Catalyst calendar', desc: 'Collects upcoming earnings and other catalyst dates.' },
  'burrow pipe:google_trends_collect': { id: 'bw-trends', project: 'burrow', name: 'Google Trends', desc: 'Collects search-interest trends for watched tickers.' },
  'burrow capture-retention': { id: 'bw-retention', project: 'burrow', name: 'Capture retention', desc: 'Clears out old raw captures once they are indexed.' },
};
