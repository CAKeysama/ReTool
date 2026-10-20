import { FileAttachment, CategoriaAnexo } from '../entities/fileAttachment';

export interface IStorageService {
  uploadFile(
    baseStoragePath: string,
    file: File,
    categoria: CategoriaAnexo,
    onProgress?: (progress: number) => void
  ): Promise<FileAttachment>;

  deleteFile(storagePath: string): Promise<void>;

  /** `manter(caminho)` = true preserva o arquivo (ex.: imagem ainda usada por outro dispositivo). */
  deleteFolder(folderPath: string, manter?: (caminho: string) => Promise<boolean>): Promise<void>;
}
