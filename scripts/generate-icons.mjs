// Builds every icon, the favicon, the header logo and iOS splash screens from the official logo.
// Usage: npm run icons   (source: assets/brand/logo.png, square, rounded corners on a light background)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const path = (p) => fileURLToPath(new URL(p, import.meta.url));
const SOURCE = path("../assets/brand/logo.png");
const SPLASH_SCREENS = JSON.parse(readFileSync(path("../src/lib/splash-screens.json"), "utf8"));
/** Light splash background: the light theme's base-200. */
const SPLASH_BG = "#f2f4f8";

const meta = await sharp(SOURCE).metadata();
if (meta.width !== meta.height) throw new Error(`Logo must be square, got ${meta.width}x${meta.height}`);
const SIZE = meta.width;
// The artwork's corner radius is ~21% of its width; cutting slightly wider removes the light fringe.
const RADIUS = 0.214;
// Inset that clears the rounded corners entirely, for icons the OS masks itself.
const BLEED_INSET = Math.round(SIZE * 0.064);

function roundedMask(size) {
  const r = Math.round(size * RADIUS);
  return Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);
}

/** Logo with transparent rounded corners. */
function rounded(size) {
  return sharp(SOURCE)
    .resize(size, size, { kernel: "lanczos3" })
    .ensureAlpha()
    .composite([{ input: roundedMask(size), blend: "dest-in" }])
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toBuffer();
}

/** Square full-bleed crop inside the corners (maskable / Apple touch icons get masked by the OS). */
function fullBleed(size) {
  const side = SIZE - 2 * BLEED_INSET;
  return sharp(SOURCE)
    .extract({ left: BLEED_INSET, top: BLEED_INSET, width: side, height: side })
    .resize(size, size, { kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toBuffer();
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header[e] = size >= 256 ? 0 : size;
    header[e + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

async function splash({ width, height, ratio }) {
  const w = width * ratio;
  const h = height * ratio;
  const logo = Math.round(w * 0.42);
  return sharp({ create: { width: w, height: h, channels: 4, background: SPLASH_BG } })
    .composite([{ input: await rounded(logo), left: Math.round((w - logo) / 2), top: Math.round(h * 0.42 - logo / 2) }])
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toBuffer();
}

for (const dir of ["../public/icons/", "../public/brand/", "../public/splash/"]) mkdirSync(path(dir), { recursive: true });

const outputs = {
  "../public/icons/icon-192.png": rounded(192),
  "../public/icons/icon-512.png": rounded(512),
  "../public/icons/icon-maskable-512.png": fullBleed(512),
  "../public/icons/apple-touch-icon.png": fullBleed(180),
  "../public/brand/logo-256.png": rounded(256),
  "../src/app/favicon.ico": Promise.all([16, 32, 48].map(async (size) => ({ size, data: await rounded(size) }))).then(ico),
};
for (const s of SPLASH_SCREENS) {
  outputs[`../public/splash/apple-splash-${s.width * s.ratio}x${s.height * s.ratio}.png`] = splash(s);
}

for (const [file, data] of Object.entries(outputs)) writeFileSync(path(file), await data);
console.log(`Wrote ${Object.keys(outputs).length} files from ${SOURCE}`);
