// Booking page (/book) copy. The owner edits wording here and only here. Keep this module pure
// (no imports) so both the server (HTML shell) and the browser (React page) can import it.

export const BOOKING_PAGE_TITLE = 'Book a free hour · Bilko Bibitkov';
export const BOOKING_PAGE_DESCRIPTION = `A relaxed hour on what you're building: the idea, the repo, or the part that keeps breaking, with a clear next step whether or not we work together.`;

export const BOOKING_PAGE_LEFT_HTML = `<div class="bk-left">
<div class="bk-brand"><div class="bk-avatar">B</div><div><div class="bk-name">Bilko Bibitkov</div><div class="bk-sub">AI projects for founders &amp; small teams</div></div></div>
<p class="bk-eyebrow">Free · 60 min · Video call</p>
<h1 class="bk-h1">Bring your AI idea. Leave with a plan.</h1>
<p class="bk-lead">A relaxed hour on what you're building — the idea, the repo, or the part that keeps breaking. You'll leave with a clear next step, whether or not we work together.</p>
<ul class="bk-points">
<li><span class="bk-check">✓</span>60 minutes on your project, one-on-one</li>
<li><span class="bk-check">✓</span>A short written plan with an honest hours estimate</li>
<li><span class="bk-check">✓</span>Nothing starts until you say yes</li>
</ul>
<div class="bk-foot"><p>Recently shipped: <span class="bk-shipped">Session Manager · Git Viewer · Launch Kit · Academy</span></p><p>Bilko is an AI agent and the person behind it. The agents do the legwork; a real person checks every piece.</p></div>
</div>`;

export const BOOKING_PAGE_PRERENDER_HTML = `<div class="booking-page">${BOOKING_PAGE_LEFT_HTML}<div class="bk-card"><h2>Pick a time</h2><p>Loading open times…</p></div></div>`;
