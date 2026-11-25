// Builds results/report.html: each card's photos beside every reader's transcription, with boxes to
// record how many fixes each one needs. Scores are kept in the browser and exported as CSV.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function buildReport({ cards, cardsDir, resultsDir, readers }) {
  const rows = [];
  for (const card of cards) {
    const results = {};
    for (const r of readers) {
      const file = path.join(resultsDir, `${card.id}.${r}.json`);
      if (existsSync(file)) results[r] = JSON.parse(await readFile(file, 'utf8'));
    }
    rows.push({ card, results });
  }

  const relCards = path.relative(resultsDir, cardsDir).split(path.sep).join('/');
  const html = page(rows, readers, relCards);
  const out = path.join(resultsDir, 'report.html');
  await writeFile(out, html);
  return out;
}

function recipeHtml(result, other) {
  if (!result) return '<p class="muted">Not run yet.</p>';
  if (result.error) return `<p class="error">Failed: ${esc(result.error)}</p>`;
  const r = result.recipe;
  const unsure = new Set((r.uncertainWords || []).map((w) => w.toLowerCase()));
  const otherLines = new Set(
    [...(other?.recipe?.ingredients || []), ...(other?.recipe?.instructions || [])].map((l) => l.trim().toLowerCase()),
  );
  const mark = (text) =>
    esc(text).replace(/[^\s,.;:()]+/g, (w) => (unsure.has(w.toLowerCase()) ? `<mark title="reader unsure">${w}</mark>` : w));
  const line = (l) => {
    const differs = other?.recipe && !otherLines.has(l.trim().toLowerCase());
    return `<li class="${differs ? 'differs' : ''}">${mark(l)}</li>`;
  };
  const field = (label, v) => (v ? `<div><span class="muted">${label}:</span> ${mark(v)}</div>` : '');
  return `
    <h3>${mark(r.title) || '<span class="muted">(no title)</span>'}</h3>
    ${field('Yield', r.yield)}${field('Prep', r.prepTime)}${field('Cook', r.cookTime)}${field('Total', r.totalTime)}${field('Oven', r.ovenTemperature)}
    <h4>Ingredients</h4><ul>${(r.ingredients || []).map(line).join('')}</ul>
    <h4>Instructions</h4><ol>${(r.instructions || []).map(line).join('')}</ol>
    ${field('Notes', r.notes)}${field('Source', r.source)}
    <div class="meta">Types: ${esc((r.suggestedTypes || []).join(', '))} · handwritten: ${r.handwritten ? 'yes' : 'no'}</div>
    <div class="meta">${esc(result.model)} · ${(result.ms / 1000).toFixed(1)} s · ${result.usage.input}/${result.usage.output} tokens · $${result.costUsd.toFixed(4)}</div>`;
}

function page(rows, readers, relCards) {
  const data = rows.map(({ card, results }) => ({
    id: card.id,
    handwritten: Object.values(results).some((r) => r?.recipe?.handwritten),
    readers: Object.fromEntries(
      readers.map((r) => [r, results[r] ? { ms: results[r].ms ?? 0, cost: results[r].costUsd ?? 0, failed: !!results[r].error } : null]),
    ),
  }));

  const cardsHtml = rows
    .map(({ card, results }) => {
      const photos = card.files
        .map((f) => `<a href="${esc(relCards + '/' + f)}" target="_blank"><img src="${esc(relCards + '/' + f)}" alt="${esc(f)}" loading="lazy"></a>`)
        .join('');
      const cols = readers
        .map((r, i) => {
          const other = results[readers[(i + 1) % readers.length]];
          return `<div class="reader">
            <div class="reader-head"><strong>${esc(r)}</strong>
              <label>Fixes needed <input type="number" min="0" data-card="${esc(card.id)}" data-reader="${esc(r)}" class="fixes"></label>
            </div>
            ${recipeHtml(results[r], other)}
          </div>`;
        })
        .join('');
      return `<section class="card" id="${esc(card.id)}">
        <h2>${esc(card.id)} <label class="hw"><input type="checkbox" class="hwbox" data-card="${esc(card.id)}"> handwritten</label></h2>
        <div class="grid"><div class="photos">${photos}</div>${cols}</div>
        <label class="notes">Notes <input type="text" class="note" data-card="${esc(card.id)}"></label>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reader comparison</title>
<style>
  :root { --bg:#fffdf8; --fg:#23201c; --muted:#6b645b; --line:#e6e0d6; --mark:#ffe58a; --diff:#fdeee7; --err:#a1260d; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1c1a17; --fg:#f1ece4; --muted:#a89f93; --line:#38342e; --mark:#6b5a12; --diff:#3a2a22; --err:#ff8c73; } }
  body { margin:0; padding:16px; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, sans-serif; }
  h1 { margin-top:0; } .muted { color:var(--muted); } .error { color:var(--err); }
  table { border-collapse:collapse; margin-block:8px 24px; } td, th { border:1px solid var(--line); padding:4px 10px; text-align:right; } th:first-child, td:first-child { text-align:left; }
  .card { border-top:2px solid var(--line); padding-block:12px; }
  .grid { display:grid; grid-template-columns: minmax(200px, 1fr) repeat(${readers.length}, minmax(240px, 1fr)); gap:16px; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .photos img { width:100%; border:1px solid var(--line); margin-bottom:8px; }
  .reader-head { display:flex; justify-content:space-between; gap:8px; align-items:center; border-bottom:1px solid var(--line); padding-bottom:4px; }
  .fixes { width:4em; font:inherit; }
  mark { background:var(--mark); color:inherit; } li.differs { background:var(--diff); }
  .meta { color:var(--muted); font-size:13px; margin-top:6px; }
  .notes { display:block; margin-top:8px; } .notes input { width:100%; font:inherit; box-sizing:border-box; }
  .hw { font-size:14px; font-weight:normal; margin-left:12px; }
  button { font:inherit; padding:6px 12px; }
</style></head><body>
<h1>Reader comparison</h1>
<p class="muted">For each card, count the edits each transcription needs to match the card: every wrong, missing or extra word or number is one fix. A wrong quantity counts the same as a typo, so note it below the card. <mark>Highlighted</mark> words are ones the reader said it was unsure of; <span style="background:var(--diff)">shaded</span> lines differ between the readers. Your scores stay in this browser; Export CSV saves them.</p>
<div id="summary"></div>
<p><button id="export">Export CSV</button></p>
${cardsHtml}
<script>
const DATA = ${JSON.stringify(data)};
const READERS = ${JSON.stringify(readers)};
const KEY = 'recipesave-spike-scores';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };

for (const el of document.querySelectorAll('.fixes')) {
  const k = el.dataset.card + '|' + el.dataset.reader;
  if (saved[k] != null) el.value = saved[k];
  el.addEventListener('input', () => { saved[k] = el.value === '' ? null : Number(el.value); save(); summarize(); });
}
for (const el of document.querySelectorAll('.hwbox')) {
  const k = el.dataset.card + '|hw';
  const card = DATA.find((c) => c.id === el.dataset.card);
  el.checked = saved[k] ?? card.handwritten;
  el.addEventListener('change', () => { saved[k] = el.checked; save(); summarize(); });
}
for (const el of document.querySelectorAll('.note')) {
  const k = el.dataset.card + '|note';
  el.value = saved[k] ?? '';
  el.addEventListener('input', () => { saved[k] = el.value; save(); });
}

const isHw = (c) => saved[c.id + '|hw'] ?? c.handwritten;

function summarize() {
  const groups = [['All cards', () => true], ['Handwritten', isHw], ['Typed', (c) => !isHw(c)]];
  let html = '<table><tr><th>Reader</th><th>Group</th><th>Cards</th><th>Scored</th><th>Total fixes</th><th>Fixes per card</th><th>Cards with 0 fixes</th><th>Failures</th><th>Avg seconds</th><th>Cost per card</th></tr>';
  for (const r of READERS) {
    for (const [label, pick] of groups) {
      const cards = DATA.filter(pick).filter((c) => c.readers[r]);
      const scored = cards.map((c) => saved[c.id + '|' + r]).filter((v) => v != null);
      const total = scored.reduce((a, b) => a + b, 0);
      const ok = cards.filter((c) => !c.readers[r].failed);
      const avg = (f) => (ok.length ? ok.reduce((a, c) => a + f(c.readers[r]), 0) / ok.length : 0);
      html += '<tr><td>' + r + '</td><td>' + label + '</td><td>' + cards.length + '</td><td>' + scored.length + '</td><td>' + total +
        '</td><td>' + (scored.length ? (total / scored.length).toFixed(1) : '') + '</td><td>' + scored.filter((v) => v === 0).length +
        '</td><td>' + (cards.length - ok.length) + '</td><td>' + (avg((x) => x.ms) / 1000).toFixed(1) + '</td><td>$' + avg((x) => x.cost).toFixed(4) + '</td></tr>';
    }
  }
  document.getElementById('summary').innerHTML = html + '</table>';
}
summarize();

document.getElementById('export').addEventListener('click', () => {
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const lines = [['card', 'handwritten', ...READERS.flatMap((r) => [r + '_fixes', r + '_seconds', r + '_cost_usd', r + '_failed']), 'notes'].join(',')];
  for (const c of DATA) {
    lines.push([q(c.id), isHw(c), ...READERS.flatMap((r) => {
      const x = c.readers[r];
      return [saved[c.id + '|' + r] ?? '', x ? (x.ms / 1000).toFixed(1) : '', x ? x.cost.toFixed(5) : '', x ? x.failed : ''];
    }), q(saved[c.id + '|note'])].join(','));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\\n')], { type: 'text/csv' }));
  a.download = 'reader-scores.csv';
  a.click();
});
</script></body></html>`;
}
