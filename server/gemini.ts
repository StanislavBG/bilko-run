export { callGemini } from '@bilkobibitkov/ai-tool-kit';
import { callGemini } from '@bilkobibitkov/ai-tool-kit';

/** Thin wrapper that keeps the askGemini(prompt, opts?) signature for existing server routes. */
export async function askGemini(prompt: string, opts?: { systemPrompt?: string }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('AI service not configured.');

  const response = await callGemini({
    apiKey,
    prompt,
    system: opts?.systemPrompt,
    onLog: (msg) => console.warn(msg),
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== 'string') throw new Error('AI returned an invalid response.');
  return text.trim();
}
