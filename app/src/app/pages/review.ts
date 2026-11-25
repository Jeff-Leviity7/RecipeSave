import { Component } from '@angular/core';
import { Placeholder } from './placeholder';

@Component({
  selector: 'app-review',
  imports: [Placeholder],
  template: `<app-placeholder
    title="Review"
    summary="The photo beside the fields, unsure words highlighted, the type picker and labels. Approve to save the Doc to Drive."
    [milestone]="3"
  />`,
})
export class ReviewPage {}
