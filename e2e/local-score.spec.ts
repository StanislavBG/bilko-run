import { test, expect, Page } from '@playwright/test';

// ── Pre-generated test documents (one per mode) ─────────────────────────────

const DOCS: Record<string, string> = {
  contract: `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of January 15, 2026, by and between:
Provider: Acme Web Solutions LLC, 123 Main St, Portland OR 97201
Client: Maria's Bakery, 456 Oak Ave, Portland OR 97205

1. SCOPE OF SERVICES
Provider agrees to design and maintain a website for Client including:
- Custom responsive website with online ordering
- Monthly maintenance and security updates
- SEO optimization and Google Business integration

2. TERM
This Agreement begins on February 1, 2026 and continues for 12 months, automatically renewing unless either party gives 30 days written notice.

3. COMPENSATION
Client shall pay Provider:
- Initial setup fee: $2,500 (due upon signing)
- Monthly maintenance: $150/month (due on the 1st)
- Late payments incur 1.5% monthly interest

4. INTELLECTUAL PROPERTY
All website designs, code, and content created under this Agreement shall be owned by Client upon full payment. Provider retains the right to use the work in their portfolio.

5. TERMINATION
Either party may terminate with 30 days written notice. Early termination by Client requires payment of 50% of remaining contract value. Provider may terminate immediately if payments are 60 days overdue.

6. LIABILITY
Provider's total liability shall not exceed the total fees paid under this Agreement. Neither party is liable for indirect, consequential, or punitive damages.`,

  financial: `MONTHLY FINANCIAL SUMMARY — Maria's Bakery
Period: March 2026

REVENUE
  Retail sales (in-store):     $18,420.00
  Online orders:                $6,230.00
  Catering & events:            $3,800.00
  Wholesale (cafés):            $2,150.00
  ─────────────────────────────────────────
  Total Revenue:               $30,600.00

EXPENSES
  Ingredients & supplies:       $9,180.00  (30% of revenue)
  Staff wages (4 FT, 2 PT):   $12,800.00  (41.8% of revenue)
  Rent:                         $3,200.00
  Utilities:                      $680.00
  Equipment lease:                $450.00
  Insurance:                      $320.00
  Marketing (ads + flyers):       $580.00
  Packaging & delivery:           $410.00
  POS & software:                 $120.00
  Miscellaneous:                  $290.00
  ─────────────────────────────────────────
  Total Expenses:              $28,030.00

NET PROFIT:                     $2,570.00  (8.4% margin)

NOTES:
- Catering revenue up 42% from February (two large corporate orders)
- Ingredient costs rose 6% — flour supplier increased prices
- Online orders now 20% of total (was 12% in January)
- Staff overtime: $1,200 above budget due to weekend catering
- Credit card processing fees: $612 (included in POS line)`,

  meeting: `Team Standup — April 10, 2026, 9:00 AM

Attendees: Sarah (owner), Mike (head baker), Jenny (front of house), Dan (delivery)

Sarah: Morning everyone. Quick updates then I have something about the summer menu. Mike, go.

Mike: Yesterday we tested the new sourdough recipe with the local flour — customers loved it. I need to order 50lb bags instead of 25lb to get the bulk discount. Also the stand mixer is making that noise again, I think the bearing is going.

Sarah: Okay get the quote for the mixer repair. Don't want it dying during a weekend rush. How much is the bulk flour?

Mike: $45 for 50lb vs $28 for 25lb. Saves about $11 per 100lbs.

Sarah: Do it. Jenny?

Jenny: Saturday was our best day this month — $2,100 in-store. The loyalty cards are working, I've signed up 43 people this week. One issue: we ran out of the oat milk latte by 2pm again.

Sarah: Third time this month. Double the oat milk order. Dan?

Dan: Delivery times are good, averaging 28 minutes. But the insulated bags are falling apart. I need 4 new ones, about $35 each.

Sarah: Approved. Now — summer menu. I want to launch June 1. Mike, can you have 5 new items ready for taste testing by May 15?

Mike: If I start next week, yes.

Sarah: Perfect. Jenny, start teasing it on social by mid-May. Okay that's it. Great week everyone.`,

  general: `ABOUT US — Dan's Neighborhood Barbershop

We've been cutting hair in the Hawthorne district since 2019. What started as a one-chair shop is now a 3-chair operation with a small but loyal crew.

WHAT WE DO
Classic cuts, fades, beard trims, and hot towel shaves. No appointments needed for basic cuts — just walk in. We also do wedding party packages and monthly memberships ($45/mo for unlimited cuts).

THE TEAM
Dan (owner/barber) — 12 years experience, specializes in classic cuts and razor fades
Alex — Joined 2022, great with modern styles and designs
Sam — Part-time weekends, handles the overflow and walk-ins

HOURS
Tuesday–Friday: 10am–7pm
Saturday: 9am–5pm
Sunday–Monday: Closed

PRICING
Classic cut: $30
Fade: $35
Beard trim: $15
Cut + beard: $40
Hot towel shave: $25
Kids under 12: $20

WHAT PEOPLE SAY
"Best barbershop in Portland. Dan actually listens." — Google Review, 4.9 stars (127 reviews)
"My kid hates getting haircuts everywhere except here." — Yelp Review

FIND US
2847 SE Hawthorne Blvd, Portland OR 97214
Instagram: @dansbarbershop
Walk-ins welcome. Always.`,
};

// ── Mock responses (what the "AI" returns per mode) ─────────────────────────

const MOCK_RESPONSES: Record<string, string> = {
  contract: `## Summary
This is a 12-month website service agreement between Acme Web Solutions and Maria's Bakery.

## What Each Side Has to Do
- **Acme** builds a custom website with online ordering, maintains it monthly, and handles SEO
- **Maria's Bakery** pays $2,500 upfront plus $150/month

## Important Dates
- Start date: February 1, 2026
- Auto-renews after 12 months unless 30 days notice given
- Late payments trigger interest after due date

## Money Involved
- Setup: $2,500 one-time
- Ongoing: $150/month ($1,800/year)
- Total first year: $4,300

## Risks
- **Auto-renewal**: If you forget to cancel, you're locked in another year
- **Early termination penalty**: You'd owe 50% of remaining months — could be expensive
- **Late fee**: 1.5% monthly interest compounds quickly

## What Seems Missing
- No mention of website hosting costs — who pays?
- No SLA for uptime or response times
- No data backup or disaster recovery terms`,

  financial: `## Quick Summary
Maria's Bakery made $30,600 in March with a net profit of $2,570 (8.4% margin). Revenue is growing but costs are rising.

## Key Numbers
- Total revenue: $30,600
- Total expenses: $28,030
- Net profit: $2,570
- Staff costs eat 41.8% of revenue — the biggest expense

## Trends
- Online orders growing fast: 12% → 20% of revenue in 3 months
- Catering up 42% from last month
- Ingredient costs rising (flour +6%)

## Things That Look Off
- Staff overtime $1,200 over budget — needs monitoring
- 8.4% margin is thin for food service (aim for 10-15%)
- Credit card fees ($612) hidden inside POS line — should be tracked separately

## What To Do Next
1. Negotiate flour pricing or find a second supplier
2. Track overtime separately to spot patterns
3. Invest more in online ordering (fastest growing channel)
4. Break out credit card fees as their own line item`,

  meeting: `## Most Important Takeaway
The team is growing — launching a summer menu June 1, with taste testing by May 15.

## What Was Decided
- Switch to 50lb flour bags for bulk discount ($11 saved per 100lbs)
- Double the oat milk order (ran out 3 times this month)
- Approved 4 new insulated delivery bags ($140 total)
- Summer menu launch date: June 1, 2026

## Action Items
- **Mike**: Get stand mixer repair quote, start summer menu items (5 new items by May 15)
- **Jenny**: Double oat milk order, start social media teases for summer menu mid-May
- **Dan**: Buy 4 new insulated bags ($35 each)
- **Sarah**: No explicit items but overseeing summer menu timeline

## Unresolved
- Stand mixer repair cost unknown — could be expensive if bearing is failing
- No budget set for summer menu development or launch marketing

## Next Steps
- Mike starts summer recipe development next week
- Jenny plans social media campaign for mid-May
- Follow up on mixer repair quote`,

  general: `## Summary
Dan's is a walk-in barbershop in Portland's Hawthorne district, open since 2019. Three barbers, strong reviews (4.9 stars), with a membership option.

## What's Strong
- Excellent reputation: 4.9 stars from 127 Google reviews
- Clear, simple pricing — no surprises
- Walk-in friendly — removes friction for new customers
- Membership model ($45/mo) creates recurring revenue
- Kid-friendly — mentioned in reviews

## What Needs Attention
- Only open 5 days a week — potential lost revenue on Mondays
- No website mentioned — relying on Google/Yelp/Instagram only
- No online booking option for those who prefer it
- Part-time weekend coverage might not handle peak demand

## What To Do Next
1. Consider a simple booking page even if walk-ins are primary
2. Track which days/hours are busiest to optimize Sam's schedule
3. Highlight the membership more prominently — it's great value
4. Get a basic website up — even a one-pager helps SEO`,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Inject mock engine via window global (test seam in LocalScorePage) */
async function injectMockEngine(page: Page, mode: string) {
  await page.addInitScript(
    ({ mockResponse }) => {
      (window as any).__LOCALSCORE_MOCK_ENGINE = {
        chat: {
          completions: {
            create: async () => ({
              choices: [{ message: { content: mockResponse } }],
            }),
          },
        },
      };
    },
    { mockResponse: MOCK_RESPONSES[mode] },
  );
}

/** Navigate to LocalScore with mock engine injected */
async function setupLocalScore(page: Page, mode: string) {
  await injectMockEngine(page, mode);
  await page.goto('/projects/local-score');
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('LocalScore — E2E with mocked Gemma', () => {
  test('page loads and shows Get Started button', async ({ page }) => {
    await injectMockEngine(page, 'general');
    await page.goto('/projects/local-score');

    await expect(page.getByRole('button', { name: 'Get Started', exact: true })).toBeVisible();
    await expect(page.getByText('100% private')).toBeVisible();
    await expect(page.getByText('free forever')).toBeVisible();
  });

  test('unsupported browser shows fallback when no WebGPU', async ({ page }) => {
    // No mock engine injected — component checks navigator.gpu which is absent in headless Chrome
    await page.goto('/projects/local-score');
    await page.getByRole('button', { name: 'Get Started', exact: true }).click();

    // Without mock engine AND no WebGPU, the component should show unsupported or error
    const unsupported = page.getByText("Your browser can't run this yet");
    const errorMsg = page.getByText("Something went wrong");
    await expect(unsupported.or(errorMsg)).toBeVisible({ timeout: 10_000 });
  });

  for (const [modeId, modeLabel] of [
    ['contract', 'A contract or agreement'],
    ['financial', 'A bill, invoice, or financial document'],
    ['meeting', 'Meeting notes or a conversation'],
    ['general', 'Your website copy or business description'],
  ] as const) {
    test(`${modeId} mode — full analysis flow`, async ({ page }) => {
      await setupLocalScore(page, modeId);

      // Step 1: Click Get Started
      await page.getByRole('button', { name: 'Get Started', exact: true }).click();

      // Step 2: Pick mode
      await expect(page.getByText('Ready! What do you need help with?')).toBeVisible({ timeout: 15_000 });
      await page.getByRole('button', { name: modeLabel }).click();

      // Step 3: Paste document
      const textarea = page.locator('textarea');
      await expect(textarea).toBeVisible();
      await textarea.fill(DOCS[modeId]);

      // Step 4: Analyze
      await page.getByRole('button', { name: 'Analyze This' }).click();

      // Step 5: Verify result renders
      await expect(page.getByText("Your text stayed on your computer")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Here's what I found")).toBeVisible();

      // Verify mode-specific content appears in results
      const resultContainer = page.locator('.text-sm.space-y-1');
      const resultText = await resultContainer.textContent();
      expect(resultText).toBeTruthy();
      expect(resultText!.length).toBeGreaterThan(50);

      // Verify action buttons
      await expect(page.getByRole('button', { name: 'Copy to clipboard' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save as file' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Analyze another' })).toBeVisible();
    });
  }

  test('analyze another resets to mode picker', async ({ page }) => {
    await setupLocalScore(page, 'general');

    await page.getByRole('button', { name: 'Get Started', exact: true }).click();
    await expect(page.getByText('Ready! What do you need help with?')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Your website copy or business description' }).click();

    await page.locator('textarea').fill(DOCS.general);
    await page.getByRole('button', { name: 'Analyze This' }).click();

    await expect(page.getByText("Here's what I found")).toBeVisible({ timeout: 30_000 });

    // Click "Analyze another"
    await page.getByRole('button', { name: 'Analyze another' }).click();

    // Should be back at mode picker
    await expect(page.getByText('Ready! What do you need help with?')).toBeVisible();
  });

  test('back button returns to mode picker from input', async ({ page }) => {
    await setupLocalScore(page, 'contract');

    await page.getByRole('button', { name: 'Get Started', exact: true }).click();
    await expect(page.getByText('Ready! What do you need help with?')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'A contract or agreement' }).click();

    await expect(page.locator('textarea')).toBeVisible();

    // Click back
    await page.getByText('← Back').click();

    // Should show mode picker again
    await expect(page.getByText('Ready! What do you need help with?')).toBeVisible();
  });

  test('empty input disables analyze button', async ({ page }) => {
    await setupLocalScore(page, 'general');

    await page.getByRole('button', { name: 'Get Started', exact: true }).click();
    await expect(page.getByText('Ready! What do you need help with?')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Your website copy or business description' }).click();

    // Button should be disabled with empty input
    const analyzeBtn = page.getByRole('button', { name: 'Paste something first...' });
    await expect(analyzeBtn).toBeVisible();
    await expect(analyzeBtn).toBeDisabled();
  });
});
