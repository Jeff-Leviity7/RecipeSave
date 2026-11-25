import { Component } from '@angular/core';
import { Placeholder } from './placeholder';

@Component({
  selector: 'app-library',
  imports: [Placeholder],
  template: `<app-placeholder
    title="Library"
    summary="Your type folders with counts. Tick folders, pick an export type, and download the file."
    [milestone]="4"
  />`,
})
export class LibraryPage {}
