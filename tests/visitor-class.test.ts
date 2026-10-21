import { describe, it, expect } from 'vitest';
import { classifyVisitor, isBot, VISITOR_CLASSES } from '../server/services/analytics.js';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0';

describe('classifyVisitor', () => {
  it('exports the six classes in order', () => {
    expect(VISITOR_CLASSES).toEqual([
      'human',
      'search_crawler',
      'ai_crawler',
      'ai_user_agent',
      'api_client',
      'script',
    ]);
  });

  it.each([
    ['ChatGPT-User', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'],
    ['Claude-User', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)'],
    ['Perplexity-User', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)'],
    ['OAI-SearchBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)'],
    ['DuckAssistBot', 'Mozilla/5.0 (compatible; DuckAssistBot/1.2; +http://duckduckgo.com/duckassistbot.html)'],
  ])('ai_user_agent: %s', (_n, ua) => {
    expect(classifyVisitor(ua)).toBe('ai_user_agent');
  });

  it('is case-insensitive', () => {
    expect(classifyVisitor('chatgpt-user/1.0')).toBe('ai_user_agent');
  });

  it.each([
    ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)'],
    ['ClaudeBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'],
    ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)'],
    ['Applebot-Extended', 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (Applebot-Extended/0.1)'],
    ['Amazonbot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; Amazonbot/0.1)'],
  ])('ai_crawler: %s', (_n, ua) => {
    expect(classifyVisitor(ua)).toBe('ai_crawler');
  });

  it.each([
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['Bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['Applebot', 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (Applebot/0.1)'],
    ['Slackbot', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
    ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  ])('search_crawler: %s', (_n, ua) => {
    expect(classifyVisitor(ua)).toBe('search_crawler');
  });

  it.each([
    ['curl', 'curl/8.5.0'],
    ['python-requests', 'python-requests/2.31.0'],
    ['HeadlessChrome', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/124.0.0.0 Safari/537.36'],
    ['generic bot', 'SomeRandomBot/1.0'],
    ['empty', ''],
  ])('script: %s', (_n, ua) => {
    expect(classifyVisitor(ua)).toBe('script');
  });

  it('api_client via botId or mcp, taking precedence over UA', () => {
    expect(classifyVisitor(CHROME, { botId: 'agent-1' })).toBe('api_client');
    expect(classifyVisitor(CHROME, { mcp: true })).toBe('api_client');
    expect(classifyVisitor('curl/8.5.0', { botId: 'x' })).toBe('api_client');
    expect(classifyVisitor(CHROME, { botId: '' })).toBe('human');
    expect(classifyVisitor(CHROME, { botId: null, mcp: false })).toBe('human');
  });

  it.each([CHROME, SAFARI, FIREFOX])('human: %s', (ua) => {
    expect(classifyVisitor(ua)).toBe('human');
  });
});

describe('isBot', () => {
  it('keeps empty UA as not-a-bot', () => {
    expect(isBot('')).toBe(false);
  });
  it('flags AI agents and crawlers, not browsers', () => {
    expect(isBot('Mozilla/5.0 (compatible; ChatGPT-User/1.0)')).toBe(true);
    expect(isBot('curl/8.5.0')).toBe(true);
    expect(isBot(CHROME)).toBe(false);
  });
});
