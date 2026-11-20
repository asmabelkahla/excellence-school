import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { UserRole } from '../models/school.model';
import { AuthService } from '../services/auth.service';

/** Blocks every page that needs a signed-in user and sends visitors to /login. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Restricts a route to the roles listed in `data.roles`.
 * A signed-in user with the wrong role is sent back to their own home page.
 */
export const roleGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const allowed = (route.data?.['roles'] as UserRole[] | undefined) ?? [];
  const role = auth.currentUser()?.role;

  if (!role) {
    return inject(Router).createUrlTree(['/login']);
  }
  if (allowed.length === 0 || allowed.includes(role)) {
    return true;
  }
  return inject(Router).createUrlTree([auth.homeUrlFor(role)]);
};

/** Login / register pages are only for visitors: signed-in users go to their home page. */
export const guestGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const user = auth.currentUser();
  if (!user || !auth.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree([auth.homeUrlFor(user.role)]);
};

/**
 * A user whose password was set by an admin must choose their own before using the app.
 * Applied to every signed-in area except the change-password page itself.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.currentUser()?.must_change_password) {
    return true;
  }
  return inject(Router).createUrlTree(['/change-password']);
};
