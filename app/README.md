# RecipeSave7 app

Angular PWA, generated with Angular CLI 22.3, plus `@angular/pwa` and the Firebase JS SDK.

```sh
npm install
npm start        # dev server at http://localhost:4200
npm test         # unit tests (Vitest)
npm run build    # production build with the service worker, in dist/recipesave/browser
```

## Structure

- `src/app/app.*` is the shell: a header, the page, and a bottom tab bar sized for phones.
- `src/app/pages/` has one file per screen in the plan: Batches, Capture, Review, Library, Settings. All but Settings are placeholders that say which milestone builds them.
- `src/app/settings.service.ts` keeps settings on the device (library folder, recipe types, default labels, the user's own Gemini key).
- `src/app/firebase.ts` starts Firebase once `src/environments/environment.ts` has the web config.
- `src/app/recipe-types.ts` is the starting list of recipe types.

## Logo and icons

The master logo is `src/assets/RecipeSave7_Logo.png` (it is not shipped in the build; the original `RecipeSave_Logo.jpeg` without the 7 can be deleted). `npm run icons` regenerates everything in `public/` from it: the PWA icons (`icons/icon-*.png`, transparent), maskable icons for Android (`icons/maskable-*.png`), `apple-touch-icon.png`, `favicon.ico` and the PNG favicons, `logo-emblem.png`, a web-sized `logo.png`, and the link-preview `og-image.png`. Icons use only the round emblem, since the word "RecipeSave7" can't be read at icon sizes. Run it again whenever the logo changes.
