// Reads every card in ../cards with Gemini and Claude, saves each answer, and builds a review report.
//
//   npm run compare                          # all cards, both readers
//   npm run compare -- --only gemini
//   npm run compare -- --card 07-pound-cake --force
//   npm run report                           # rebuild the report from saved answers
//
// A card is either one image file in cards/ or a folder of images (front and back, or two book
// pages), read in file-name order. Answers saved in results/ are reused unless --force is given.

import { readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { RECIPE_PROMPT, RECIPE_SCHEMA } from '../shared/recipe-schema.mjs';
import { buildReport } from './report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const CARDS_DIR = path.join(root, 'cards');
const RESULTS_DIR = path.join(root, 'results');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

// Prices in dollars per million tokens. Check them before trusting the cost column:
// Gemini https://ai.google.dev/gemini-api/docs/pricing, Claude https://claude.com/pricing
const env = process.env;
const READERS = {
  gemini: {
    model: env.GEMINI_MODEL || 'gemini-3.5-flash',
    inPerM: Number(env.GEMINI_PRICE_IN || 1.5),
    outPerM: Number(env.GEMINI_PRICE_OUT || 9),
    run: readWithGemini,
  },
  claude: {
    model: env.CLAUDE_MODEL || 'claude-opus-5-5',
    inPerM: Number(env.CLAUDE_PRICE_IN || 4),
    outPerM: Number(env.CLAUDE_PRICE_OUT || 20),
    run: readWithClaude,
  },
};

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    card: { type: 'string' },
    force: { type: 'boolean', default: false },
    'report-only': { type: 'boolean', default: false },
  },
});

async function main() {
  const cards = await listCards();
  if (!cards.length) {
    console.error(`No cards found. Put photos in ${CARDS_DIR} (see README).`);
    process.exit(1);
  }
  await mkdir(RESULTS_DIR, { recursive: true });

  if (!args['report-only']) {
    const readerNames = args.only ? [args.only] : Object.keys(READERS);
    for (const name of readerNames) {
      if (!READERS[name]) throw new Error(`Unknown reader "${name}". Use gemini or claude.`);
    }
    const selected = args.card ? cards.filter((c) => c.id === args.card) : cards;
    if (!selected.length) throw new Error(`No card named "${args.card}".`);

    for (const card of selected) {
      const images = await prepareImages(card.files);
      for (const name of readerNames) {
        const out = path.join(RESULTS_DIR, `${card.id}.${name}.json`);
        if (existsSync(out) && !args.force) {
          console.log(`skip  ${card.id} ${name} (already saved)`);
          continue;
        }
        const reader = READERS[name];
        const started = Date.now();
        let result;
        try {
          const { recipe, usage } = await reader.run(reader.model, images);
          const costUsd = (usage.input * reader.inPerM + usage.output * reader.outPerM) / 1e6;
          result = { card: card.id, reader: name, model: reader.model, ms: Date.now() - started, usage, costUsd, recipe };
          console.log(`done  ${card.id} ${name} ${result.ms} ms $${costUsd.toFixed(4)}`);
        } catch (err) {
          result = { card: card.id, reader: name, model: reader.model, ms: Date.now() - started, error: String(err?.message || err) };
          console.error(`FAIL  ${card.id} ${name}: ${result.error}`);
        }
        await writeFile(out, JSON.stringify(result, null, 2));
      }
    }
  }

  const reportPath = await buildReport({ cards, cardsDir: CARDS_DIR, resultsDir: RESULTS_DIR, readers: Object.keys(READERS) });
  console.log(`\nReport: ${reportPath}`);
}

async function listCards() {
  if (!existsSync(CARDS_DIR)) return [];
  const entries = (await readdir(CARDS_DIR)).filter((n) => !n.startsWith('.')).sort();
  const cards = [];
  for (const name of entries) {
    const full = path.join(CARDS_DIR, name);
    if ((await stat(full)).isDirectory()) {
      const files = (await readdir(full))
        .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
        .sort()
        .map((f) => path.join(name, f));
      if (files.length) cards.push({ id: name, files });
    } else if (IMAGE_EXT.has(path.extname(name).toLowerCase())) {
      cards.push({ id: path.parse(name).name, files: [name] });
    }
  }
  return cards;
}

// Same input for both readers: each photo turned upright, at most 2000 px on its long side, as JPEG.
async function prepareImages(files) {
  return Promise.all(
    files.map(async (rel) => {
      const buf = await sharp(path.join(CARDS_DIR, rel))
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      return { mimeType: 'image/jpeg', base64: buf.toString('base64') };
    }),
  );
}

let gemini;
async function readWithGemini(model, images) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set in .env');
  gemini ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const response = await gemini.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })),
          { text: RECIPE_PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: RECIPE_SCHEMA,
    },
  });
  const meta = response.usageMetadata ?? {};
  return {
    recipe: JSON.parse(response.text),
    usage: {
      input: meta.promptTokenCount ?? 0,
      // Thinking tokens are billed as output.
      output: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
    },
  };
}

let claude;
async function readWithClaude(model, images) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set in .env');
  claude ??= new Anthropic();
  // The server-side fallback re-runs the request on another model if this one declines it.
  const response = await claude.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: env.CLAUDE_EFFORT || 'medium',
      format: { type: 'json_schema', schema: RECIPE_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image',
            source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
          })),
          { type: 'text', text: RECIPE_PROMPT },
        ],
      },
    ],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined: ${response.stop_details?.category ?? 'no category'}`);
  }
  if (response.stop_reason === 'max_tokens') throw new Error('Claude hit max_tokens');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return {
    recipe: JSON.parse(text),
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
