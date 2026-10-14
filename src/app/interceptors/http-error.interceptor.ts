import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

/** Surfaces HTTP failures (e.g. market data lookups) as toasts. */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      toast.error(err.status === 0 ? 'Network unavailable. Working offline.' : `Request failed (${err.status}).`);
      return throwError(() => err);
    }),
  );
};
