/**
 * Minimal ZIP writer (STORE, no compression). PNG and JPEG are already compressed,
 * and storing keeps the writer short and easy to verify.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  date?: Date;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Build a ZIP archive as a list of chunks. Entry data is referenced, not copied, so
 * a batch needs no second full-size buffer: pass the chunks straight to `new Blob()`.
 */
export function createZip(entries: ZipEntry[]): Uint8Array[] {
  const enc = new TextEncoder();
  const FLAG_UTF8 = 0x0800;
  const prepared = entries.map((e) => {
    const name = enc.encode(e.name);
    return { name, data: e.data, crc: crc32(e.data), ...dosDateTime(e.date ?? new Date()) };
  });
  const localSize = prepared.reduce((s, e) => s + 30 + e.name.length + e.data.length, 0);
  const centralSize = prepared.reduce((s, e) => s + 46 + e.name.length, 0);
  if (localSize + centralSize + 22 > 0xffffffff || prepared.length > 0xffff) throw new RangeError('ZIP64 is not supported');

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const e of prepared) {
    const header = new Uint8Array(30 + e.name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, FLAG_UTF8, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, e.time, true);
    view.setUint16(12, e.date, true);
    view.setUint32(14, e.crc, true);
    view.setUint32(18, e.data.length, true);
    view.setUint32(22, e.data.length, true);
    view.setUint16(26, e.name.length, true);
    view.setUint16(28, 0, true);
    header.set(e.name, 30);
    offsets.push(offset);
    chunks.push(header, e.data);
    offset += header.length + e.data.length;
  }

  const tail = new Uint8Array(centralSize + 22);
  const view = new DataView(tail.buffer);
  let p = 0;
  prepared.forEach((e, i) => {
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true);
    view.setUint16(p + 6, 20, true);
    view.setUint16(p + 8, FLAG_UTF8, true);
    view.setUint16(p + 10, 0, true);
    view.setUint16(p + 12, e.time, true);
    view.setUint16(p + 14, e.date, true);
    view.setUint32(p + 16, e.crc, true);
    view.setUint32(p + 20, e.data.length, true);
    view.setUint32(p + 24, e.data.length, true);
    view.setUint16(p + 28, e.name.length, true);
    view.setUint16(p + 30, 0, true);
    view.setUint16(p + 32, 0, true);
    view.setUint16(p + 34, 0, true);
    view.setUint16(p + 36, 0, true);
    view.setUint32(p + 38, 0, true);
    view.setUint32(p + 42, offsets[i]!, true);
    tail.set(e.name, p + 46);
    p += 46 + e.name.length;
  });
  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 4, 0, true);
  view.setUint16(p + 6, 0, true);
  view.setUint16(p + 8, prepared.length, true);
  view.setUint16(p + 10, prepared.length, true);
  view.setUint32(p + 12, centralSize, true);
  view.setUint32(p + 16, offset, true);
  view.setUint16(p + 20, 0, true);
  chunks.push(tail);
  return chunks;
}
