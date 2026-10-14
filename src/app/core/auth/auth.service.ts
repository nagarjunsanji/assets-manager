import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, User,
} from 'firebase/auth';
import { defer, filter, Observable, of, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppUser } from '../../models/user.model';
import { DataStore } from '../data/data-store';
import { FirestoreDataStore } from '../data/firestore-data-store';
import { LocalDataStore } from '../data/local-data-store';
import { FirebaseService } from '../firebase/firebase.service';

const DEMO_FLAG = 'asset-manager.demo-session';
const DEMO_USER: AppUser = {
  uid: 'demo-user',
  displayName: 'Demo Investor',
  email: 'demo@asset-manager.local',
  photoURL: null,
  provider: 'demo',
  demo: true,
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly fb = inject(FirebaseService);
  private readonly firestoreStore = inject(FirestoreDataStore);
  private readonly localStore = inject(LocalDataStore);

  /** undefined = auth state still resolving */
  private readonly _user = signal<AppUser | null | undefined>(undefined);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly firebaseConfigured = this.fb.configured;
  readonly demoAvailable = environment.enableDemoMode;

  private readonly user$ = toObservable(this._user);

  /** Emits the resolved user (or null) once auth state is known. */
  readonly resolved$: Observable<AppUser | null> = defer(() => {
    const current = this._user();
    return current !== undefined
      ? of(current)
      : this.user$.pipe(filter((u): u is AppUser | null => u !== undefined), take(1));
  });

  constructor() {
    if (this.demoAvailable && localStorage.getItem(DEMO_FLAG) === '1') {
      this._user.set(DEMO_USER);
      return;
    }
    if (!this.fb.configured) {
      this._user.set(null);
      return;
    }
    onAuthStateChanged(this.fb.auth, (u) => {
      if (!this._user()?.demo) this._user.set(u ? this.mapUser(u) : null);
    });
  }

  /** Persistence backend for the active session. */
  store(user: AppUser): DataStore {
    return user.demo ? this.localStore : this.firestoreStore;
  }

  userPath(user: AppUser): string {
    return `users/${user.uid}`;
  }

  signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return this.popup(provider);
  }

  signInWithMicrosoft(): Promise<void> {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({ prompt: 'select_account' });
    return this.popup(provider);
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    this.assertConfigured();
    const cred = await signInWithEmailAndPassword(this.fb.auth, email, password);
    this._user.set(this.mapUser(cred.user));
  }

  async register(name: string, email: string, password: string): Promise<void> {
    this.assertConfigured();
    const cred = await createUserWithEmailAndPassword(this.fb.auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    this._user.set(this.mapUser(cred.user));
  }

  async resetPassword(email: string): Promise<void> {
    this.assertConfigured();
    await sendPasswordResetEmail(this.fb.auth, email);
  }

  startDemo(): void {
    localStorage.setItem(DEMO_FLAG, '1');
    this._user.set(DEMO_USER);
  }

  async signOut(): Promise<void> {
    if (this._user()?.demo) {
      localStorage.removeItem(DEMO_FLAG);
      this._user.set(null);
      return;
    }
    if (this.fb.configured) await signOut(this.fb.auth);
    this._user.set(null);
  }

  private async popup(provider: GoogleAuthProvider | OAuthProvider): Promise<void> {
    this.assertConfigured();
    const cred = await signInWithPopup(this.fb.auth, provider);
    this._user.set(this.mapUser(cred.user));
  }

  private assertConfigured(): void {
    if (!this.fb.configured) {
      throw new Error('Firebase is not configured. Add your project keys in src/environments or use the demo workspace.');
    }
  }

  private mapUser(u: User): AppUser {
    return {
      uid: u.uid,
      displayName: u.displayName || u.email?.split('@')[0] || 'Investor',
      email: u.email ?? '',
      photoURL: u.photoURL,
      provider: u.providerData[0]?.providerId ?? 'password',
      demo: false,
    };
  }
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'No account found for this email.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
    'auth/account-exists-with-different-credential': 'This email is linked to a different sign-in provider.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/configuration-not-found': 'Firebase Authentication is not set up. Enable it in the Firebase console (Authentication → Get started).',
    'auth/operation-not-allowed': 'This sign-in method is disabled. Enable it in Firebase console → Authentication → Sign-in method.',
    'auth/unauthorized-domain': 'This domain is not authorised. Add it in Firebase console → Authentication → Settings → Authorized domains.',
    'auth/popup-blocked': 'The sign-in popup was blocked by the browser. Allow popups and try again.',
  };
  return messages[code] ?? (err instanceof Error ? err.message : 'Authentication failed.');
}
