/** /admin home: admins get one card per admin area; non-admins get no cards. */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const admin = vi.hoisted(() => ({ isAdmin: true }));

vi.mock('../src/hooks/useAdmin.js', () => ({ useIsAdmin: () => admin.isAdmin }));
vi.mock('@clerk/clerk-react', () => ({ useUser: () => ({ isLoaded: true, user: null }) }));

import { AdminPage } from '../src/pages/AdminPage.js';

const render = () =>
  renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/admin'] }, createElement(AdminPage)));

const ROUTES = ['/admin/observability', '/admin/analytics', '/admin/secrets', '/admin/sessions', '/admin/cost'];

describe('AdminPage hub', () => {
  beforeEach(() => { admin.isAdmin = true; });

  it('links every admin area for an admin', () => {
    const html = render();
    expect(html).toContain('>Admin</h1>');
    for (const route of ROUTES) expect(html).toContain(`href="${route}"`);
    expect(html.match(/data-testid="admin-area-card"/g)).toHaveLength(ROUTES.length);
    expect(html).toContain('Registry write keys for the bilko-host MCP');
  });

  it('renders no cards for a non-admin', () => {
    admin.isAdmin = false;
    const html = render();
    expect(html).not.toContain('admin-area-card');
    for (const route of ROUTES) expect(html).not.toContain(`href="${route}"`);
  });
});
