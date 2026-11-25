import { Component } from '@angular/core';
import { Placeholder } from './placeholder';

@Component({
  selector: 'app-batches',
  imports: [Placeholder],
  template: `<app-placeholder
    title="Batches"
    summary="Start a batch such as &quot;Mom's recipe box&quot; or &quot;Joy of Cooking&quot;. Its name becomes the Source and a label."
    [milestone]="3"
  />`,
})
export class BatchesPage {}
