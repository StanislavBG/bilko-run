/** Contact page: TikTok row and live Forum link render with the right attributes. */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ContactPage } from '../src/pages/ContactPage.js';

const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ContactPage)));
const row = (track: string) => html.match(new RegExp(`<a [^>]*data-track="${track}"[^>]*>`))?.[0] ?? '';

describe('ContactPage', () => {
  it('links TikTok in a new tab', () => {
    const a = row('contact-tiktok');
    expect(a).toContain('href="https://www.tiktok.com/@bilkobibitkov"');
    expect(a).toContain('target="_blank"');
    expect(a).toContain('rel="noopener noreferrer"');
  });

  it('links the Forum in-app', () => {
    const a = row('contact-forum');
    expect(a).toContain('href="/forum"');
    expect(a).not.toContain('target');
  });

  it('has no (soon) rows', () => {
    expect(html).not.toContain('(soon)');
  });
});
