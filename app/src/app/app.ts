import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly tabs = [
    { path: '/batches', label: 'Batches' },
    { path: '/capture', label: 'Capture' },
    { path: '/review', label: 'Review' },
    { path: '/library', label: 'Library' },
    { path: '/settings', label: 'Settings' },
  ];
}
