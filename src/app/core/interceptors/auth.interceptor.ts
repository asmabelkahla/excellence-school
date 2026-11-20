import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Adds the JWT to every request sent to our API (and only to our API),
 * signs the user out when the API answers 401 on an authenticated call, and
 * sends them to /change-password when the API requires a new password first.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();
  const isApiCall = req.url.startsWith(environment.apiUrl);

  const request = token && isApiCall
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token && isApiCall) {
        auth.logout({ expired: true });
      } else if (
        error instanceof HttpErrorResponse && error.status === 403 && isApiCall &&
        error.error?.code === 'PASSWORD_CHANGE_REQUIRED'
      ) {
        auth.markPasswordChangeRequired();
        void router.navigateByUrl('/change-password');
      }
      return throwError(() => error);
    })
  );
};
