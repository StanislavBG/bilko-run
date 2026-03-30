import * as https from 'https';
import * as http from 'http';

const BLOCKED_HOSTS = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|localhost|::1|169\.254\.)/i;
const MAX_FETCH_BYTES = 2 * 1024 * 1024; // 2MB

export function validatePublicUrl(raw: string): URL {
  const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP/HTTPS URLs allowed.');
  }
  if (BLOCKED_HOSTS.test(url.hostname)) {
    throw new Error('Internal/private URLs are not allowed.');
  }
  return url;
}

export function fetchPageBounded(parsedUrl: URL): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const req = protocol.get(
      parsedUrl.toString(),
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PageRoast/1.0)' }, timeout: 15000 } as any,
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, parsedUrl.toString());
          if (!['http:', 'https:'].includes(redirectUrl.protocol) || BLOCKED_HOSTS.test(redirectUrl.hostname)) {
            reject(new Error('Invalid redirect target.'));
            return;
          }
          const rProtocol = redirectUrl.protocol === 'https:' ? https : http;
          const rReq = rProtocol.get(redirectUrl.toString(), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PageRoast/1.0)' } } as any, (rRes) => {
            let data = '';
            let bytes = 0;
            rRes.on('data', (c: Buffer) => {
              bytes += c.length;
              if (bytes > MAX_FETCH_BYTES) { rReq.destroy(); reject(new Error('Page too large.')); return; }
              data += c.toString();
            });
            rRes.on('end', () => resolve(data));
          });
          rReq.on('error', reject);
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        let bytes = 0;
        res.on('data', (c: Buffer) => {
          bytes += c.length;
          if (bytes > MAX_FETCH_BYTES) { req.destroy(); reject(new Error('Page too large.')); return; }
          data += c.toString();
        });
        res.on('end', () => resolve(data));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  }).then(html =>
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
  );
}
