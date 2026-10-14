import { inject, Injectable } from '@angular/core';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { AuthService } from '../core/auth/auth.service';
import { FirebaseService } from '../core/firebase/firebase.service';
import { DocumentEntityType, VaultDocument } from '../models/wealth.models';
import { DocumentRepositoryService } from './repositories/repositories';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const DEMO_MAX_BYTES = 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf)$/;

function storageError(err: { code?: string; message?: string }): Error {
  const messages: Record<string, string> = {
    'storage/unauthorized': 'Upload denied by Storage security rules. Deploy storage.rules.',
    'storage/bucket-not-found': 'Storage bucket not found. Enable Firebase Storage in the console.',
    'storage/project-not-found': 'Storage is not enabled for this project.',
    'storage/quota-exceeded': 'Storage quota exceeded.',
    'storage/unknown': 'Storage is not available. Ensure Firebase Storage is enabled.',
  };
  return new Error(messages[err.code ?? ''] ?? err.message ?? 'Upload failed');
}

export interface UploadRequest {
  file: File;
  entityType: DocumentEntityType;
  entityId?: string;
  entityName?: string;
  tags?: string;
}

/** Firebase Storage integration for the document vault. */
@Injectable({ providedIn: 'root' })
export class DocumentStorageService {
  private readonly fb = inject(FirebaseService);
  private readonly auth = inject(AuthService);
  private readonly docs = inject(DocumentRepositoryService);

  validate(file: File): string | null {
    if (!ALLOWED_TYPES.test(file.type)) return 'Only images and PDF files are allowed.';
    const limit = this.auth.user()?.demo ? DEMO_MAX_BYTES : MAX_UPLOAD_BYTES;
    if (file.size > limit) return `File exceeds ${Math.round(limit / 1024 / 1024)} MB limit.`;
    return null;
  }

  async upload(req: UploadRequest, onProgress?: (pct: number) => void): Promise<void> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in.');
    const error = this.validate(req.file);
    if (error) throw new Error(error);

    const safeName = req.file.name.replace(/[^\w.\-]+/g, '_').slice(-120);
    const storagePath = `users/${user.uid}/documents/${req.entityType}/${Date.now()}_${safeName}`;
    let url: string;

    if (user.demo) {
      url = await this.readAsDataUrl(req.file);
      onProgress?.(100);
    } else {
      const task = uploadBytesResumable(ref(this.fb.storage, storagePath), req.file, { contentType: req.file.type });
      await new Promise<void>((resolve, reject) =>
        task.on('state_changed', (s) => onProgress?.((s.bytesTransferred / s.totalBytes) * 100), (err) => reject(storageError(err)), () => resolve()),
      );
      url = await getDownloadURL(task.snapshot.ref);
    }

    await this.docs.create({
      name: req.file.name,
      entityType: req.entityType,
      entityId: req.entityId,
      entityName: req.entityName,
      storagePath,
      url,
      contentType: req.file.type,
      size: req.file.size,
      tags: req.tags,
    });
  }

  async remove(doc: VaultDocument): Promise<void> {
    if (!this.auth.user()?.demo) {
      await deleteObject(ref(this.fb.storage, doc.storagePath)).catch((err) => {
        if (err?.code !== 'storage/object-not-found') throw err;
      });
    }
    await this.docs.delete(doc.id);
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
