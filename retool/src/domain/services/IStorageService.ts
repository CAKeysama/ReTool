import { FileAttachment, CategoriaAnexo } from '../entities/fileAttachment';

export interface IStorageService {
  uploadFile(
    baseStoragePath: string,
    file: File,
    categoria: CategoriaAnexo,
    onProgress?: (progress: number) => void
  ): Promise<FileAttachment>;

  deleteFile(storagePath: string): Promise<void>;

  deleteFolder(folderPath: string): Promise<void>;
}
