import { Component, computed, inject } from '@angular/core';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-settings',
  template: `
    <h1>Settings</h1>

    <section>
      <h2>Library folder</h2>
      <p>
        {{ settings().libraryFolderName || 'Not chosen yet.' }}
        <span class="muted">The Google folder picker arrives in milestone 2.</span>
      </p>
    </section>

    <section>
      <h2>Gemini key</h2>
      <p class="muted">
        Used after your free scans run out. It stays on this device and is sent only to Google.
      </p>
      <label>
        Key
        <input
          type="password"
          autocomplete="off"
          [value]="settings().geminiApiKey"
          (change)="setKey($any($event.target).value)"
        />
      </label>
    </section>

    <section>
      <h2>Recipe types</h2>
      <p class="muted">One Drive folder per type, created as needed.</p>
      <textarea rows="12" [value]="typesText()" (change)="setTypes($any($event.target).value)"></textarea>
    </section>
  `,
  styles: `
    section { margin-block: 1.5rem; }
    label { display: grid; gap: 0.25rem; max-width: 28rem; }
    input, textarea { font: inherit; padding: 0.5rem; width: 100%; max-width: 28rem; box-sizing: border-box; }
    .muted { color: var(--muted); }
  `,
})
export class SettingsPage {
  private readonly store = inject(SettingsService);
  protected readonly settings = this.store.settings;
  protected readonly typesText = computed(() => this.settings().recipeTypes.join('\n'));

  protected setKey(value: string): void {
    this.store.update({ geminiApiKey: value.trim() });
  }

  protected setTypes(value: string): void {
    const types = value
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    this.store.update({ recipeTypes: types });
  }
}
