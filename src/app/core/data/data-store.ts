import { Observable } from 'rxjs';

export interface BatchItem {
  id: string;
  data: object;
}

/** Path-based persistence abstraction implemented by Firestore. */
export interface DataStore {
  watchCollection<T>(collectionPath: string): Observable<T[]>;
  watchDoc<T>(docPath: string): Observable<T | null>;
  add(collectionPath: string, data: object): Promise<string>;
  set(docPath: string, data: object, merge?: boolean): Promise<void>;
  remove(docPath: string): Promise<void>;
  setMany(collectionPath: string, items: BatchItem[]): Promise<void>;
  clear(collectionPath: string): Promise<void>;
}
