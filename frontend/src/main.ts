import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// The I1 single-component shell (login, password change, admin/organizer views) is now split into routed pages:
// features/auth (login, change-password), features/admin, features/events; layout in core/layout.
bootstrapApplication(AppComponent, appConfig).catch(console.error);
