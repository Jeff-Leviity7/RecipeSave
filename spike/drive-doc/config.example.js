// Copy to config.js (which git ignores) and fill in from Google Cloud console for the Firebase project.
// None of these are secrets: they identify the app, and Google limits them to your listed origins.
window.RECIPESAVE_CONFIG = {
  // APIs & Services > Credentials > OAuth 2.0 Client ID (Web application).
  // Authorized JavaScript origins must include http://localhost:8080
  clientId: 'NNNN-xxxx.apps.googleusercontent.com',
  // APIs & Services > Credentials > API key (restrict it to the Google Picker API and http://localhost:8080/*)
  apiKey: 'AIza...',
  // The project number (IAM & Admin > Settings). The folder picker needs it to grant drive.file access.
  appId: '123456789012',
};
