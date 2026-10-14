import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, map } from 'rxjs';
import { BatchItem, DataStore } from './data-store';

const STORAGE_KEY = 'asset-manager.demo-db.v1';
type Db = Record<string, Record<string, object>>;

/** Browser-only store used for demo mode (no Firebase project required). */
@Injectable({ providedIn: 'root' })
export class LocalDataStore implements DataStore {
  private db: Db = this.load();
  private readonly version$ = new BehaviorSubject(0);

  watchCollection<T>(collectionPath: string): Observable<T[]> {
    return this.version$.pipe(
      map(() => this.db[collectionPath]),
      distinctUntilChanged(),
      map((items) => Object.entries(items ?? {}).map(([id, data]) => ({ ...data, id }) as T)),
    );
  }

  watchDoc<T>(docPath: string): Observable<T | null> {
    const [col, id] = this.split(docPath);
    return this.version$.pipe(
      map(() => this.db[col]?.[id]),
      distinctUntilChanged(),
      map((data) => (data ? ({ ...data, id } as T) : null)),
    );
  }

  async add(collectionPath: string, data: object): Promise<string> {
    const id = crypto.randomUUID();
    this.write(collectionPath, { [id]: data });
    return id;
  }

  async set(docPath: string, data: object, merge = true): Promise<void> {
    const [col, id] = this.split(docPath);
    const existing = merge ? this.db[col]?.[id] ?? {} : {};
    this.write(col, { [id]: { ...existing, ...data } });
  }

  async remove(docPath: string): Promise<void> {
    const [col, id] = this.split(docPath);
    const next = { ...(this.db[col] ?? {}) };
    delete next[id];
    this.db = { ...this.db, [col]: next };
    this.commit();
  }

  async setMany(collectionPath: string, items: BatchItem[]): Promise<void> {
    this.write(collectionPath, Object.fromEntries(items.map((i) => [i.id, i.data])));
  }

  async clear(collectionPath: string): Promise<void> {
    this.db = { ...this.db, [collectionPath]: {} };
    this.commit();
  }

  private write(col: string, entries: Record<string, object>): void {
    this.db = { ...this.db, [col]: { ...(this.db[col] ?? {}), ...entries } };
    this.commit();
  }

  private commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    } catch (err) {
      console.warn('Demo storage quota exceeded; data kept in memory only.', err);
    }
    this.version$.next(this.version$.value + 1);
  }

  private split(docPath: string): [string, string] {
    const idx = docPath.lastIndexOf('/');
    return [docPath.slice(0, idx), docPath.slice(idx + 1)];
  }

  private load(): Db {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Db;
    } catch {
      return {};
    }
  }
}
