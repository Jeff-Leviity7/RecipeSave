import { Component } from '@angular/core';
import { Placeholder } from './placeholder';

@Component({
  selector: 'app-capture',
  imports: [Placeholder],
  template: `<app-placeholder
    title="Capture"
    summary="On a phone the camera stays open: card front, back if it has writing, next card. On a computer, drag in photos."
    [milestone]="3"
  />`,
})
export class CapturePage {}
