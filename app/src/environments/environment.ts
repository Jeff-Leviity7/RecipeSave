// Firebase web config for the RecipeSave project.
// Copy the values from Firebase console > Project settings > Your apps > Web app.
// These values are not secrets: Firebase web config is public by design.
// Access is controlled by Firebase Auth, App Check and security rules.
export const environment = {
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
  // Google Cloud OAuth client (Web) used for Google sign-in with Drive access.
  googleOAuthClientId: '',
  // Region of the free-scan Cloud Function.
  functionsRegion: 'us-central1',
};
