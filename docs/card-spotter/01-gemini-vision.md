# Agent 1 — Gemini Vision Client

## Objective
Extend `server/gemini.ts` to support image inputs via the Gemini Vision API.

## Dependencies
None — can start immediately.

## Context

The existing `askGemini()` function (server/gemini.ts) sends text-only prompts to Gemini 2.0 Flash. The same model and endpoint support multimodal input — we need a new `askGeminiVision()` that sends an image + text prompt.

### Gemini Vision API Format

The Gemini REST API accepts images as `inlineData` parts alongside text parts:

```json
{
  "contents": [
    {
      "parts": [
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "<base64-encoded-image>"
          }
        },
        {
          "text": "Identify all playing cards visible in this image..."
        }
      ]
    }
  ],
  "generationConfig": {
    "maxOutputTokens": 4096,
    "responseMimeType": "application/json"
  }
}
```

## What to Build

### File: `server/gemini.ts` (MODIFY)

Add a new exported function:

```typescript
export async function askGeminiVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  opts?: { systemPrompt?: string }
): Promise<string>
```

### Requirements

1. **Same retry logic** as existing `askGemini()` — reuse the `attempt()` pattern (retry once on 5xx/timeout)
2. **Same error handling** — throw descriptive errors
3. **Same API key handling** — `x-goog-api-key` header, never in URL
4. **Same model** — `gemini-2.0-flash`
5. **Response format** — `responseMimeType: 'application/json'` (same as text)
6. **Timeout** — 60s first attempt, 45s retry (same as text)
7. **Accept mimeType param** — caller passes `image/jpeg`, `image/png`, or `image/webp`
8. **Don't duplicate** — extract the shared retry/attempt logic into a private helper that both `askGemini()` and `askGeminiVision()` use

### Implementation Notes

- The `contents` array changes: instead of `[{ parts: [{ text }] }]`, it becomes `[{ parts: [{ inlineData: { mimeType, data } }, { text }] }]`
- `systemInstruction` works the same way for vision
- `maxOutputTokens: 4096` is sufficient for card identification (response is small)
- The base64 string should NOT include the `data:image/...;base64,` prefix — strip it if present

### Refactoring Opportunity

The current `attempt()` function is defined inside `askGemini()`. Extract it:

```typescript
// Private shared helper
async function geminiRequest(
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ ok: true; text: string } | { ok: false; retriable: boolean; status?: number }>

// Public: text-only
export async function askGemini(prompt, opts): Promise<string>

// Public: vision (image + text)
export async function askGeminiVision(imageBase64, mimeType, prompt, opts): Promise<string>
```

Both functions build their own `body` object and delegate to `geminiRequest()`.

## Output

- Modified `server/gemini.ts` with `askGeminiVision()` exported
- No new files
- No breaking changes to existing `askGemini()` callers

## Validation

```typescript
// Quick smoke test (not automated — requires API key)
const result = await askGeminiVision(
  someBase64Image,
  'image/jpeg',
  'What do you see in this image?'
);
console.log(result); // Should return JSON string
```
