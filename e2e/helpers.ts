import { readFile } from 'node:fs/promises';
import { crc32, deflateSync } from 'node:zlib';
import { expect, type Download, type Page } from '@playwright/test';

export type Rgba = [number, number, number, number];

/** Encode an 8-bit RGBA PNG without dependencies. */
export function makePng(width: number, height: number, pixel: (x: number, y: number) => Rgba): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const p = pixel(x, y);
      raw.set(p, y * (width * 4 + 1) + 1 + x * 4);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const RED: Rgba = [255, 0, 0, 255];
export const GREEN: Rgba = [0, 255, 0, 255];
export const BLUE: Rgba = [0, 0, 255, 255];
export const YELLOW: Rgba = [255, 255, 0, 255];

/** 400×200 image: red top-left, green top-right, blue bottom-left, yellow bottom-right. */
export function quadrants(width = 400, height = 200): Buffer {
  return makePng(width, height, (x, y) => (y < height / 2 ? (x < width / 2 ? RED : GREEN) : x < width / 2 ? BLUE : YELLOW));
}

/** Same luma weights as CrossPoint and the app. */
export const luma = ([r, g, b]: Rgba | [number, number, number]) => (77 * r + 150 * g + 29 * b) >> 8;

/** Encode a canvas-drawn image in the page with the browser's own encoder (JPEG/WebP fixtures). */
export async function encodeInPage(page: Page, mime: string, width: number, height: number): Promise<Buffer> {
  const bytes = await page.evaluate(
    async ({ mime, width, height }) => {
      const c = new OffscreenCanvas(width, height);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#204080';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#f0e0a0';
      ctx.fillRect(width / 4, height / 4, width / 2, height / 2);
      const blob = await c.convertToBlob({ type: mime, quality: 0.9 });
      return [...new Uint8Array(await blob.arrayBuffer())];
    },
    { mime, width, height },
  );
  return Buffer.from(bytes);
}

export interface Decoded {
  width: number;
  height: number;
  at: (x: number, y: number) => Rgba;
}

/** Decode image bytes with the browser's decoder (independent of InkDoze's encoders). */
export async function decodeInPage(page: Page, bytes: Buffer, mime: string, points: Array<[number, number]>): Promise<Decoded> {
  const result = await page.evaluate(
    async ({ data, mime, points }) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: mime }));
      const c = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0);
      const samples = points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]);
      return { width: bitmap.width, height: bitmap.height, samples };
    },
    { data: [...bytes], mime, points },
  );
  const map = new Map(points.map((p, i) => [`${p[0]},${p[1]}`, result.samples[i] as Rgba]));
  return {
    width: result.width,
    height: result.height,
    at: (x, y) => {
      const v = map.get(`${x},${y}`);
      if (!v) throw new Error(`point ${x},${y} was not sampled`);
      return v;
    },
  };
}

export function expectColor(actual: Rgba, expected: Rgba | [number, number, number], tolerance = 6) {
  for (let i = 0; i < 3; i++) expect(Math.abs(actual[i]! - expected[i]!), `channel ${i} of ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

export function expectGray(actual: Rgba, expected: number, tolerance = 6) {
  expectColor(actual, [expected, expected, expected], tolerance);
}

export async function downloadBytes(download: Download): Promise<Buffer> {
  const path = await download.path();
  return readFile(path);
}

export interface BmpHeader {
  width: number;
  height: number;
  bpp: number;
  compression: number;
  offset: number;
  stride: number;
  palette: number[];
  fileSize: number;
}

export function parseBmp(b: Buffer): BmpHeader {
  expect(b.toString('ascii', 0, 2)).toBe('BM');
  const bpp = b.readUInt16LE(28);
  const width = b.readInt32LE(18);
  const height = Math.abs(b.readInt32LE(22));
  let colors = b.readUInt32LE(46);
  if (!colors && bpp <= 8) colors = 1 << bpp;
  const palette: number[] = [];
  for (let i = 0; i < colors; i++) palette.push(b[54 + i * 4 + 2]!);
  return {
    width,
    height,
    bpp,
    compression: b.readUInt32LE(30),
    offset: b.readUInt32LE(10),
    stride: Math.floor((width * bpp + 31) / 32) * 4,
    palette,
    fileSize: b.readUInt32LE(2),
  };
}

/** Read a top-down pixel's palette index or gray value from an uncompressed bottom-up BMP. */
export function bmpPixel(b: Buffer, h: BmpHeader, x: number, y: number): number {
  const row = h.offset + (h.height - 1 - y) * h.stride;
  if (h.bpp === 24) return b[row + x * 3 + 1]!; // green channel
  const bit = x * h.bpp;
  const idx = (b[row + (bit >> 3)]! >> (8 - h.bpp - (bit & 7))) & ((1 << h.bpp) - 1);
  return h.palette[idx]!;
}

/** Minimal ZIP reader (STORE only). */
export function readZip(b: Buffer): Array<{ name: string; data: Buffer; crc: number }> {
  const eocd = b.length - 22;
  expect(b.readUInt32LE(eocd)).toBe(0x06054b50);
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const out: Array<{ name: string; data: Buffer; crc: number }> = [];
  for (let i = 0; i < count; i++) {
    expect(b.readUInt32LE(p)).toBe(0x02014b50);
    const crc = b.readUInt32LE(p + 16);
    const size = b.readUInt32LE(p + 20);
    const nameLen = b.readUInt16LE(p + 28);
    const local = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const data = b.subarray(start, start + size);
    expect(crc32(data), `crc of ${name}`).toBe(crc);
    out.push({ name, data, crc });
    p += 46 + nameLen;
  }
  return out;
}

export async function addFiles(page: Page, files: Array<{ name: string; mimeType: string; buffer: Buffer }>) {
  await page.getByTestId('file-input').first().setInputFiles(files);
}

export async function waitReady(page: Page, count: number) {
  await expect(page.locator('.file-item[data-status="ready"]')).toHaveCount(count, { timeout: 20_000 });
}

export async function waitPreview(page: Page, size: string) {
  await expect(page.getByTestId('preview-size')).toHaveText(new RegExp(size.replace('×', '×')), { timeout: 20_000 });
}

export async function selectDevice(page: Page, query: string, id: string) {
  await page.getByPlaceholder(/./).first().fill(query);
  await page.locator(`[data-device="${id}"]`).click();
}

/** Insert an APP1 segment of `size` bytes after SOI, like a large EXIF block. */
export function withLargeExif(jpeg: Buffer, size = 70_000): Buffer {
  const segments: Buffer[] = [];
  let left = size;
  while (left > 0) {
    const len = Math.min(left, 65533);
    const header = Buffer.from([0xff, 0xe1, ((len + 2) >> 8) & 255, (len + 2) & 255]);
    segments.push(header, Buffer.alloc(len));
    left -= len;
  }
  return Buffer.concat([jpeg.subarray(0, 2), ...segments, jpeg.subarray(2)]);
}
