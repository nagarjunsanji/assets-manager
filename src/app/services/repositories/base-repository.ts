import { computed, inject, Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CollectionName, Entity, NewEntity } from '../../models/entity.model';
import { AppUser } from '../../models/user.model';
import { ToastService } from '../toast.service';

/**
 * Generic signal-based repository over users/{uid}/{collection}.
 * Reads and writes the signed-in user's Firestore collection.
 */
export abstract class BaseRepository<T extends Entity> {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();
  readonly items: Signal<T[]>;
  readonly count = computed(() => this.items().length);

  protected constructor(readonly collectionName: CollectionName) {
    this.items = toSignal(
      toObservable(this.auth.user).pipe(
        tap(() => this._loaded.set(false)),
        switchMap((user) => {
          if (!user) return of([] as T[]);
          return this.auth
            .store(user)
            .watchCollection<T>(this.path(user))
            .pipe(
              catchError((err) => {
                console.error(`[${collectionName}] subscription failed`, err);
                if (err?.code === 'permission-denied') {
                  this.toast.error('Firestore denied access. Deploy firestore.rules (npm run deploy:rules).');
                }
                return of([] as T[]);
              }),
            );
        }),
        tap(() => this._loaded.set(true)),
      ),
      { initialValue: [] as T[] },
    );
  }

  getById(id: string | undefined): T | undefined {
    return id ? this.items().find((i) => i.id === id) : undefined;
  }

  async create(data: NewEntity<T> | Partial<T>): Promise<string> {
    const user = this.requireUser();
    const now = Date.now();
    return this.auth.store(user).add(this.path(user), { ...this.clean(data), createdAt: now, updatedAt: now });
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const user = this.requireUser();
    await this.auth.store(user).set(`${this.path(user)}/${id}`, { ...this.clean(data), updatedAt: Date.now() }, true);
  }

  /** Create or replace a document with a known id. */
  async upsert(id: string, data: Partial<T>): Promise<void> {
    const user = this.requireUser();
    await this.auth.store(user).set(`${this.path(user)}/${id}`, { ...this.clean(data), updatedAt: Date.now() }, false);
  }

  async delete(id: string): Promise<void> {
    const user = this.requireUser();
    await this.auth.store(user).remove(`${this.path(user)}/${id}`);
  }

  async replaceAll(items: T[]): Promise<void> {
    const user = this.requireUser();
    const store = this.auth.store(user);
    const now = Date.now();
    await store.clear(this.path(user));
    await store.setMany(
      this.path(user),
      items.map((item) => ({ id: item.id, data: { ...this.clean(item), createdAt: now, updatedAt: now } })),
    );
  }

  async clear(): Promise<void> {
    const user = this.requireUser();
    await this.auth.store(user).clear(this.path(user));
  }

  protected path(user: AppUser): string {
    return `${this.auth.userPath(user)}/${this.collectionName}`;
  }

  private requireUser(): AppUser {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in.');
    return user;
  }

  private clean(data: object): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k !== 'id' && v !== undefined) out[k] = v;
    }
    return out;
  }
}
