import { computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { DEFAULT_PROFILE, UserProfile } from '../models/user.model';

/** Profile document stored at users/{uid}. */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);

  private readonly raw = toSignal(
    toObservable(this.auth.user).pipe(
      switchMap((user) =>
        user
          ? this.auth.store(user).watchDoc<Partial<UserProfile>>(this.auth.userPath(user)).pipe(catchError(() => of(null)))
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  readonly profile = computed<UserProfile>(() => {
    const user = this.auth.user();
    return {
      ...DEFAULT_PROFILE,
      displayName: user?.displayName ?? '',
      email: user?.email ?? '',
      ...(this.raw() ?? {}),
    };
  });

  async save(patch: Partial<UserProfile>): Promise<void> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in.');
    const { ...data } = patch as Record<string, unknown>;
    delete data['id'];
    await this.auth.store(user).set(this.auth.userPath(user), { ...data, updatedAt: Date.now() }, true);
  }
}
