import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { SelectOption } from '../../models/entity.model';
import { DOCUMENT_ENTITY_TYPES, DocumentEntityType, VaultDocument } from '../../models/wealth.models';
import { DocumentVaultService } from '../../services/document-vault.service';
import { PortfolioService } from '../../services/portfolio.service';
import { DocumentRepositoryService } from '../../services/repositories/repositories';
import { ToastService } from '../../services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/dialogs/confirm-dialog';
import { formatDate } from '../../utilities/format';

const TYPE_ICONS: Record<DocumentEntityType, string> = {
  Property: 'apartment', Agriculture: 'grass', Farm: 'agriculture', Livestock: 'pets', Insurance: 'health_and_safety',
  Lending: 'handshake', Vehicle: 'directions_car', Other: 'description',
};

@Component({
  selector: 'app-documents-page',
  imports: [
    PageHeader, FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatInputModule,
    MatProgressBarModule, MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents.page.html',
  styleUrl: './documents.page.scss',
})
export class DocumentsPage {
  private readonly vault = inject(DocumentVaultService);
  private readonly portfolio = inject(PortfolioService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  protected readonly repo = inject(DocumentRepositoryService);

  protected readonly types = DOCUMENT_ENTITY_TYPES;
  protected readonly icons = TYPE_ICONS;
  protected readonly date = formatDate;

  protected readonly entityType = signal<DocumentEntityType>('Property');
  protected readonly entityId = signal<string>('');
  protected readonly tags = signal('');
  protected readonly filterType = signal<DocumentEntityType | 'All'>('All');
  protected readonly search = signal('');
  protected readonly progress = signal<number | null>(null);
  protected readonly dragging = signal(false);

  protected readonly entityOptions = computed<SelectOption[]>(() => {
    const d = this.portfolio.data();
    switch (this.entityType()) {
      case 'Property': return d.properties.map((x) => ({ value: x.id, label: x.name }));
      case 'Agriculture': return d.agricultureLands.map((x) => ({ value: x.id, label: x.name }));
      case 'Livestock': return d.livestock.map((x) => ({ value: x.id, label: `${x.breed} ${x.animalType}` }));
      case 'Insurance': return d.insurance.map((x) => ({ value: x.id, label: x.policyName }));
      case 'Lending': return d.lending.map((x) => ({ value: x.id, label: x.borrowerName }));
      case 'Vehicle': return d.vehicles.map((x) => ({ value: x.id, label: x.registrationNumber }));
      default: return [];
    }
  });

  protected readonly documents = computed(() => {
    const q = this.search().trim().toLowerCase();
    const t = this.filterType();
    return [...this.repo.items()]
      .filter((d) => t === 'All' || d.entityType === t)
      .filter((d) => !q || `${d.name} ${d.entityName ?? ''} ${d.tags ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  });

  protected readonly counts = computed(() => {
    const map = new Map<string, number>();
    this.repo.items().forEach((d) => map.set(d.entityType, (map.get(d.entityType) ?? 0) + 1));
    return map;
  });

  protected onTypeChange(type: DocumentEntityType): void {
    this.entityType.set(type);
    this.entityId.set('');
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) this.upload(Array.from(files));
  }

  protected onFiles(input: HTMLInputElement): void {
    if (input.files?.length) this.upload(Array.from(input.files));
    input.value = '';
  }

  protected isImage(d: VaultDocument): boolean {
    return d.contentType.startsWith('image/');
  }

  protected openDocument(doc: VaultDocument): void {
    if (!doc.contentData) {
      if (doc.url) window.open(doc.url, '_blank', 'noopener,noreferrer');
      return;
    }

    const url = URL.createObjectURL(this.fileBlob(doc));
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  protected downloadDocument(doc: VaultDocument): void {
    if (!doc.contentData) {
      if (doc.url) {
        const link = document.createElement('a');
        link.href = doc.url;
        link.download = doc.name;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }
      return;
    }

    const url = URL.createObjectURL(this.fileBlob(doc));
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  protected size(bytes: number): string {
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  protected async remove(doc: VaultDocument): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: { title: 'Delete document?', message: `"${doc.name}" will be permanently removed from Firestore.`, confirmText: 'Delete', danger: true },
        width: '420px',
      }).afterClosed(),
    );
    if (!ok) return;
    try {
      await this.vault.remove(doc);
      this.toast.success('Document deleted');
    } catch (err) {
      this.toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  private async upload(files: File[]): Promise<void> {
    const entityName = this.entityOptions().find((o) => o.value === this.entityId())?.label;
    for (const file of files) {
      const error = this.vault.validate(file);
      if (error) {
        this.toast.error(`${file.name}: ${error}`);
        continue;
      }
      this.progress.set(0);
      try {
        await this.vault.upload(
          { file, entityType: this.entityType(), entityId: this.entityId() || undefined, entityName, tags: this.tags() || undefined },
          (p) => this.progress.set(p),
        );
        this.toast.success(`${file.name} saved to Firestore`);
      } catch (err) {
        this.toast.error(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        this.progress.set(null);
      }
    }
  }

  private fileBlob(doc: VaultDocument): Blob {
    const encoded = doc.contentData?.split(',')[1];
    if (!encoded) throw new Error(`The stored file data for "${doc.name}" is invalid.`);
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: doc.contentType });
  }
}
