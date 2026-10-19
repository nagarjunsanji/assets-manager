import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { ALLOWED_EMAIL, AuthService } from '../core/auth/auth.service';
import { AppUser } from '../models/user.model';
import { ToastService } from './toast.service';

export interface AccessRequest {
  id: string;
  email: string;
  displayName: string;
  approved: boolean;
  requestedAt: number;
}

@Injectable({ providedIn: 'root' })
export class AccessApprovalService {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly _error = signal<string | null>(null);
  private readonly _requests = toSignal(
    toObservable(this.auth.user).pipe(
      switchMap((user) => {
        if (!user || !this.isSuperAdmin(user)) {
          this._error.set(null);
          return of([] as AccessRequest[]);
        }
        return this.auth.store(user).watchCollection<AccessRequest>('accessRequests').pipe(
          tap(() => this._error.set(null)),
          catchError((err: unknown) => {
            console.error('Failed to load access requests.', err);
            const code = this.errorCode(err);
            this._error.set(code === 'permission-denied'
              ? 'Firestore denied access to the approval list. Deploy the latest firestore.rules and confirm you are signed in as the super-admin account.'
              : `Could not load access requests${code ? ` (${code})` : ''}. Check your connection and try again.`);
            return of([] as AccessRequest[]);
          }),
        );
      }),
    ),
    { initialValue: [] as AccessRequest[] },
  );

  readonly pendingRequests = computed(() =>
    this._requests().filter((request) => request.approved !== true)
      .sort((a, b) => a.requestedAt - b.requestedAt),
  );
  readonly approvedUsers = computed(() =>
    this._requests().filter((request) => request.approved === true)
      .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email)),
  );
  readonly error = this._error.asReadonly();
  readonly approvingUid = signal<string | null>(null);

  async approve(request: AccessRequest): Promise<void> {
    const user = this.auth.user();
    if (!user || !this.isSuperAdmin(user)) {
      throw new Error('Only the super admin can approve access requests.');
    }
    if (this.approvingUid()) return;

    this.approvingUid.set(request.id);
    try {
      await this.auth.store(user).set(`accessRequests/${request.id}`, {
        approved: true,
        approvedAt: Date.now(),
        approvedBy: user.uid,
      }, true);
      this.toast.success(`Access approved for ${request.email}`);
    } catch (err) {
      console.error('Failed to approve access request.', err);
      this.toast.error(err instanceof Error ? err.message : 'Could not approve access request');
      throw err;
    } finally {
      this.approvingUid.set(null);
    }
  }

  private isSuperAdmin(user: AppUser): boolean {
    return user.email.toLowerCase() === ALLOWED_EMAIL;
  }

  private errorCode(err: unknown): string | undefined {
    return typeof err === 'object' && err !== null && 'code' in err
      ? String(err.code)
      : undefined;
  }
}
