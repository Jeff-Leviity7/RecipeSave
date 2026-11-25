// Turns a RecipeSave recipe (the reader schema) into a schema.org Recipe that RecipeSage imports.
// Field handling follows RecipeSage's importer (packages/util/server/src/general/jsonLD.ts):
// - recipeIngredient / recipeInstructions: strings; "[Header]" lines become section headers.
// - recipeCategory: becomes RecipeSage labels.
// - comment named "Author Notes": becomes the notes field.
// - prepTime / totalTime: read as ISO 8601 durations, so free text is converted or moved to notes.
// - image: only http(s) URLs or data:image/png;base64 are accepted, so photos are embedded as PNG.

/** Converts "1 hr 15 min", "45 minutes", "2 hours" to ISO 8601 (PT1H15M). Returns '' if unsure. */
export function toIsoDuration(text) {
  if (!text) return '';
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/g;
  let hours = 0;
  let minutes = 0;
  let matched = '';
  for (const m of t.matchAll(re)) {
    const n = Number(m[1]);
    if (m[2].startsWith('h')) hours += n;
    else minutes += n;
    matched += m[0];
  }
  // Only trust it if the numbers and units were essentially the whole string.
  const leftover = t.replace(re, '').replace(/\b(and|about|approx\.?)\b|[,.]/g, '').trim();
  if (!matched || leftover) return '';
  const total = Math.round(hours * 60 + minutes);
  const h = Math.floor(total / 60);
  const min = total % 60;
  return `PT${h ? `${h}H` : ''}${min || !h ? `${min}M` : ''}`;
}

/**
 * @param recipe   object matching RECIPE_SCHEMA
 * @param options  { types: string[], labels: string[], source: string, pngDataUris: string[] }
 */
export function recipeToJsonLd(recipe, { types = [], labels = [], source = '', pngDataUris = [] } = {}) {
  const extraNotes = [];
  const prep = toIsoDuration(recipe.prepTime);
  const total = toIsoDuration(recipe.totalTime);
  if (recipe.prepTime && !prep) extraNotes.push(`Prep time: ${recipe.prepTime}`);
  if (recipe.totalTime && !total) extraNotes.push(`Total time: ${recipe.totalTime}`);
  if (recipe.cookTime) extraNotes.push(`Cook time: ${recipe.cookTime}`);
  if (recipe.ovenTemperature) extraNotes.push(`Oven: ${recipe.ovenTemperature}`);
  const notes = [recipe.notes, ...extraNotes].filter(Boolean).join('\n');

  const categories = [...new Set([...types, ...labels].map((s) => s.trim()).filter(Boolean))];

  return {
    '@context': 'http://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    recipeYield: recipe.yield || undefined,
    prepTime: prep || undefined,
    totalTime: total || undefined,
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.instructions.map((text) => ({ '@type': 'HowToStep', text })),
    recipeCategory: categories,
    creditText: source || recipe.source || undefined,
    comment: notes ? [{ '@type': 'Comment', name: 'Author Notes', text: notes }] : undefined,
    image: pngDataUris,
  };
}
