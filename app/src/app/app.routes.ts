import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'capture' },
  { path: 'batches', title: 'Batches', loadComponent: () => import('./pages/batches').then((m) => m.BatchesPage) },
  { path: 'capture', title: 'Capture', loadComponent: () => import('./pages/capture').then((m) => m.CapturePage) },
  { path: 'review', title: 'Review', loadComponent: () => import('./pages/review').then((m) => m.ReviewPage) },
  { path: 'library', title: 'Library', loadComponent: () => import('./pages/library').then((m) => m.LibraryPage) },
  { path: 'settings', title: 'Settings', loadComponent: () => import('./pages/settings').then((m) => m.SettingsPage) },
  { path: '**', redirectTo: 'capture' },
];
