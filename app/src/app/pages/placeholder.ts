import { Component, input } from '@angular/core';

/** Simple page body used by screens that later milestones fill in. */
@Component({
  selector: 'app-placeholder',
  template: `
    <h1>{{ title() }}</h1>
    <p>{{ summary() }}</p>
    <p class="milestone">Built in milestone {{ milestone() }}.</p>
  `,
  styles: `.milestone { color: var(--muted); font-size: 0.9rem; }`,
})
export class Placeholder {
  readonly title = input.required<string>();
  readonly summary = input.required<string>();
  readonly milestone = input.required<number>();
}
