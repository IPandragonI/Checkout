// Renders the app icons and favicon (a stylised dartboard with a gold tick) with no dependencies.
// Usage: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const NAVY = [17, 31, 66, 255];
const RED = [214, 64, 69, 255];
const GREEN = [46, 184, 114, 255];
const CREAM = [242, 234, 216, 255];
const DARK = [12, 18, 36, 255];
const GOLD = [242, 201, 76, 255];
const CLEAR = [0, 0, 0, 0];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encodes an RGBA PNG; `pixel(u, v)` returns [r, g, b, a] for unit coordinates. */
function png(size, pixel) {
  const S = size <= 48 ? 4 : 2; // heavier supersampling keeps tiny favicons crisp
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const p = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
        r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = a / (S * S);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header[e] = size >= 256 ? 0 : size;
    header[e + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bpp
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

/** Full board: 20 segments, treble and double rings. `scale` sizes it within the square. */
function board(scale, background) {
  return (u, v) => {
    const x = (u - 0.5) / scale, y = (v - 0.5) / scale;
    const r = Math.hypot(x, y);
    const seg = Math.floor(((Math.atan2(y, x) + Math.PI) / (2 * Math.PI)) * 20 + 0.5) % 2;
    if (r < 0.035) return RED;
    if (r < 0.075) return GREEN;
    if (r > 0.4) return background;
    if (r > 0.36) return seg ? RED : GREEN; // double ring
    if (r > 0.23 && r < 0.27) return seg ? GREEN : RED; // treble ring
    return seg ? CREAM : DARK;
  };
}

/** Simplified rings for 16–48px, where segments would turn to noise. */
function smallBoard(u, v) {
  const r = Math.hypot(u - 0.5, v - 0.5);
  if (r > 0.5) return CLEAR;
  if (r > 0.43) return RED;
  if (r > 0.31) return CREAM;
  if (r > 0.24) return GREEN;
  if (r > 0.13) return CREAM;
  return RED;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

/** A gold tick across the board: the "checkout". */
function withCheck(draw, width = 0.045, outline = 0.025) {
  return (u, v) => {
    const d = Math.min(distToSegment(u, v, 0.3, 0.52, 0.44, 0.66), distToSegment(u, v, 0.44, 0.66, 0.74, 0.34));
    if (d < width) return GOLD;
    if (d < width + outline) return NAVY;
    return draw(u, v);
  };
}

/** Shrinks a drawing towards the centre so it fits the maskable safe zone. */
function inset(draw, factor) {
  return (u, v) => draw(0.5 + (u - 0.5) / factor, 0.5 + (v - 0.5) / factor);
}

const icons = new URL("../public/icons/", import.meta.url);
mkdirSync(icons, { recursive: true });
const regular = withCheck(board(1.15, NAVY));
writeFileSync(new URL("icon-192.png", icons), png(192, regular));
writeFileSync(new URL("icon-512.png", icons), png(512, regular));
writeFileSync(new URL("icon-maskable-512.png", icons), png(512, inset(regular, 0.8)));
writeFileSync(new URL("apple-touch-icon.png", icons), png(180, regular));

const tiny = withCheck(smallBoard, 0.075, 0.04);
writeFileSync(
  new URL("../src/app/favicon.ico", import.meta.url),
  ico([16, 32, 48].map((size) => ({ size, data: png(size, tiny) }))),
);
console.log("Icons written to public/icons and src/app/favicon.ico");
