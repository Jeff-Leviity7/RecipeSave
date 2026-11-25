import { Injectable, signal } from '@angular/core';
import { DEFAULT_RECIPE_TYPES } from './recipe-types';

export interface Settings {
  /** Drive folder id of the library, chosen with Google's folder picker. */
  libraryFolderId: string;
  libraryFolderName: string;
  recipeTypes: string[];
  defaultLabels: string[];
  /** The user's own Gemini key. Stays on this device and is sent only to Google. */
  geminiApiKey: string;
}

const STORAGE_KEY = 'recipesave.settings';

const DEFAULTS: Settings = {
  libraryFolderId: '',
  libraryFolderName: '',
  recipeTypes: [...DEFAULT_RECIPE_TYPES],
  defaultLabels: [],
  geminiApiKey: '',
};

/** Device-local settings (no server copy, per the plan's no-stored-data rule). */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<Settings>(this.load());

  update(patch: Partial<Settings>): void {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode); settings then last for this visit only.
    }
  }

  private load(): Settings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
