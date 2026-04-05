const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash';

export async function askGemini(prompt: string, opts?: {
  systemPrompt?: string;
}): Promise<string> {
  const apiKey: string | undefined = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('AI service not configured.');
  }
  const keyHeader: string = apiKey;

  // Pass API key via header, not URL param (avoids key leaking in logs/errors)
  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`;

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  if (opts?.systemPrompt) {
    body.systemInstruction = { parts: [{ text: opts.systemPrompt }] };
  }

  const bodyJson = JSON.stringify(body);

  // Retry once on timeout or 5xx — halves the failure rate for transient Gemini
  // issues. Callers deduct credits BEFORE this call, so reducing false failures
  // directly reduces "paid but got nothing" complaints.
  async function attempt(timeoutMs: number): Promise<{ ok: true; text: string } | { ok: false; retriable: boolean; status?: number; err?: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keyHeader },
        body: bodyJson,
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(`[Gemini] API error ${res.status}: ${detail.slice(0, 200)}`);
        return { ok: false, retriable: res.status >= 500 || res.status === 429, status: res.status };
      }
      let data: any;
      try { data = await res.json(); } catch { return { ok: false, retriable: false }; }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text || typeof text !== 'string') {
        console.error('[Gemini] Unexpected response structure:', JSON.stringify(data).slice(0, 300));
        return { ok: false, retriable: false };
      }
      return { ok: true, text: text.trim() };
    } catch (err: any) {
      // AbortError (timeout) and network-level fetch errors are retriable.
      const retriable = err?.name === 'AbortError' || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT' || err?.message?.includes('fetch');
      return { ok: false, retriable, err };
    } finally {
      clearTimeout(timeout);
    }
  }

  let result = await attempt(60_000);
  if (!result.ok && result.retriable) {
    console.warn('[Gemini] First attempt failed, retrying once');
    result = await attempt(45_000);
  }
  if (result.ok) return result.text;
  if ('status' in result && typeof result.status === 'number') {
    throw new Error(`AI service error (${result.status}). Please try again.`);
  }
  throw new Error('AI returned an invalid response.');
}
