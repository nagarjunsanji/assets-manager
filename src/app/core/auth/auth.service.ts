import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { getIdTokenResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { defer, filter, Observable, of, take } from 'rxjs';
import { AppUser } from '../../models/user.model';
import { FirestoreDataStore } from '../data/firestore-data-store';
import { FirebaseService } from '../firebase/firebase.service';

export const ALLOWED_EMAIL = 'nagarjun.sanji@gmail.com';

export type SignInResult = 'approved' | 'pending';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly fb = inject(FirebaseService);
  private readonly firestoreStore = inject(FirestoreDataStore);

  /** undefined = auth state still resolving */
  private readonly _user = signal<AppUser | null | undefined>(undefined);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isSuperAdmin = computed(
    () => this._user()?.email.toLowerCase() === ALLOWED_EMAIL,
  );
  readonly firebaseConfigured = this.fb.configured;
  private googleSignInInProgress = false;

  private readonly user$ = toObservable(this._user);

  /** Emits the resolved user (or null) once auth state is known. */
  readonly resolved$: Observable<AppUser | null> = defer(() => {
    const current = this._user();
    return current !== undefined
      ? of(current)
      : this.user$.pipe(filter((u): u is AppUser | null => u !== undefined), take(1));
  });

  constructor() {
    if (!this.fb.configured) {
      this._user.set(null);
      return;
    }
    onAuthStateChanged(this.fb.auth, (user) => {
      if (this.googleSignInInProgress) return;
      void this.updateAuthState(user).catch((err: unknown) => {
        console.error('Failed to validate the Firebase account.', err);
        this._user.set(null);
      });
    });
  }

  /** Persistence backend for the active session. */
  store(_user: AppUser): FirestoreDataStore {
    return this.firestoreStore;
  }

  userPath(user: AppUser): string {
    return `users/${user.uid}`;
  }

  signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return this.popup(provider);
  }

  async checkAccess(user: User): Promise<SignInResult> {
    if (!(await this.isGoogleAccount(user))) {
      throw new Error('Please sign in using a verified Google account.');
    }
    if (this.isAdmin(user)) return 'approved';

    try {
      const requestRef = doc(this.fb.db, 'accessRequests', user.uid);
      const request = await getDocFromServer(requestRef);
      if (!request.exists()) {
        await setDoc(requestRef, {
          email: user.email,
          displayName: user.displayName ?? '',
          approved: false,
          requestedAt: Date.now(),
        });
        return 'pending';
      }
      return request.data()['approved'] === true ? 'approved' : 'pending';
    } catch (err) {
      if (this.errorCode(err) !== 'permission-denied') throw err;
      console.warn('Firestore denied the access request; treating this Google account as pending approval.', err);
      return 'pending';
    }
  }

  async signOut(): Promise<void> {
    if (this.fb.configured) await signOut(this.fb.auth);
    this._user.set(null);
  }

  private async popup(provider: GoogleAuthProvider): Promise<void> {
    this.assertConfigured();
    this.googleSignInInProgress = true;
    try {
      const cred = await signInWithPopup(this.fb.auth, provider);
      const access = await this.checkAccess(cred.user);
      if (access === 'pending') {
        throw new Error('Your access request is pending approval. Try again after the account owner approves it.');
      }
      this._user.set(this.mapUser(cred.user));
    } catch (err) {
      this._user.set(null);
      if (this.fb.auth.currentUser) await signOut(this.fb.auth);
      throw err;
    } finally {
      this.googleSignInInProgress = false;
    }
  }

  private assertConfigured(): void {
    if (!this.fb.configured) {
      throw new Error('Firebase is not configured. Add your project keys in src/environments.');
    }
  }

  private async updateAuthState(user: User | null): Promise<void> {
    if (!user) {
      this._user.set(null);
      return;
    }
    if ((await this.checkAccess(user)) === 'pending') {
      this._user.set(null);
      if (this.fb.auth.currentUser === user) await signOut(this.fb.auth);
      return;
    }
    if (this.fb.auth.currentUser === user) this._user.set(this.mapUser(user));
  }

  private async isGoogleAccount(user: User): Promise<boolean> {
    const token = await getIdTokenResult(user);
    return !!user.email && user.emailVerified && token.signInProvider === 'google.com';
  }

  private isAdmin(user: User): boolean {
    return user.email?.toLowerCase() === ALLOWED_EMAIL;
  }

  private errorCode(err: unknown): string | undefined {
    return typeof err === 'object' && err !== null && 'code' in err
      ? String(err.code)
      : undefined;
  }

  private mapUser(u: User): AppUser {
    return {
      uid: u.uid,
      displayName: u.displayName || u.email?.split('@')[0] || 'Investor',
      email: u.email ?? '',
      photoURL: u.photoURL,
      provider: u.providerData[0]?.providerId ?? 'password',
    };
  }
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Sign-in popup was closed before completing.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/configuration-not-found': 'Firebase Authentication is not set up. Enable it in the Firebase console (Authentication → Get started).',
    'auth/operation-not-allowed': 'Google sign-in is disabled. Enable Google in Firebase console → Authentication → Sign-in method.',
    'auth/unauthorized-domain': 'This domain is not authorised. Add it in Firebase console → Authentication → Settings → Authorized domains.',
    'auth/popup-blocked': 'The sign-in popup was blocked by the browser. Allow popups and try again.',
  };
  return messages[code] ?? (err instanceof Error ? err.message : 'Authentication failed.');
}
