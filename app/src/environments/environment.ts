// Firebase web config for the RecipeSave7 Firebase project (recipesave-c6973).
// Copy the values from Firebase console > Project settings > Your apps > Web app.
// These values are not secrets: Firebase web config is public by design.
// Access is controlled by Firebase Auth, App Check and security rules.
export const environment = {
  firebase: {
    apiKey: 'AIzaSyA1udDmUe_ukFnmj-FhKn4UGap7vG2gIiU',
    authDomain: 'recipesave-c6973.firebaseapp.com',
    projectId: 'recipesave-c6973',
    storageBucket: 'recipesave-c6973.firebasestorage.app',
    messagingSenderId: '501291919688',
    appId: '1:501291919688:web:09e3d374caa86601c42b7d',
    // Google Analytics is not turned on in the app (see the README); the id is kept for later.
    measurementId: 'G-HETH3C6CKB',
  },
  // Google Cloud OAuth client (Web) used for Google sign-in with Drive access.
  googleOAuthClientId: '',
  // Region of the free-scan Cloud Function.
  functionsRegion: 'us-central1',
};
