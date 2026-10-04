import { type Page, type BrowserContext, type Route, expect } from '@playwright/test';

export interface HostStubOpts {
  signedIn?: boolean;
  email?: string;
  credits?: number;
  isAdmin?: boolean;
  apiHost?: string;
  routes?: Record<string, (req: import('@playwright/test').Request) => unknown>;
}

/**
 * Install request interception that simulates the host backend for tests.
 * Returns updater methods so a single test can flip state mid-flow.
 */
export async function withHostStub(context: BrowserContext, initial: HostStubOpts = {}) {
  let state = {
    signedIn: initial.signedIn ?? false,
    email:    initial.email    ?? 'test@example.com',
    credits:  initial.credits  ?? 0,
    isAdmin:  initial.isAdmin  ?? false,
  };
  const apiHost = initial.apiHost ?? 'https://bilko.run';
  const customRoutes = initial.routes ?? {};

  await context.route(`${apiHost}/api/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');

    const handler = customRoutes[path] ?? customRoutes[`${route.request().method()} ${path}`];
    if (handler) {
      const body = handler(route.request());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }

    if (path === '/auth/me') {
      return route.fulfill({
        status: state.signedIn ? 200 : 401,
        contentType: 'application/json',
        body: state.signedIn
          ? JSON.stringify({ email: state.email, isAdmin: state.isAdmin })
          : JSON.stringify({ error: 'unauthenticated' }),
      });
    }
    if (path === '/credits/balance') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ balance: state.credits }),
      });
    }
    if (path.startsWith('/analytics/') || path.startsWith('/telemetry/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  return {
    setCredits(n: number) { state.credits = n; },
    signIn(email = 'test@example.com', isAdmin = false) {
      state.signedIn = true; state.email = email; state.isAdmin = isAdmin;
    },
    signOut() { state.signedIn = false; },
    state,
  };
}

/**
 * Assert the brand chrome rendered: ToolHero h1 matches and bilko.run link is visible.
 */
export async function expectChromeLoaded(page: Page, expectedTitle: string | RegExp) {
  await expect(page.getByRole('heading', { level: 1 })).toContainText(expectedTitle);
  await expect(page.getByRole('link', { name: /bilko/i })).toBeVisible();
}

/**
 * Click the primary CTA button by role + name.
 */
export async function submitPrimaryAction(page: Page, ctaName: string | RegExp) {
  // .first() handles pages with a repeated CTA (e.g. hero + scroll-to-bottom copy)
  await page.getByRole('button', { name: ctaName }).first().click();
}

/**
 * Wait for the ScoreCard to render with a numeric score and grade.
 */
export async function expectScoreCard(page: Page) {
  await expect(page.getByTestId('score-card')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('score-card-grade')).toBeVisible();
}

/** Flip the stub to signed-in and reload so the app re-fetches /auth/me. */
export async function signInAs(
  stub: { signIn: (email?: string) => void },
  page: Page,
  email = 'test@example.com',
) {
  stub.signIn(email);
  await page.reload();
}

/** Flip the credit balance and reload. */
export async function setCredits(
  stub: { setCredits: (n: number) => void },
  page: Page,
  n: number,
) {
  stub.setCredits(n);
  await page.reload();
}
