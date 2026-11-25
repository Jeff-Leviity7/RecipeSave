// Copy of spike/shared/recipe-schema.mjs. Keep the two in step until the app gets a shared package.
// The one recipe shape every reader must return, plus the prompt that asks for it.
// Both Gemini and Claude get exactly this prompt and schema so the comparison is fair.

export const RECIPE_TYPES = [
  'Appetizers', 'Breads', 'Breakfast', 'Cakes', 'Candies', 'Canning', 'Cookies',
  'Drinks', 'Meats', 'Other Desserts', 'Pasta and Grains', 'Pastry', 'Poultry',
  'Preserves', 'Salads', 'Sauces', 'Seafood', 'Sides and Vegetables', 'Soups and Stews',
];

const str = (description: string) => ({ type: 'string', description });
const strList = (description: string) => ({ type: 'array', items: { type: 'string' }, description });

export const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: str('Recipe title as written. Empty string if there is none.'),
    yield: str('Servings or yield as written, e.g. "2 loaves". Empty string if not given.'),
    prepTime: str('Prep or active time as written. Empty string if not given.'),
    cookTime: str('Cooking or baking time as written. Empty string if not given.'),
    totalTime: str('Total time as written. Empty string if not given.'),
    ovenTemperature: str('Oven temperature as written, e.g. "350°F". Empty string if not given.'),
    ingredients: strList(
      'One ingredient per item, exactly as written (keep quantities and units). ' +
        'A sub-heading such as "Frosting" becomes its own item in square brackets: "[Frosting]".',
    ),
    instructions: strList(
      'One step per item, in order, exactly as written. Do not add numbering. ' +
        'A sub-heading becomes its own item in square brackets.',
    ),
    notes: str('Anything else written on the card or page: attribution ("From Aunt Ruth"), tips, dates, margin notes.'),
    source: str('Who the recipe is from, if the card says so. Empty string otherwise.'),
    suggestedTypes: {
      type: 'array',
      items: { type: 'string', enum: RECIPE_TYPES },
      description: 'One or two recipe types from the list, best first.',
    },
    uncertainWords: strList(
      'Words or numbers you could not read with confidence, exactly as you transcribed them, ' +
        'so the review screen can highlight them. Empty list if none.',
    ),
    handwritten: { type: 'boolean', description: 'True if most of the text is handwritten.' },
  },
  required: [
    'title', 'yield', 'prepTime', 'cookTime', 'totalTime', 'ovenTemperature', 'ingredients',
    'instructions', 'notes', 'source', 'suggestedTypes', 'uncertainWords', 'handwritten',
  ],
};

export const RECIPE_PROMPT = `You are transcribing a recipe from photos of a recipe card or cookbook page.
The photos may show the front and back of one card, or one or two pages of one recipe.

Transcribe faithfully:
- Copy wording, spelling, abbreviations and quantities as written. Do not convert units, fix grammar, or modernize.
- Fractions: write them as plain text such as 1/2 or 1 1/2.
- If a word is hard to read, give your best reading and also list it in uncertainWords.
- Leave out nothing that is written on the card, but invent nothing that is not.
- If the card continues on the back, join the text in reading order.

Return only the JSON object that matches the schema.`;
