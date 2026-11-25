// Builds a RecipeSage import file (JSON-LD) from reader answers, with the card photos embedded.
//
//   npm run jsonld                                   # the two sample recipes in samples/
//   npm run jsonld -- results/01-pound-cake.gemini.json results/02-chili.claude.json
//   npm run jsonld -- --source "Mom's recipe box" --label Grandma results/01-*.gemini.json
//
// Photos are taken from cards/<card id> (the card id is stored in each answer file).
// Output: recipesage-import/out/recipesage-import.json. Import it at RecipeSage > Settings > Import >
// JSON-LD. The import does not use RecipeSage credits.

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { recipeToJsonLd } from '../shared/to-jsonld.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const CARDS_DIR = path.join(root, 'cards');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: 'string', default: '' },
    label: { type: 'string', multiple: true, default: [] },
    out: { type: 'string', default: path.join(here, 'out', 'recipesage-import.json') },
  },
});

async function cardPhotos(cardId) {
  if (!cardId) return [];
  const dir = path.join(CARDS_DIR, cardId);
  if (existsSync(dir) && (await stat(dir)).isDirectory()) {
    return (await readdir(dir))
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => path.join(dir, f));
  }
  const single = (await readdir(CARDS_DIR).catch(() => [])).find(
    (f) => path.parse(f).name === cardId && IMAGE_EXT.has(path.extname(f).toLowerCase()),
  );
  return single ? [path.join(CARDS_DIR, single)] : [];
}

// RecipeSage accepts embedded images only as PNG. Keep them modest so the file stays small.
async function toPngDataUri(input) {
  const buf = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

// A plain placeholder image so the sample run still exercises the image path.
async function placeholderPng(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360">
    <rect width="100%" height="100%" fill="#f4ead8"/>
    <text x="50%" y="50%" font-size="32" text-anchor="middle" font-family="sans-serif" fill="#6b4a2b">${label}</text></svg>`;
  return toPngDataUri(Buffer.from(svg));
}

async function main() {
  const inputs = positionals.length
    ? positionals
    : ['sample-pound-cake.json', 'sample-chili.json'].map((f) => path.join(root, 'samples', f));

  const recipes = [];
  for (const file of inputs) {
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.error || !data.recipe) {
      console.warn(`skip ${file}: no recipe in it`);
      continue;
    }
    const photos = await cardPhotos(data.card);
    const pngDataUris = photos.length
      ? await Promise.all(photos.map(toPngDataUri))
      : [await placeholderPng(`Card photo: ${data.recipe.title}`)];
    const types = data.types ?? data.recipe.suggestedTypes?.slice(0, 1) ?? [];
    const labels = [...opts.label, ...(opts.source ? [opts.source] : []), ...(data.labels ?? [])];
    recipes.push(recipeToJsonLd(data.recipe, { types, labels, source: opts.source, pngDataUris }));
    console.log(`added ${data.recipe.title} (${pngDataUris.length} photo${pngDataUris.length === 1 ? '' : 's'})`);
  }

  await mkdir(path.dirname(opts.out), { recursive: true });
  // An array of Recipe objects, the same shape RecipeSage's own JSON-LD export writes.
  await writeFile(opts.out, JSON.stringify(recipes, null, 2));
  const kb = Math.round(Buffer.byteLength(JSON.stringify(recipes)) / 1024);
  console.log(`\nWrote ${recipes.length} recipes, ${kb} KB: ${opts.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
