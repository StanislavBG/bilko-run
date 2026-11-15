import { describe, expect, it } from 'vitest';
import { hasAudioTrack } from '../shared/video-audio.js';

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function ascii(s: string): Uint8Array {
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** ISO BMFF box: u32 size + 4-char type + payload. */
function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(...payload);
  const head = new Uint8Array(8);
  new DataView(head.buffer).setUint32(0, 8 + body.length);
  head.set(ascii(type), 4);
  return concat(head, body);
}

/** Box with size 1 and a 64-bit largesize. */
function largeBox(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(...payload);
  const head = new Uint8Array(16);
  const dv = new DataView(head.buffer);
  dv.setUint32(0, 1);
  head.set(ascii(type), 4);
  dv.setBigUint64(8, BigInt(16 + body.length));
  return concat(head, body);
}

/** hdlr full box: version/flags(4) + pre_defined(4) + handler_type(4) + reserved(12) + name. */
function hdlr(handler: string): Uint8Array {
  return box('hdlr', new Uint8Array(8), ascii(handler), new Uint8Array(12), ascii('h\0'));
}

function trak(handler: string): Uint8Array {
  return box('trak', box('tkhd', new Uint8Array(84)), box('mdia', box('mdhd', new Uint8Array(24)), hdlr(handler)));
}

const ftyp = box('ftyp', ascii('isom'), new Uint8Array(4), ascii('isomavc1'));

/** EBML size VINT (8-byte form unless small). */
function vsize(n: number): Uint8Array {
  if (n < 0x7f) return Uint8Array.of(0x80 | n);
  const out = new Uint8Array(8);
  out[0] = 0x01;
  let v = n;
  for (let i = 7; i >= 1; i--) {
    out[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  return out;
}

function ebml(id: number[], ...payload: Uint8Array[]): Uint8Array {
  const body = concat(...payload);
  return concat(Uint8Array.from(id), vsize(body.length), body);
}

const SEGMENT = [0x18, 0x53, 0x80, 0x67];
const TRACKS = [0x16, 0x54, 0xae, 0x6b];
const EBML_HEADER = ebml([0x1a, 0x45, 0xdf, 0xa3], ebml([0x42, 0x82], ascii('webm')));

function trackEntry(type: number): Uint8Array {
  return ebml([0xae], ebml([0xd7], Uint8Array.of(1)), ebml([0x83], Uint8Array.of(type)), ebml([0x86], ascii('V_VP9')));
}

function webm(...entries: Uint8Array[]): Uint8Array {
  const info = ebml([0x15, 0x49, 0xa9, 0x66], ebml([0x2a, 0xd7, 0xb1], Uint8Array.of(0x0f, 0x42, 0x40)));
  return concat(EBML_HEADER, ebml(SEGMENT, info, ebml(TRACKS, ...entries)));
}

function randomBytes(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    out[i] = s >>> 24;
  }
  return out;
}

describe('hasAudioTrack — MP4', () => {
  it('is true for vide + soun traks', () => {
    const file = concat(ftyp, box('moov', box('mvhd', new Uint8Array(100)), trak('vide'), trak('soun')));
    expect(hasAudioTrack(file, '.mp4')).toBe(true);
    expect(hasAudioTrack(file, '.MP4')).toBe(true);
  });

  it('is false for a vide-only file', () => {
    const file = concat(ftyp, box('moov', box('mvhd', new Uint8Array(100)), trak('vide')));
    expect(hasAudioTrack(file, '.mp4')).toBe(false);
  });

  it('finds moov placed after a large mdat', () => {
    const file = concat(ftyp, box('mdat', new Uint8Array(200_000)), box('moov', trak('vide'), trak('soun')));
    expect(hasAudioTrack(file, '.mp4')).toBe(true);
  });

  it('handles 64-bit largesize boxes', () => {
    const file = concat(ftyp, largeBox('mdat', new Uint8Array(1000)), largeBox('moov', trak('soun')));
    expect(hasAudioTrack(file, '.mp4')).toBe(true);
  });

  it('handles a size-0 moov that runs to the end', () => {
    const moov = box('moov', trak('soun'));
    new DataView(moov.buffer).setUint32(0, 0);
    expect(hasAudioTrack(concat(ftyp, moov), '.mp4')).toBe(true);
  });

  it('is false for a truncated moov', () => {
    const file = concat(ftyp, box('moov', trak('vide'), trak('soun')));
    const cut = file.subarray(0, file.length - 40);
    expect(hasAudioTrack(cut, '.mp4')).toBe(false);
  });

  it('is false for empty input and an oversize-claimed box', () => {
    expect(hasAudioTrack(new Uint8Array(0), '.mp4')).toBe(false);
    const huge = box('moov');
    new DataView(huge.buffer).setUint32(0, 0xffffffff);
    expect(hasAudioTrack(concat(ftyp, huge), '.mp4')).toBe(false);
  });

  it('works on a subarray with a nonzero byteOffset', () => {
    const file = concat(new Uint8Array(7), ftyp, box('moov', trak('soun')));
    expect(hasAudioTrack(file.subarray(7), '.mp4')).toBe(true);
  });

  it('stops after the element cap', () => {
    const many = new Uint8Array(8 * 20_000);
    const dv = new DataView(many.buffer);
    for (let i = 0; i < 20_000; i++) {
      dv.setUint32(i * 8, 8);
      many.set(ascii('free'), i * 8 + 4);
    }
    expect(hasAudioTrack(concat(ftyp, many, box('moov', trak('soun'))), '.mp4')).toBe(false);
  });
});

describe('hasAudioTrack — WebM', () => {
  it('is true for video + audio TrackEntry', () => {
    expect(hasAudioTrack(webm(trackEntry(1), trackEntry(2)), '.webm')).toBe(true);
    expect(hasAudioTrack(webm(trackEntry(1), trackEntry(2)), '.WebM')).toBe(true);
  });

  it('is false for video only', () => {
    expect(hasAudioTrack(webm(trackEntry(1)), '.webm')).toBe(false);
  });

  it('handles an unknown-size Segment', () => {
    const tracks = ebml(TRACKS, trackEntry(1), trackEntry(2));
    const file = concat(EBML_HEADER, Uint8Array.from(SEGMENT), Uint8Array.of(0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff), tracks);
    expect(hasAudioTrack(file, '.webm')).toBe(true);
    const short = concat(EBML_HEADER, Uint8Array.from(SEGMENT), Uint8Array.of(0xff), tracks);
    expect(hasAudioTrack(short, '.webm')).toBe(true);
  });

  it('is false for truncated input', () => {
    const file = webm(trackEntry(1), trackEntry(2));
    expect(hasAudioTrack(file.subarray(0, file.length - 6), '.webm')).toBe(false);
    expect(hasAudioTrack(new Uint8Array(0), '.webm')).toBe(false);
  });
});

describe('hasAudioTrack — garbage and other extensions', () => {
  it('returns false for random bytes', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const bytes = randomBytes(4096, seed);
      expect(hasAudioTrack(bytes, '.mp4')).toBe(false);
      expect(hasAudioTrack(bytes, '.webm')).toBe(false);
    }
  });

  it('returns false for other extensions', () => {
    const file = concat(ftyp, box('moov', trak('soun')));
    expect(hasAudioTrack(file, '.mov')).toBe(false);
    expect(hasAudioTrack(file, '')).toBe(false);
  });
});
