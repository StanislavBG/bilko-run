import type { SanityTarget, SubagentResult, TargetStatus, Finding } from './types.js';

const HOST_URL = 'https://bilko.run';

// Secret patterns from PRD — ordered by severity
const SECRET_PATTERNS: Array<{ re: RegExp; kind: string; severity: Finding['severity'] }> = [
  { re: /\bsk-[A-Za-z0-9]{20,}/g,                                     kind: 'sk-secret',    severity: 'critical' },
  { re: /\bAIza[0-9A-Za-z_-]{30,}/g,                                  kind: 'google-key',   severity: 'high'     },
  { re: /eyJ[A-Za-z0-9_=-]{20,}\.[A-Za-z0-9_=-]+\.[A-Za-z0-9_=-]+/g, kind: 'jwt',          severity: 'med'      },
  { re: /\bpk_(live|test)_[A-Za-z0-9]{20,}/g,                         kind: 'stripe-pk',    severity: 'low'      },
];

const SSRF_PAYLOADS = [
  'http://localhost',
  'http://169.254.169.254/latest/meta-data',
  'file:///etc/passwd',
];

function redact(match: string): string {
  return match.slice(0, 6) + '…[redacted]';
}

async function fetchText(url: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function checkHeaders(target: SanityTarget): Promise<{ status: TargetStatus; findings: Finding[] }> {
  const findings: Finding[] = [];
  let headers: Headers;
  try {
    const res = await fetch(target.url, { method: 'HEAD' });
    headers = res.headers;
  } catch {
    return { status: 'error' as TargetStatus, findings: [{ severity: 'high', target: target.slug, kind: 'unreachable', detail: 'HEAD request failed' }] };
  }

  // CSP check
  const csp = headers.get('content-security-policy') || headers.get('content-security-policy-report-only') || '';
  if (!csp) {
    findings.push({ severity: 'high', target: target.slug, kind: 'csp-missing', detail: 'Content-Security-Policy header absent' });
  } else {
    // Flag unsafe-inline for scripts when not behind nonce/hash
    const hasNonce = /nonce-/i.test(csp);
    const hasHash = /sha256-|sha384-|sha512-/i.test(csp);
    if (/unsafe-inline/i.test(csp) && !hasNonce && !hasHash) {
      findings.push({ severity: 'high', target: target.slug, kind: 'csp-unsafe-inline', detail: 'CSP allows unsafe-inline scripts without nonce/hash' });
    }
  }

  // HSTS check
  const hsts = headers.get('strict-transport-security') || '';
  if (!hsts) {
    findings.push({ severity: 'med', target: target.slug, kind: 'hsts-missing', detail: 'Strict-Transport-Security header absent' });
  } else {
    const match = /max-age=(\d+)/i.exec(hsts);
    const maxAge = match ? parseInt(match[1], 10) : 0;
    if (maxAge < 15_552_000) {
      findings.push({ severity: 'med', target: target.slug, kind: 'hsts-short', detail: `HSTS max-age=${maxAge} < 15552000 (180d)` });
    }
  }

  // Frame-ancestors check
  const frameAncestors = /frame-ancestors\s+[^;]+/i.exec(csp)?.[0] ?? '';
  const xFrameOptions = headers.get('x-frame-options') || '';
  if (!frameAncestors && !xFrameOptions) {
    findings.push({ severity: 'med', target: target.slug, kind: 'frame-ancestors-missing', detail: 'No frame-ancestors CSP directive or X-Frame-Options header' });
  }

  const status: TargetStatus = findings.some(f => f.severity === 'critical' || f.severity === 'high') ? 'fail'
    : findings.length > 0 ? 'warn'
    : 'pass';

  return { status, findings };
}

async function scanForSecrets(target: SanityTarget): Promise<{ status: TargetStatus; findings: Finding[] }> {
  const findings: Finding[] = [];
  const html = await fetchText(target.url);
  if (!html) return { status: 'warn', findings: [{ severity: 'low', target: target.slug, kind: 'fetch-failed', detail: 'Could not fetch page HTML for secret scan' }] };

  const contentToScan: string[] = [html];

  // Extract linked JS bundle URLs
  const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+\.js[^"]*)"/gi)].map(m => m[1]);
  for (const src of scriptSrcs.slice(0, 10)) { // limit to 10 bundles
    const absoluteUrl = src.startsWith('http') ? src : new URL(src, target.url).toString();
    const js = await fetchText(absoluteUrl, 20_000);
    if (js) contentToScan.push(js);
  }

  for (const content of contentToScan) {
    for (const { re, kind, severity } of SECRET_PATTERNS) {
      re.lastIndex = 0;
      const matches = content.match(re);
      if (matches) {
        for (const match of matches.slice(0, 3)) {
          findings.push({ severity, target: target.slug, kind, detail: `Found: ${redact(match)}` });
        }
      }
    }
  }

  const status: TargetStatus = findings.some(f => f.severity === 'critical' || f.severity === 'high') ? 'fail'
    : findings.length > 0 ? 'warn'
    : 'pass';

  return { status, findings };
}

async function checkSSRF(): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const payload of SSRF_PAYLOADS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(`${HOST_URL}/api/page-fetch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: payload }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status < 400) {
        findings.push({
          severity: 'critical',
          target: 'host',
          kind: 'ssrf',
          detail: `SSRF probe ${payload} returned ${res.status} (expected 4xx)`,
        });
      }
    } catch {
      // AbortError or network error → endpoint rejected, good
    }
  }
  return findings;
}

export async function runSecurity(targets: SanityTarget[], failFast = false): Promise<SubagentResult> {
  const perTarget: Record<string, TargetStatus> = {};
  const allFindings: Finding[] = [];
  const rows: string[] = [];

  // SSRF check for host (once, not per-target)
  const ssrfFindings = await checkSSRF();
  allFindings.push(...ssrfFindings);

  for (const target of targets) {
    const [headerResult, secretResult] = await Promise.all([
      checkHeaders(target),
      scanForSecrets(target),
    ]);

    const findings = [...headerResult.findings, ...secretResult.findings];
    allFindings.push(...findings);

    const targetStatus: TargetStatus = findings.some(f => f.severity === 'critical' || f.severity === 'high') ? 'fail'
      : findings.some(f => f.severity === 'med') ? 'warn'
      : findings.length > 0 ? 'warn'
      : 'pass';

    perTarget[target.slug] = targetStatus;
    const icon = targetStatus === 'pass' ? '✅' : targetStatus === 'warn' ? '🟡' : '❌';
    const cspIcon = headerResult.findings.some(f => f.kind.startsWith('csp')) ? (headerResult.findings.some(f => f.severity === 'high') ? '❌' : '🟡') : '✅';
    const hstsIcon = headerResult.findings.some(f => f.kind.startsWith('hsts')) ? '🟡' : '✅';
    const secretIcon = secretResult.findings.some(f => f.severity !== 'low') ? '❌' : secretResult.findings.length > 0 ? '🟡' : '✅';
    rows.push(`| ${target.slug} | ${cspIcon} | ${hstsIcon} | ${secretIcon} | ${icon} |`);

    if (failFast && targetStatus === 'fail') break;
  }

  const allStatuses = Object.values(perTarget);
  const status: TargetStatus = allStatuses.some(s => s === 'fail') || ssrfFindings.length > 0 ? 'fail'
    : allStatuses.some(s => s === 'warn') ? 'warn'
    : 'pass';

  const findingsMd = allFindings.length === 0
    ? '_No findings._'
    : allFindings.map(f => `- **[${f.severity.toUpperCase()}]** \`${f.target}\` ${f.kind}: ${f.detail}`).join('\n');

  const sectionMd = [
    '## Security\n',
    '| Target | CSP | HSTS | Secrets | Overall |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '**Findings:**',
    findingsMd,
  ].join('\n');

  return {
    name: 'security',
    status,
    perTarget,
    details: `${allFindings.filter(f => f.severity === 'critical' || f.severity === 'high').length} critical/high finding(s)`,
    findings: allFindings,
    sectionMd,
  };
}
