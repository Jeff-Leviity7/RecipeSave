// Builds every app icon from the master logo in src/assets/RecipeSave7_Logo.png.
//
//   npm run icons
//
// The logo is a round emblem above the word "RecipeSave7" on a white background. Icons use only the
// emblem (the word is unreadable at icon sizes), with the white outside the emblem made transparent.
// Run it again whenever the logo changes; the outputs in public/ are committed.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(appDir, 'src/assets/RecipeSave7_Logo.png');
const PUBLIC = path.join(appDir, 'public');
const ICONS = path.join(PUBLIC, 'icons');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const PWA_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

const isDark = (data, i) => data[i] < 200 || data[i + 1] < 200 || data[i + 2] < 200;

/** Finds the emblem: the dark pixels above the first fully blank row that separates it from the word. */
async function findEmblem() {
  const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const rowHasInk = (y) => {
    for (let x = 0; x < W; x++) if (isDark(data, (y * W + x) * C)) return true;
    return false;
  };
  let top = 0;
  while (top < H && !rowHasInk(top)) top++;
  let bottom = top;
  while (bottom < H && rowHasInk(bottom)) bottom++; // first blank row after the emblem
  let left = W;
  let right = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < W; x++) {
      if (isDark(data, (y * W + x) * C)) {
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top };
}

/** The emblem as a square RGBA image with the white outside it made transparent. */
async function emblemImage(box) {
  const pad = 8;
  const side = Math.max(box.width, box.height) + pad * 2;
  const { data, info } = await sharp(SOURCE)
    .extract(box)
    .extend({
      top: Math.floor((side - box.height) / 2),
      bottom: Math.ceil((side - box.height) / 2),
      left: Math.floor((side - box.width) / 2),
      right: Math.ceil((side - box.width) / 2),
      background: WHITE,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Flood-fill from the edges through near-white pixels; everything reached is background.
  const W = info.width;
  const H = info.height;
  const near = (p) => data[p * 4] > 235 && data[p * 4 + 1] > 235 && data[p * 4 + 2] > 235;
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !near(p)) continue;
    seen[p] = 1;
    const x = p % W;
    if (x > 0) stack.push(p - 1);
    if (x < W - 1) stack.push(p + 1);
    if (p >= W) stack.push(p - W);
    if (p < W * (H - 1)) stack.push(p + W);
  }
  for (let p = 0; p < W * H; p++) if (seen[p]) data[p * 4 + 3] = 0;

  // Soften the cut edge: a background pixel next to the emblem keeps a little opacity.
  const alpha = Buffer.from(data.filter((_, i) => i % 4 === 3));
  for (let p = 0; p < W * H; p++) {
    if (!seen[p]) continue;
    const x = p % W;
    const n = (x > 0 && !seen[p - 1]) + (x < W - 1 && !seen[p + 1]) + (p >= W && !seen[p - W]) + (p < W * (H - 1) && !seen[p + W]);
    if (n) alpha[p] = Math.min(255, n * 64);
  }
  for (let p = 0; p < W * H; p++) data[p * 4 + 3] = alpha[p];

  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

/** Emblem scaled to `scale` of `size`, centred on a square of `background`. */
async function icon(emblem, size, { scale = 1, background = CLEAR } = {}) {
  const inner = Math.round(size * scale);
  const art = await sharp(emblem).resize(inner, inner, { kernel: 'lanczos3' }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: art, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** A .ico file holding PNG images (supported by every current browser and Windows Vista onward). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

async function main() {
  await mkdir(ICONS, { recursive: true });
  const box = await findEmblem();
  const emblem = await emblemImage(box);
  const out = (name, buf) => writeFile(path.join(PUBLIC, name), buf).then(() => console.log(`  ${name}`));

  console.log(`Emblem found at ${box.left},${box.top} (${box.width}x${box.height}). Writing:`);

  // Manifest icons ("any"): transparent background, emblem fills the square.
  for (const s of PWA_SIZES) await out(`icons/icon-${s}x${s}.png`, await icon(emblem, s));

  // Manifest icons ("maskable"): Android crops these to a circle or squircle, so the emblem sits
  // inside the 80% safe zone on a solid background.
  for (const s of [192, 512]) await out(`icons/maskable-${s}x${s}.png`, await icon(emblem, s, { scale: 0.74, background: WHITE }));

  // iOS home screen: opaque, iOS rounds the corners itself.
  await out('apple-touch-icon.png', await icon(emblem, 180, { scale: 0.88, background: WHITE }));

  // Browser tab icons.
  await out('favicon-16x16.png', await icon(emblem, 16));
  await out('favicon-32x32.png', await icon(emblem, 32));
  const icoImages = [];
  for (const s of [16, 32, 48]) icoImages.push({ size: s, data: await icon(emblem, s) });
  await out('favicon.ico', ico(icoImages));

  // In-app header mark and a web-sized copy of the full logo (for the README, sign-in screen, etc.).
  await out('logo-emblem.png', await icon(emblem, 256));
  await out('logo.png', await sharp(SOURCE).resize(1024, 1024).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer());

  // Link preview image (Open Graph): 1200x630, logo centred on white.
  const full = await sharp(SOURCE).resize(560, 560).toBuffer();
  await out(
    'og-image.png',
    await sharp({ create: { width: 1200, height: 630, channels: 4, background: WHITE } })
      .composite([{ input: full, gravity: 'centre' }])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
