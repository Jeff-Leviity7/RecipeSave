# RecipeSave

App to save recipes from cards &amp; books.

RecipeSave is a free, open-source web app, mainly for phones, that scans recipe cards and cookbook pages, has Gemini read them, and files each recipe as an editable Google Doc in your own Google Drive, in a folder for its recipe type. Any of those folders can be exported as a RecipeSage import file or as schema.org recipe JSON.

It stores no recipes on its own servers. Every user gets some free scanning each week, paid by the host up to a monthly cap; beyond that, scans use the user's own Gemini key.

## Status

Milestone 1: the spike and an app skeleton. Nothing scans in the app yet.

## Layout

| Folder | What it is |
| --- | --- |
| `spike/` | Milestone 1 experiments: Gemini vs Claude on real cards, creating a Doc in Drive from the browser, and a RecipeSage import file. See [spike/README.md](spike/README.md). |
| `app/` | The Angular PWA (installable web app) that Firebase Hosting serves. |
| `functions/` | The one Cloud Function, `freeScan`: reads a recipe on the host's Gemini key, up to a weekly dollar limit per user and a monthly total for everyone. First draft. |
| `firebase.json`, `.firebaserc`, `firestore.rules` | Firebase Hosting, Functions and Firestore settings. Firestore holds only the free-scan config and spend totals; clients cannot read or write it. |

## Running the app

```sh
cd app
npm install
npm start            # http://localhost:4200
npm test
npm run build        # output in app/dist/recipesave/browser
```

The service worker (offline use and "Add to Home Screen") is on only in production builds.

## Firebase setup

1. Create a Firebase project and upgrade it to the Blaze plan (Cloud Functions need it). Set a budget alert in Google Cloud Billing.
2. Put the project id in `.firebaserc`, and the web app config in `app/src/environments/environment.ts`.
3. `npm install -g firebase-tools`, then `firebase login`.
4. Store the host's Gemini key as a secret: `firebase functions:secrets:set GEMINI_API_KEY`.
5. Turn on App Check (reCAPTCHA Enterprise) for the web app, and Google sign-in under Authentication.
6. Create the Firestore document `config/freeScans` in the console:

   | Field | Type | Example |
   | --- | --- | --- |
   | `enabled` | boolean | `true` |
   | `perUserWeeklyUsd` | number | `10` |
   | `monthlyTotalUsd` | number | `200` |
   | `model` | string | `gemini-3.5-flash` |
   | `inputPricePerMTok` | number | `1.5` |
   | `outputPricePerMTok` | number | `9` |

   Each user can spend up to `perUserWeeklyUsd` of free scans per week (ISO weeks, starting Monday 00:00 UTC), and all users together up to `monthlyTotalUsd` per calendar month. The values shown are the starting limits.
7. `firebase deploy`.

## License

GPL-3.0. See [LICENSE](LICENSE).
