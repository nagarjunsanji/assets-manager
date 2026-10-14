import { inject, Injectable } from '@angular/core';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, writeBatch,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { FirebaseService } from '../firebase/firebase.service';
import { BatchItem, DataStore } from './data-store';

const BATCH_LIMIT = 450;

@Injectable({ providedIn: 'root' })
export class FirestoreDataStore implements DataStore {
  private readonly fb = inject(FirebaseService);

  watchCollection<T>(collectionPath: string): Observable<T[]> {
    return new Observable<T[]>((subscriber) =>
      onSnapshot(
        collection(this.fb.db, collectionPath),
        (snap) => subscriber.next(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as T)),
        (err) => subscriber.error(err),
      ),
    );
  }

  watchDoc<T>(docPath: string): Observable<T | null> {
    return new Observable<T | null>((subscriber) =>
      onSnapshot(
        doc(this.fb.db, docPath),
        (snap) => subscriber.next(snap.exists() ? ({ ...snap.data(), id: snap.id } as T) : null),
        (err) => subscriber.error(err),
      ),
    );
  }

  async add(collectionPath: string, data: object): Promise<string> {
    const ref = await addDoc(collection(this.fb.db, collectionPath), data);
    return ref.id;
  }

  set(docPath: string, data: object, merge = true): Promise<void> {
    return setDoc(doc(this.fb.db, docPath), data, { merge });
  }

  remove(docPath: string): Promise<void> {
    return deleteDoc(doc(this.fb.db, docPath));
  }

  async setMany(collectionPath: string, items: BatchItem[]): Promise<void> {
    for (let i = 0; i < items.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.fb.db);
      for (const item of items.slice(i, i + BATCH_LIMIT)) {
        batch.set(doc(this.fb.db, collectionPath, item.id), item.data);
      }
      await batch.commit();
    }
  }

  async clear(collectionPath: string): Promise<void> {
    const snap = await getDocs(collection(this.fb.db, collectionPath));
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.fb.db);
      snap.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
}
