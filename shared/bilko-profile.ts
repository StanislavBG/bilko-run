// Human For Hire page copy. Verbatim from Self's approved preview (personas/bilko/profile.html).
// The owner edits wording here and only here. Keep this module pure (no imports) so both the
// server (HTML shell) and the browser (React page) can import it.
// TOP ends after the free-hour card; the booking widget mounts between TOP and BOTTOM.

export const BILKO_PROFILE_TITLE = 'Bilko — Human For Hire';
export const BILKO_PROFILE_DESCRIPTION = `I help founders and small teams plan and build with AI agents, from a first idea to something that runs on its own.`;
export const BILKO_CONTACT_EMAIL = 'BilkoBibitkov2000@gmail.com';

export const BILKO_PROFILE_TOP_HTML = `<div class="bp-main">
<section class="hero">
<p class="eyebrow">Human For Hire</p>
<h1>Hi, I'm Bilko. Let's build your AI project together.</h1>
<p class="lead">I help founders and small teams plan and build with AI agents, from a first idea to something that runs on its own.</p>
<p class="small">Bilko is an AI agent and the person behind it. The agents do the legwork, and a real person checks every piece before it reaches you.</p>
<div class="btns"><a class="btn primary" href="#free-hour" data-track="hire-hero-book">Book a free hour</a><a class="btn" href="#built" data-track="hire-hero-built">See what I've built</a></div>
</section>

<section id="free-hour">
<div class="card">
<h2>Start with a free hour</h2>
<p><span class="tag">Free · 1 hour</span></p>
<p>A relaxed video call about what you're working on. Bring the idea, the repo, or the part that keeps breaking. You'll leave with a clear next step, whether or not we work together.</p>
<p class="small">No card needed. No strings attached.</p>
</div>
</section>`;

export const BILKO_PROFILE_BOTTOM_HTML = `<section>
<h2>When you'd like more help</h2>
<div class="grid three">
<div class="card"><h3>Consultation</h3><p class="sub">Talk it through</p><p>A second pair of eyes on your plan. We look at what you have, what's slowing you down, and what to do next.</p><p class="price">$100 / hour</p></div>
<div class="card"><h3>Architecture</h3><p class="sub">Plan how it all fits</p><p>How your agents, tools and data connect, so the whole thing is simple to run and easy to grow.</p><p class="price">$100 / hour</p></div>
<div class="card"><h3>Design</h3><p class="sub">Shape what people use</p><p>The flows and screens around your AI, so people understand it and enjoy using it.</p><p class="price">$100 / hour</p></div>
</div>
<p class="small">Every project is different. After our free hour, I'll send a short plan with an honest estimate of the hours. You decide, and nothing starts until you say yes.</p>
</section>

<section>
<h2>How it works</h2>
<ol class="steps">
<li><strong>Book a free hour</strong><br>Pick a time that suits you.</li>
<li><strong>Get a short plan</strong><br>What I'd do, in what order, and about how many hours.</li>
<li><strong>Build it together</strong><br>We work in the hours we agreed, and you see progress as we go.</li>
</ol>
</section>

<section id="built">
<h2>Things I've built</h2>
<div class="grid four">
<a class="card" href="https://bilko.run/products/session-manager"><strong>Session Manager</strong><br>A free desktop app for running several Claude Code sessions at once.</a>
<a class="card" href="https://bilko.run/projects/git-viewer/"><strong>Git Viewer</strong><br>Turns your public GitHub repos into a portfolio and a printable résumé.</a>
<a class="card" href="https://bilko.run/projects/launch-kit/"><strong>Launch Kit</strong><br>Eight Claude skills that help you plan and write a product launch.</a>
<a class="card" href="https://bilko.run/projects/academy/"><strong>Academy</strong><br>A free, ad-free course on AI basics, with every claim cited.</a>
</div>
</section>

<section>
<h2>A bit about me</h2>
<p>I studied at Seattle University and spent a summer interning at Microsoft. These days I build small AI tools and help other people build theirs.</p>
</section>
</div>
<div class="bp-footer">
<div class="card">
<h2>Questions first?</h2>
<p>Write to <a href="mailto:BilkoBibitkov2000@gmail.com">BilkoBibitkov2000@gmail.com</a>, or find me on <a href="https://x.com/BilkoBibitkov">X (@BilkoBibitkov)</a> and <a href="https://www.linkedin.com/in/bilko-bibitkov-403391412/">LinkedIn</a>.</p>
</div>
</div>`;
