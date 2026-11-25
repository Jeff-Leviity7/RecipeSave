// Free scans: reads a recipe with Gemini on the host's key until the user reaches their weekly
// dollar limit, or all users together reach the monthly total.
//
// Firestore layout (only this function writes it; clients have no access, see firestore.rules):
//   config/freeScans                       { enabled, perUserWeeklyUsd, monthlyTotalUsd, model, inputPricePerMTok, outputPricePerMTok }
//   freeScanUsers/{uid}/weeks/{YYYY-Www}   { spentUsd, scans, updatedAt }   ISO week, starts Monday 00:00 UTC
//   freeScanMonths/{YYYY-MM}               { spentUsd, scans, updatedAt }   all users together
//
// Starting values (Jeff, 2026-11-25): perUserWeeklyUsd 10, monthlyTotalUsd 200.
// The config can be changed in the Firebase console without a release.
// Status: first draft from milestone 1. The plan builds and tests it in milestone 4.

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI } from '@google/genai';
import { RECIPE_PROMPT, RECIPE_SCHEMA } from './recipe-schema';

initializeApp();
const db = getFirestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

interface FreeScanConfig {
  enabled: boolean;
  perUserWeeklyUsd: number;
  monthlyTotalUsd: number;
  model: string;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
}

interface ScanRequest {
  images: { mimeType: string; base64: string }[];
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const freeScan = onCall(
  {
    secrets: [GEMINI_API_KEY],
    enforceAppCheck: true,
    memory: '512MiB',
    timeoutSeconds: 120,
    maxInstances: 5,
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to use free scans.');

    const images = validate(request.data as ScanRequest);
    const config = await loadConfig();
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const userRef = db.doc(`freeScanUsers/${uid}/weeks/${isoWeekId(now)}`);
    const monthRef = db.doc(`freeScanMonths/${month}`);

    // Check limits before spending. A few scans running at the same moment can each pass this check,
    // so the overrun is at most a few cents; the totals below are still exact.
    const [userSnap, monthSnap] = await db.getAll(userRef, monthRef);
    const userSpent = userSnap.get('spentUsd') ?? 0;
    const monthSpent = monthSnap.get('spentUsd') ?? 0;
    if (userSpent >= config.perUserWeeklyUsd) {
      throw new HttpsError(
        'resource-exhausted',
        'Your free scans for this week are used up. They start again on Monday, or you can add your own Gemini key in Settings.',
        { reason: 'weekly-limit', resetsAt: nextMondayUtc(now).toISOString() },
      );
    }
    if (monthSpent >= config.monthlyTotalUsd) {
      throw new HttpsError('resource-exhausted', 'Free scans are paused until next month. You can add your own Gemini key in Settings.', {
        reason: 'monthly-limit',
      });
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
    const response = await ai.models.generateContent({
      model: config.model,
      contents: [
        {
          role: 'user',
          parts: [...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } })), { text: RECIPE_PROMPT }],
        },
      ],
      config: { responseMimeType: 'application/json', responseJsonSchema: RECIPE_SCHEMA },
    });

    const meta = response.usageMetadata ?? {};
    const inputTokens = meta.promptTokenCount ?? 0;
    const outputTokens = (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);
    const costUsd = (inputTokens * config.inputPricePerMTok + outputTokens * config.outputPricePerMTok) / 1e6;

    const add = { spentUsd: FieldValue.increment(costUsd), scans: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() };
    await Promise.all([userRef.set(add, { merge: true }), monthRef.set(add, { merge: true })]);

    let recipe: unknown;
    try {
      recipe = JSON.parse(response.text ?? '');
    } catch {
      throw new HttpsError('internal', 'The reader returned something that was not a recipe. Try the photo again.');
    }
    return {
      recipe,
      costUsd,
      remainingThisWeekUsd: Math.max(0, config.perUserWeeklyUsd - userSpent - costUsd),
    };
  },
);

async function loadConfig(): Promise<FreeScanConfig> {
  const snap = await db.doc('config/freeScans').get();
  const c = snap.data() as Partial<FreeScanConfig> | undefined;
  if (
    !c?.enabled ||
    typeof c.perUserWeeklyUsd !== 'number' ||
    typeof c.monthlyTotalUsd !== 'number' ||
    !c.model ||
    typeof c.inputPricePerMTok !== 'number' ||
    typeof c.outputPricePerMTok !== 'number'
  ) {
    throw new HttpsError('failed-precondition', 'Free scans are not available right now. You can add your own Gemini key in Settings.', {
      reason: 'disabled',
    });
  }
  return c as FreeScanConfig;
}

/** ISO 8601 week id such as "2026-W48". Weeks start on Monday (UTC). */
export function isoWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Monday 1 ... Sunday 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of this week decides the year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function nextMondayUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 8 - day);
  return d;
}

function validate(data: ScanRequest | undefined): ScanRequest['images'] {
  const images = data?.images;
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) {
    throw new HttpsError('invalid-argument', `Send 1 to ${MAX_IMAGES} photos.`);
  }
  for (const img of images) {
    if (!ALLOWED_TYPES.has(img?.mimeType) || typeof img.base64 !== 'string') {
      throw new HttpsError('invalid-argument', 'Photos must be JPEG, PNG or WebP.');
    }
    if ((img.base64.length * 3) / 4 > MAX_IMAGE_BYTES) {
      throw new HttpsError('invalid-argument', 'A photo is too large. Shrink it before sending.');
    }
  }
  return images;
}
