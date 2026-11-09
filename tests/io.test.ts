import { crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createZip, crc32 } from '../src/formats/zip.ts';
import { sanitizeBaseName, stripExtension, uniqueNames } from '../src/io/names.ts';
import { probeBlob, probeImage } from '../src/io/probe.ts';
import { AbortedError, TaskQueue, isAbort } from '../src/io/queue.ts';

/** Minimal ZIP central-directory reader for verification. */
function readZip(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files: Array<{ name: string; data: Uint8Array; crc: number; flags: number }> = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    expect(method).toBe(0);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const localName = v.getUint16(local + 26, true);
    const extra = v.getUint16(local + 28, true);
    const start = local + 30 + localName + extra;
    files.push({ name, data: bytes.subarray(start, start + size), crc, flags });
    p += 46 + nameLen;
  }
  return files;
}

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

describe('zip', () => {
  it('computes the same CRC-32 as zlib', () => {
    const data = new TextEncoder().encode('InkDoze sleep screen ✓');
    expect(crc32(data)).toBe(nodeCrc32(data));
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('stores files that read back intact with UTF-8 names', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array(1000).map((_, i) => i & 255);
    const zip = concat(createZip([
      { name: 'sleep.bmp', data: a, date: new Date(2026, 10, 10, 12, 0, 0) },
      { name: 'обои 日本.png', data: b },
    ]));
    const files = readZip(zip);
    expect(files.map((f) => f.name)).toEqual(['sleep.bmp', 'обои 日本.png']);
    expect([...files[0]!.data]).toEqual([1, 2, 3]);
    expect(files[1]!.data).toEqual(b);
    for (const f of files) {
      expect(f.crc).toBe(nodeCrc32(f.data));
      expect(f.flags & 0x0800).toBe(0x0800);
    }
  });
});

describe('file names', () => {
  it('sanitizes unsafe characters', () => {
    expect(sanitizeBaseName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
    expect(sanitizeBaseName('  ..hidden  ')).toBe('hidden');
    expect(sanitizeBaseName('')).toBe('image');
    expect(sanitizeBaseName('CON')).toBe('image');
    expect(sanitizeBaseName('x'.repeat(300))).toHaveLength(100);
    expect(sanitizeBaseName('Обои 日本')).toBe('Обои 日本');
  });

  it('strips one extension', () => {
    expect(stripExtension('photo.final.png')).toBe('photo.final');
    expect(stripExtension('.env')).toBe('.env');
  });

  it('makes names unique case-insensitively', () => {
    expect(uniqueNames(['a.png', 'A.png', 'a.png', 'a-2.png', 'b.png'])).toEqual(['a.png', 'A-2.png', 'a-3.png', 'a-2-2.png', 'b.png']);
  });
});

describe('image header probe', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  const quadPng = () => png(4, 4);
  const jpeg = (w: number, h: number) =>
    new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0]);
  const webp = (chunk: string, body: number[]) => {
    const b = new Uint8Array(40);
    b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
    b.set([...chunk].map((c) => c.charCodeAt(0)), 12);
    b.set(body, 20);
    return b;
  };

  it('reads PNG, JPEG and WebP sizes', () => {
    expect(probeImage(png(640, 480))).toEqual({ kind: 'png', width: 640, height: 480 });
    expect(probeImage(jpeg(1072, 1448))).toEqual({ kind: 'jpeg', width: 1072, height: 1448 });
    // VP8X: canvas width-1 / height-1 as 24-bit LE at offsets 24 and 27.
    expect(probeImage(webp('VP8X', [0, 0, 0, 0, 0x7f, 0x02, 0, 0x1f, 0x03, 0]))).toEqual({ kind: 'webp', width: 640, height: 800 });
    // VP8L: signature 0x2f, then 14-bit width-1 and height-1.
    const bits = (99) | (49 << 14);
    expect(probeImage(webp('VP8L', [0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >> 24) & 255]))).toEqual({ kind: 'webp', width: 100, height: 50 });
    // VP8: start code at 23..25, 14-bit dimensions at 26 and 28.
    expect(probeImage(webp('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x40, 0x01, 0xf0, 0x00]))).toEqual({ kind: 'webp', width: 320, height: 240 });
  });

  // JPEG with metadata segments larger than the first read (64 KiB) before the frame header.
  const jpegWithBigMetadata = () => {
    const parts: number[] = [0xff, 0xd8];
    const segment = (marker: number, length: number) => {
      parts.push(0xff, marker, length >> 8, length & 255, ...new Array<number>(length - 2).fill(0));
    };
    segment(0xe1, 65535); // EXIF with an embedded thumbnail can reach the 64 KiB segment limit
    segment(0xe2, 30000); // ICC profile
    parts.push(0xff, 0xc0, 0, 11, 8, 0x01, 0xe0, 0x02, 0x80, 1, 1, 0x11, 0);
    return new Uint8Array(parts);
  };

  it('reads past large JPEG metadata instead of reporting a damaged header', async () => {
    const bytes = jpegWithBigMetadata();
    expect(probeImage(bytes.subarray(0, 64 * 1024))).toBe('truncated');
    expect(await probeBlob(new Blob([bytes]))).toEqual({ kind: 'jpeg', width: 640, height: 480 });
  });

  it('reports a header cut off at the end of the file as corrupt', async () => {
    const bytes = jpegWithBigMetadata().subarray(0, 70_000);
    expect(await probeBlob(new Blob([bytes]))).toBe('corrupt');
    expect(await probeBlob(new Blob([quadPng().subarray(0, 20)]))).toBe('corrupt');
  });

  it('rejects other formats and damaged headers', () => {
    expect(probeImage(new TextEncoder().encode('GIF89a......'))).toBe('unsupported');
    expect(probeImage(new Uint8Array([0x42, 0x4d, 0, 0]))).toBe('unsupported');
    expect(probeImage(png(0, 10))).toBe('corrupt');
    expect(probeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe('corrupt');
  });
});

describe('task queue', () => {
  const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => (resolve = r));
    return { promise, resolve };
  };

  it('never runs more tasks than its concurrency', async () => {
    const q = new TaskQueue(2);
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 5 }, deferred);
    const all = gates.map((g) =>
      q.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await g.promise;
        running--;
      }),
    );
    await Promise.resolve();
    expect(q.running).toBe(2);
    expect(q.queued).toBe(3);
    gates.forEach((g) => g.resolve());
    await Promise.all(all);
    expect(peak).toBe(2);
  });

  it('drops waiting tasks when aborted', async () => {
    const q = new TaskQueue(1);
    const gate = deferred();
    const first = q.run(() => gate.promise);
    const ctrl = new AbortController();
    let started = false;
    const second = q.run(async () => {
      started = true;
    }, ctrl.signal);
    ctrl.abort();
    await expect(second).rejects.toBeInstanceOf(AbortedError);
    gate.resolve();
    await first;
    expect(started).toBe(false);
    expect(q.queued).toBe(0);
  });

  it('rejects immediately when already aborted', async () => {
    const q = new TaskQueue(1);
    const ctrl = new AbortController();
    ctrl.abort();
    const err = await q.run(async () => 1, ctrl.signal).catch((e: unknown) => e);
    expect(isAbort(err)).toBe(true);
  });
});
