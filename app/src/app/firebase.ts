import { Injectable } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

/** Lazily creates the Firebase app once the web config has been filled in. */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private app?: FirebaseApp;

  get configured(): boolean {
    return !!environment.firebase.projectId;
  }

  get firebaseApp(): FirebaseApp {
    if (!this.configured) {
      throw new Error('Fill in src/environments/environment.ts with your Firebase web config.');
    }
    this.app ??= getApps()[0] ?? initializeApp(environment.firebase);
    return this.app;
  }
}
