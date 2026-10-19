import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AppUser } from '../models/user.model';
import { AccessApprovalService } from './access-approval.service';
import { AuthService } from '../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class AdminWorkspaceService {
  private readonly auth = inject(AuthService);
  private readonly access = inject(AccessApprovalService);
  private readonly selectedUid = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.auth.user() || !this.auth.isSuperAdmin()) this.selectedUid.set(null);
    });
  }

  readonly selectedUser = computed<AppUser | null>(() => {
    if (!this.auth.isSuperAdmin()) return null;
    const request = this.access.approvedUsers().find((user) => user.id === this.selectedUid());
    return request
      ? {
          uid: request.id,
          displayName: request.displayName || request.email,
          email: request.email,
          provider: 'google.com',
        }
      : null;
  });

  readonly activeUser = computed(() => {
    const signedInUser = this.auth.user();
    return signedInUser ? this.selectedUser() ?? signedInUser : null;
  });

  selectUser(uid: string | null): void {
    if (!this.auth.isSuperAdmin()) {
      throw new Error('Only the super admin can switch user data workspaces.');
    }
    if (uid && !this.access.approvedUsers().some((user) => user.id === uid)) {
      throw new Error('Only approved users can be selected.');
    }
    this.selectedUid.set(uid);
  }
}
