import { inject, Injectable } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { DocumentEntityType, VaultDocument } from '../models/wealth.models';
import { DocumentRepositoryService } from './repositories/repositories';

export const MAX_UPLOAD_BYTES = 700 * 1024;
const ALLOWED_TYPES = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf)$/;

export interface UploadRequest {
  file: File;
  entityType: DocumentEntityType;
  entityId?: string;
  entityName?: string;
  tags?: string;
}

/** Stores small document files directly in the user's Firestore documents collection. */
@Injectable({ providedIn: 'root' })
export class DocumentVaultService {
  private readonly auth = inject(AuthService);
  private readonly docs = inject(DocumentRepositoryService);

  validate(file: File): string | null {
    if (!ALLOWED_TYPES.test(file.type)) return 'Only images and PDF files are allowed.';
    if (file.size > MAX_UPLOAD_BYTES) return 'File exceeds 700 KB. Firestore documents have a 1 MiB size limit.';
    return null;
  }

  async upload(req: UploadRequest, onProgress?: (pct: number) => void): Promise<void> {
    const user = this.auth.user();
    if (!user) throw new Error('You must be signed in.');
    const error = this.validate(req.file);
    if (error) throw new Error(error);

    const contentData = await this.readAsDataUrl(req.file);
    onProgress?.(100);

    await this.docs.create({
      name: req.file.name,
      entityType: req.entityType,
      entityId: req.entityId,
      entityName: req.entityName,
      contentData,
      contentType: req.file.type,
      size: req.file.size,
      tags: req.tags,
    });
  }

  async remove(doc: VaultDocument): Promise<void> {
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
