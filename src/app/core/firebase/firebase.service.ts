import { Injectable } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { environment } from '../../../environments/environment';

/** Lazily initialises Firebase SDK instances so demo mode never touches the network. */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly configured = !!environment.firebase.apiKey && !environment.firebase.apiKey.startsWith('YOUR_');

  private _app?: FirebaseApp;
  private _auth?: Auth;
  private _db?: Firestore;
  private _storage?: FirebaseStorage;

  get app(): FirebaseApp {
    return (this._app ??= getApps()[0] ?? initializeApp(environment.firebase));
  }

  get auth(): Auth {
    return (this._auth ??= getAuth(this.app));
  }

  get db(): Firestore {
    return (this._db ??= initializeFirestore(this.app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    }));
  }

  get storage(): FirebaseStorage {
    return (this._storage ??= getStorage(this.app));
  }
}
