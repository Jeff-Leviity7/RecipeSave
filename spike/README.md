# Milestone 1 spike

Three checks before building the real app, plus one comparison. Each runs on its own.

| Check | Question it answers | Command |
| --- | --- | --- |
| 1. Reader comparison | How many fixes do Gemini Flash and Claude need on real cards, typed and handwritten? What does each cost per card? | `npm run compare` |
| 2. Drive Doc | Can the browser, with only `drive.file` access, create an editable Google Doc with the card photos inside, in a type folder under a picked folder? | `npm run drive` |
| 3. RecipeSage import | Does RecipeSage import our JSON-LD file with the headers, labels, notes and card photo intact? | `npm run jsonld` |
| 4. RecipeSage's own photo import | How does RecipeSage's built-in photo import do on the same cards? | by hand, below |

Setup, once:

```sh
cd spike
npm install          # Node 22 or later
cp .env.example .env # then fill in the two keys
```

Nothing personal is committed: `cards/`, `results/`, `.env`, `drive-doc/config.js` and the import file are in `.gitignore`.

## 1. Reader comparison

**You need:** a Gemini API key (Google AI Studio > Get API key) and an Anthropic API key (console.anthropic.com), both in `.env`; and about 20 card photos, roughly half handwritten. Include some hard ones: faded, stained, cursive, fractions, a card with writing on the back, and one or two cookbook pages.

**Put photos in `spike/cards/`:**

```
cards/
  01-pound-cake.jpg          one photo = one card
  02-chili/                  a folder = one card with several photos, read in name order
    a-front.jpg
    b-back.jpg
  03-joy-p212/               a cookbook recipe over two pages
    1.jpg
    2.jpg
```

Phone photos are fine (JPEG, PNG, WebP or HEIC). Both readers get exactly the same input: each photo turned upright and shrunk to at most 2000 px, with the same prompt and output schema (`shared/recipe-schema.mjs`).

**Run:**

```sh
npm run compare                          # every card, both readers; saved answers are reused
npm run compare -- --only gemini         # one reader
npm run compare -- --card 02-chili --force   # redo one card
npm run report                           # rebuild the report without calling anything
```

**Score:** open `results/report.html`. Each card shows the photo beside both transcriptions. Words a reader marked as unsure are highlighted, and lines that differ between the readers are shaded, which is where to look first. Type the number of fixes each one needs (each wrong, missing or extra word or number counts as one), tick or untick "handwritten" if the guess is wrong, and add a note for anything serious such as a wrong quantity. The summary table at the top updates as you go; Export CSV saves the scores.

**Cost:** at the default prices, 20 cards cost about $0.20 to $0.50 on Gemini Flash and about $1 to $2 on Claude Opus 5.5. The report shows the real cost per card from each reply's token counts; check the prices in `.env` against the pricing pages first.

The Claude call turns on Anthropic's server-side fallback (`fallbacks: "default"`), which re-runs a request on another Claude model if the first one declines it. That should never trigger on recipe cards; remove those two lines in `reader/compare.mjs` if you would rather it fail instead.

**What decides it:** fixes per card on handwritten cards, then cards with zero fixes, then cost. The plan of record uses Gemini Flash; Claude is the benchmark. If Flash needs clearly more fixes on handwriting, the options are a Gemini Pro model for handwritten cards only, or letting users pick.

## 2. Drive Doc

**You need:** a Google Cloud project (the Firebase project works) with the **Google Drive API**, **Google Docs API** and **Google Picker API** enabled, and:

1. An OAuth consent screen (External, Testing) with yourself as a test user and the scope `.../auth/drive.file`.
2. An OAuth client ID of type Web application, with `http://localhost:8080` under Authorized JavaScript origins.
3. An API key, restricted to the Google Picker API and the referrer `http://localhost:8080/*`.
4. The project number (IAM & Admin > Settings).

Copy `drive-doc/config.example.js` to `drive-doc/config.js` and fill in those three values.

**Run:** `npm run drive`, open http://localhost:8080, then sign in, pick a test folder in your Drive, choose a recipe (the sample, or any file from `results/`), choose the card photos, and press **Create Doc (method A)**.

The page creates the type folder and `_Originals` under the picked folder if needed, saves the full-size photos to `_Originals`, creates the Doc in the type folder with the labels line in its Drive description, and adds a Drive shortcut in each extra type folder. The log then says how many photos made it into the Doc, which it checks with the Docs API.

- **Method A** uploads HTML with the photos embedded and lets Drive convert it to a Doc. One request, no sharing. This is the one we want.
- **Method B** is the fallback if A drops the photos: it creates the Doc, then inserts each photo with the Docs API from a copy that is shared by link for a few seconds and then deleted.

**Record:** whether A keeps the photos and the formatting (headings, lists, sub-headings), how long it takes, and whether the Doc is comfortable to edit on a phone. Try a shared folder too if you plan to share the library with family.

## 3. RecipeSage import

```sh
npm run jsonld        # the two sample recipes with a placeholder photo
# or real ones from the reader comparison, with their card photos:
npm run jsonld -- --source "Mom's recipe box" results/01-pound-cake.gemini.json results/02-chili.gemini.json
```

This writes `recipesage-import/out/recipesage-import.json`. In RecipeSage, open Settings > Import > JSON-LD, choose the file, and wait for the import job to finish.

**Check in RecipeSage:** both recipes arrive in the main folder; the `[Glaze]` line shows as an ingredient and instruction header; the type, labels and source appear as labels; notes, prep time and yield are filled in; the card photo is attached. A free RecipeSage account keeps only the first photo of each recipe.

The file follows RecipeSage's importer (`packages/util/server/src/general/jsonLD.ts` in its repo): photos must be PNG data URIs or web links, and times must be ISO 8601, so the builder converts photos to PNG and moves times it cannot convert, the cook time and the oven temperature into the notes. The file is an array of recipes, which is what RecipeSage's own JSON-LD export writes. The import handler itself was too deep in the folder tree to read from here, so this run is also the check that it accepts an array.

## 4. RecipeSage's own photo import

For comparison, import three or four of the same card photos with RecipeSage's built-in photo import (Create recipe > from photos), and note how many fixes each needs, whether the card photo is attached to the recipe, and how many credits it used.

## Recording the results

Add the findings to the plan doc's milestone 1 section: the summary table from the report, which Drive method worked, and anything RecipeSage changed or dropped on import.
