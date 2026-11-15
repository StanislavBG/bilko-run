/**
 * Tells whether a video file carries an audio track, from its container bytes alone.
 * Pure and bounded: no imports, never throws, visits at most MAX_ELEMENTS boxes/elements.
 *
 * - .mp4 (ISO BMFF): top-level boxes -> moov > trak > mdia > hdlr; true when a handler_type is 'soun'.
 * - .webm (EBML): Segment > Tracks > TrackEntry > TrackType; true when a TrackType is 2 (audio).
 *
 * A child whose claimed size runs past its parent (truncated or oversize-claimed) stops the walk.
 */

const MAX_ELEMENTS = 10_000;

const WEBM_SEGMENT = 0x18538067;
const WEBM_TRACKS = 0x1654ae6b;
const WEBM_TRACK_ENTRY = 0xae;
const WEBM_TRACK_TYPE = 0x83;
const WEBM_TRACK_TYPE_AUDIO = 2;

interface Budget {
  left: number;
}

export function hasAudioTrack(bytes: Uint8Array, ext: string): boolean {
  try {
    const e = String(ext).toLowerCase();
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const budget: Budget = { left: MAX_ELEMENTS };
    if (e === '.mp4') return mp4HasAudio(view, budget);
    if (e === '.webm') return webmHasAudio(view, budget);
    return false;
  } catch {
    return false;
  }
}

// ---------- ISO BMFF ----------

interface BoxHeader {
  type: string;
  /** Offset of the first payload byte. */
  start: number;
  /** Offset one past the last payload byte. */
  end: number;
}

/** Reads the box header at `pos`; undefined when it is truncated or runs past `parentEnd`. */
function readBox(view: DataView, pos: number, parentEnd: number): BoxHeader | undefined {
  if (pos + 8 > parentEnd) return undefined;
  const size32 = view.getUint32(pos);
  const type = String.fromCharCode(
    view.getUint8(pos + 4),
    view.getUint8(pos + 5),
    view.getUint8(pos + 6),
    view.getUint8(pos + 7),
  );
  let start = pos + 8;
  let end: number;
  if (size32 === 1) {
    if (pos + 16 > parentEnd) return undefined;
    const hi = view.getUint32(pos + 8);
    const lo = view.getUint32(pos + 12);
    const size = hi * 0x1_0000_0000 + lo;
    start = pos + 16;
    if (size < 16 || !Number.isSafeInteger(size)) return undefined;
    end = pos + size;
  } else if (size32 === 0) {
    end = parentEnd;
  } else {
    if (size32 < 8) return undefined;
    end = pos + size32;
  }
  if (end > parentEnd) return undefined;
  return { type, start, end };
}

/** Calls `visit` for each child box in [start, end); stops when `visit` returns true or on a bad box. */
function walkBoxes(
  view: DataView,
  start: number,
  end: number,
  budget: Budget,
  visit: (box: BoxHeader) => boolean,
): boolean {
  let pos = start;
  while (pos < end) {
    if (--budget.left < 0) return false;
    const box = readBox(view, pos, end);
    if (!box) return false;
    if (visit(box)) return true;
    if (box.end <= pos) return false;
    pos = box.end;
  }
  return false;
}

function mp4HasAudio(view: DataView, budget: Budget): boolean {
  return walkBoxes(view, 0, view.byteLength, budget, (top) => {
    if (top.type !== 'moov') return false;
    return walkBoxes(view, top.start, top.end, budget, (trak) => {
      if (trak.type !== 'trak') return false;
      return walkBoxes(view, trak.start, trak.end, budget, (mdia) => {
        if (mdia.type !== 'mdia') return false;
        return walkBoxes(view, mdia.start, mdia.end, budget, (hdlr) => {
          if (hdlr.type !== 'hdlr' || hdlr.end - hdlr.start < 12) return false;
          const p = hdlr.start + 8;
          return (
            view.getUint8(p) === 0x73 && // s
            view.getUint8(p + 1) === 0x6f && // o
            view.getUint8(p + 2) === 0x75 && // u
            view.getUint8(p + 3) === 0x6e // n
          );
        });
      });
    });
  });
}

// ---------- EBML ----------

interface Vint {
  /** Decoded value; for sizes, undefined means unknown (all ones or above MAX_SAFE_INTEGER). */
  value: number | undefined;
  length: number;
}

/**
 * Reads an EBML VINT at `pos`. `keepMarker` keeps the length-marker bit (element IDs);
 * otherwise it is stripped (sizes). IDs are at most 4 bytes, sizes at most 8.
 */
function readVint(view: DataView, pos: number, limit: number, keepMarker: boolean): Vint | undefined {
  if (pos >= limit) return undefined;
  const first = view.getUint8(pos);
  if (first === 0) return undefined;
  let length = 1;
  while (!(first & (0x80 >> (length - 1)))) length++;
  if (keepMarker && length > 4) return undefined;
  if (pos + length > limit) return undefined;
  let value = keepMarker ? first : first & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i++) {
    const b = view.getUint8(pos + i);
    if (b !== 0xff) allOnes = false;
    value = value * 256 + b;
  }
  if (!keepMarker && (allOnes || !Number.isSafeInteger(value))) return { value: undefined, length };
  return { value, length };
}

interface EbmlElement {
  id: number;
  start: number;
  end: number;
}

function readElement(view: DataView, pos: number, parentEnd: number): EbmlElement | undefined {
  const id = readVint(view, pos, parentEnd, true);
  if (!id || id.value === undefined) return undefined;
  const size = readVint(view, pos + id.length, parentEnd, false);
  if (!size) return undefined;
  const start = pos + id.length + size.length;
  const end = size.value === undefined ? parentEnd : start + size.value;
  if (end > parentEnd) return undefined;
  return { id: id.value, start, end };
}

function walkElements(
  view: DataView,
  start: number,
  end: number,
  budget: Budget,
  visit: (el: EbmlElement) => boolean,
): boolean {
  let pos = start;
  while (pos < end) {
    if (--budget.left < 0) return false;
    const el = readElement(view, pos, end);
    if (!el) return false;
    if (visit(el)) return true;
    if (el.end <= pos) return false;
    pos = el.end;
  }
  return false;
}

function webmHasAudio(view: DataView, budget: Budget): boolean {
  return walkElements(view, 0, view.byteLength, budget, (top) => {
    if (top.id !== WEBM_SEGMENT) return false;
    return walkElements(view, top.start, top.end, budget, (tracks) => {
      if (tracks.id !== WEBM_TRACKS) return false;
      return walkElements(view, tracks.start, tracks.end, budget, (entry) => {
        if (entry.id !== WEBM_TRACK_ENTRY) return false;
        return walkElements(view, entry.start, entry.end, budget, (field) => {
          if (field.id !== WEBM_TRACK_TYPE || field.end - field.start < 1 || field.end - field.start > 8) return false;
          let v = 0;
          for (let p = field.start; p < field.end; p++) v = v * 256 + view.getUint8(p);
          return v === WEBM_TRACK_TYPE_AUDIO;
        });
      });
    });
  });
}
