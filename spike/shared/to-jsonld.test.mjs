import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeToJsonLd, toIsoDuration } from './to-jsonld.mjs';

test('toIsoDuration converts plain times and gives up on vague ones', () => {
  assert.equal(toIsoDuration('45 minutes'), 'PT45M');
  assert.equal(toIsoDuration('1 hr 15 min'), 'PT1H15M');
  assert.equal(toIsoDuration('2 hours'), 'PT2H');
  assert.equal(toIsoDuration('1.5 hrs'), 'PT1H30M');
  assert.equal(toIsoDuration('about 2 hrs'), 'PT2H');
  assert.equal(toIsoDuration('until golden'), '');
  assert.equal(toIsoDuration('1 1/2 hours'), '');
  assert.equal(toIsoDuration(''), '');
});

test('recipeToJsonLd keeps headers, labels, notes and photos', () => {
  const out = recipeToJsonLd(
    {
      title: 'Cake',
      yield: '1 cake',
      prepTime: '20 min',
      cookTime: '1 hr',
      totalTime: 'overnight',
      ovenTemperature: '350°F',
      ingredients: ['2 eggs', '[Glaze]', '1 cup sugar'],
      instructions: ['Mix.', 'Bake.'],
      notes: 'From Ruth',
      source: 'Ruth',
      suggestedTypes: ['Cakes'],
      uncertainWords: [],
      handwritten: true,
    },
    { types: ['Cakes'], labels: ['Christmas', 'Cakes'], pngDataUris: ['data:image/png;base64,AAAA'] },
  );
  assert.equal(out['@type'], 'Recipe');
  assert.deepEqual(out.recipeIngredient, ['2 eggs', '[Glaze]', '1 cup sugar']);
  assert.deepEqual(out.recipeCategory, ['Cakes', 'Christmas']);
  assert.equal(out.prepTime, 'PT20M');
  assert.equal(out.totalTime, undefined);
  assert.equal(out.creditText, 'Ruth');
  assert.match(out.comment[0].text, /From Ruth\nTotal time: overnight\nCook time: 1 hr\nOven: 350°F/);
  assert.equal(out.comment[0].name, 'Author Notes');
  assert.deepEqual(out.image, ['data:image/png;base64,AAAA']);
});
