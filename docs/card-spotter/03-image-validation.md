# Agent 3 — Image Validation & Preparation

## Objective
Validate uploaded images, strip data URI prefixes, enforce size/format limits, and extract clean base64 for Gemini.

## Dependencies
None — can start immediately.

## What to Build

### File: `server/image-validation.ts` (NEW)

```typescript
export interface ValidatedImage {
  base64: string;     // Clean base64 (no data URI prefix)
  mimeType: string;   // image/jpeg | image/png | image/webp
  sizeBytes: number;  // Decoded byte size
}

export interface ValidationError {
  valid: false;
  error: string;
}

export type ValidationResult =
  | { valid: true; image: ValidatedImage }
  | ValidationError;

export function validateImage(
  raw: string,
  declaredMimeType?: string
): ValidationResult
```

### Validation Rules

1. **Strip data URI prefix** if present
   - Input: `data:image/jpeg;base64,/9j/4AAQ...`
   - Output: `/9j/4AAQ...`
   - Extract mimeType from prefix if `declaredMimeType` not provided

2. **Check base64 validity**
   - Must match `/^[A-Za-z0-9+/]+=*$/` after stripping whitespace
   - Decode to buffer to verify

3. **Check mimeType**
   - Allowed: `image/jpeg`, `image/png`, `image/webp`
   - Reject: `image/gif`, `image/svg+xml`, `image/bmp`, anything else
   - Also sniff magic bytes from decoded buffer as sanity check:
     - JPEG: starts with `FF D8 FF`
     - PNG: starts with `89 50 4E 47`
     - WebP: starts with `52 49 46 46` ... `57 45 42 50`

4. **Check size**
   - Decoded size must be ≤ 10MB (10 * 1024 * 1024 bytes)
   - Base64 string length must be ≤ 14MB (base64 overhead is ~33%)

5. **Reject empty/tiny images**
   - Decoded size must be ≥ 1KB (likely not a real image if smaller)

### Error Messages (user-friendly)

```typescript
'No image provided.'
'Image format not supported. Use JPEG, PNG, or WebP.'
'Image is too large. Maximum size is 10MB.'
'Image data is corrupted or invalid.'
'Image file appears to be empty.'
'Image content does not match declared format.'
```

### Magic Byte Sniffing

```typescript
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header (also check bytes 8-11 for WEBP)
};

function sniffMimeType(buffer: Buffer): string | null {
  // Check first N bytes against known signatures
}
```

### Security Considerations

- **No file writes** — everything stays in memory as buffers/strings
- **No path traversal** — no filenames involved
- **No execution** — never interpret image as code
- **Size limits enforced before decoding** — check string length first to avoid OOM on huge payloads
- **Strip EXIF data?** — Not necessary since we never store the image, but note that EXIF may contain GPS coordinates that get sent to Gemini. Document this in privacy section.

## Output
- `server/image-validation.ts` (NEW)
- Exports: `validateImage`, `ValidatedImage`, `ValidationResult`

## Validation

```typescript
// Valid JPEG
validateImage('data:image/jpeg;base64,/9j/4AAQ...', 'image/jpeg')
// → { valid: true, image: { base64: '/9j/4AAQ...', mimeType: 'image/jpeg', sizeBytes: 12345 } }

// Invalid format
validateImage('data:image/gif;base64,...', 'image/gif')
// → { valid: false, error: 'Image format not supported. Use JPEG, PNG, or WebP.' }

// Too large
validateImage(hugeBase64String)
// → { valid: false, error: 'Image is too large. Maximum size is 10MB.' }

// Corrupted
validateImage('not-valid-base64!!!')
// → { valid: false, error: 'Image data is corrupted or invalid.' }

// Mismatch (says JPEG, actually PNG)
validateImage(pngBase64, 'image/jpeg')
// → { valid: false, error: 'Image content does not match declared format.' }
```
