import { computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { DEFAULT_PROFILE, UserProfile } from '../models/user.model';
import { AdminWorkspaceService } from './admin-workspace.service';

/** Profile document stored at users/{uid}. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);
  private readonly workspace = inject(AdminWorkspaceService);

  private readonly raw = toSignal(
    toObservable(this.workspace.activeUser).pipe(
      switchMap((user) =>
        user
          ? this.auth.store(user).watchDoc<Partial<UserProfile>>(this.auth.userPath(user)).pipe(catchError(() => of(null)))
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  readonly profile = computed<UserProfile>(() => {
    const user = this.workspace.activeUser();
    return {
      ...DEFAULT_PROFILE,
      displayName: user?.displayName ?? '',
      email: user?.email ?? '',
      ...(this.raw() ?? {}),
    };
  });

  async save(patch: Partial<UserProfile>): Promise<void> {
    const user = this.workspace.activeUser();
    if (!user) throw new Error('You must be signed in.');
    const { ...data } = patch as Record<string, unknown>;
    delete data['id'];
    await this.auth.store(user).set(this.auth.userPath(user), { ...data, updatedAt: Date.now() }, true);
  }
}
