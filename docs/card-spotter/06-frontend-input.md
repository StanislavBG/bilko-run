# Agent 6 — Frontend Page: Layout & Image Input

## Objective
Build the CardSpotter tool page with image upload UI. This is the input half — Agent 7 builds the results display.

## Dependencies
None — can start immediately. Uses existing shared components.

## What to Build

### File: `src/pages/CardSpotterPage.tsx` (NEW)

### Page Structure

```
┌─────────────────────────────────────────┐
│  ToolHero (toolSlug="card-spotter")     │
│  "Identify cards from a photo"          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Image Upload Zone              │    │
│  │                                 │    │
│  │  [Drop image here]             │    │
│  │  or click to browse            │    │
│  │  or paste from clipboard       │    │
│  │                                 │    │
│  │  📷 Camera (mobile)            │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Spot the Cards] button                │
│                                         │
│  Trust strip: "1 credit • instant"      │
└─────────────────────────────────────────┘
│                                         │
│  {Results rendered by Agent 7}          │
│                                         │
│  CrossPromo                             │
└─────────────────────────────────────────┘
```

### State

```typescript
type Status = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';

const [status, setStatus] = useState<Status>('idle');
const [imageData, setImageData] = useState<string | null>(null);     // base64
const [imageMimeType, setImageMimeType] = useState<string>('');
const [imagePreview, setImagePreview] = useState<string | null>(null); // data URI for preview
const [result, setResult] = useState<CardSpotterResult | null>(null);
const [error, setError] = useState<string>('');
```

### Image Upload Zone

Support 4 input methods:

#### 1. File Input (click to browse)
```typescript
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={handleFileSelect}
  className="hidden"
  ref={fileInputRef}
/>
```

#### 2. Drag and Drop
```typescript
<div
  onDragOver={e => { e.preventDefault(); setDragging(true); }}
  onDragLeave={() => setDragging(false)}
  onDrop={handleDrop}
  className={`border-2 border-dashed rounded-2xl p-10 transition-colors
    ${dragging ? 'border-rose-400 bg-rose-50/50' : 'border-warm-300 hover:border-warm-400'}`}
>
```

#### 3. Clipboard Paste
```typescript
useEffect(() => {
  const handlePaste = (e: ClipboardEvent) => {
    const file = Array.from(e.clipboardData?.files ?? [])
      .find(f => f.type.startsWith('image/'));
    if (file) handleFile(file);
  };
  document.addEventListener('paste', handlePaste);
  return () => document.removeEventListener('paste', handlePaste);
}, []);
```

#### 4. Camera Capture (mobile)
```typescript
<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handleFileSelect}
/>
```

### File Processing

```typescript
async function handleFile(file: File) {
  // Validate client-side first (fast feedback)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    setError('Use a JPEG, PNG, or WebP image.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setError('Image must be under 10MB.');
    return;
  }

  // Read as base64
  const reader = new FileReader();
  reader.onload = () => {
    const dataUri = reader.result as string;
    setImagePreview(dataUri);
    // Strip prefix for API: "data:image/jpeg;base64," → raw base64
    const base64 = dataUri.split(',')[1];
    setImageData(base64);
    setImageMimeType(file.type);
    setStatus('idle');
    setError('');
  };
  reader.readAsDataURL(file);
}
```

### Image Preview

Show the uploaded image with a "change" button:

```typescript
{imagePreview && (
  <div className="relative">
    <img
      src={imagePreview}
      alt="Uploaded hand"
      className="w-full max-h-80 object-contain rounded-xl border border-warm-200"
    />
    <button
      onClick={clearImage}
      className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow-sm hover:bg-white"
    >
      ✕
    </button>
  </div>
)}
```

### Submit

```typescript
async function handleSubmit() {
  if (!imageData) return;
  setStatus('analyzing');
  setError('');

  try {
    const res = await fetch('/api/demos/card-spotter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageData,
        mimeType: imageMimeType,
        email: user?.primaryEmailAddress?.emailAddress,
      }),
    });

    const data = await res.json();

    if (data.gated) {
      // Handle paywall (same pattern as other tools)
      return;
    }

    if (data.error) {
      setError(data.error);
      setStatus('error');
      return;
    }

    setResult(data);
    setStatus('done');
  } catch {
    setError('Something went wrong. Try again.');
    setStatus('error');
  }
}
```

### Analytics

```typescript
useEffect(() => {
  track('view_tool', { tool: 'card-spotter' });
}, []);

// On submit:
track('submit_start', { tool: 'card-spotter' });
// On success:
track('submit_success', { tool: 'card-spotter', metadata: { cardCount: result.count } });
```

### Hook Usage

Use `useToolApi` if it fits, but CardSpotter sends base64 image data (not form text), so you may need to call the API directly. The hook pattern expects `submit({ field: value })` — extend it or go direct.

Decision: **Go direct** with `fetch()`. The `useToolApi` hook's rate-limit/gating UI can be reimplemented inline. Simpler than bending the hook for binary data.

## UI Details

### Upload Zone (empty state)
- Large dashed border area
- Card suit icons as decoration: ♠ ♥ ♦ ♣
- Text: "Drop a photo of your hand here"
- Subtext: "or click to browse · or paste from clipboard"
- Camera button on mobile

### Upload Zone (image loaded)
- Image preview (max-height 320px, object-contain)
- "Change image" button (top-right corner)
- "Spot the Cards" submit button below (rose/red gradient, matches theme)

### Loading State
- Spinner over the image preview (semi-transparent overlay)
- Text: "Identifying cards..."

### Error State
- Red alert below upload zone
- Error message from server
- "Try again" button

## Output
- `src/pages/CardSpotterPage.tsx` (NEW) — exports `CardSpotterPage`
- The results section will be a placeholder `{/* Results: Agent 7 */}` comment for Agent 7 to fill in

## Validation
- Upload JPEG → shows preview
- Upload PNG → shows preview
- Upload GIF → shows error "Use a JPEG, PNG, or WebP image"
- Upload >10MB → shows error
- Drag and drop works
- Paste from clipboard works
- Click "Spot the Cards" → shows loading state → shows results (or error)
