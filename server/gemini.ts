const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash';

export async function askGemini(prompt: string, opts?: {
  systemPrompt?: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('AI service not configured.');
  }

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const status = res.status;
      // Log details server-side only, return generic error to client
      const detail = await res.text().catch(() => '');
      console.error(`[Gemini] API error ${status}: ${detail.slice(0, 200)}`);
      throw new Error(`AI service error (${status}). Please try again.`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== 'string') {
      console.error('[Gemini] Unexpected response structure:', JSON.stringify(data).slice(0, 300));
      throw new Error('AI returned an unexpected response.');
    }

    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}
