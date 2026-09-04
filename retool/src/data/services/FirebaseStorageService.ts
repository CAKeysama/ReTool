import { storage } from '../datasources/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { IStorageService } from '../../domain/services/IStorageService';
import { FileAttachment, CategoriaAnexo } from '../../domain/entities/fileAttachment';
import { sanitizeFileName, validateFile } from '../../utils/fileValidators';

export class FirebaseStorageService implements IStorageService {
  async uploadFile(
    baseStoragePath: string,
    file: File,
    categoria: CategoriaAnexo,
    onProgress?: (progress: number) => void
  ): Promise<FileAttachment> {
    const validation = validateFile(file, categoria);
    if (!validation.valid) {
      throw new Error(validation.error || 'Arquivo inválido.');
    }

    const fileId = uuidv4();
    const sanitizedName = sanitizeFileName(file.name);
    const storagePath = `${baseStoragePath}/${categoria}/${fileId}_${sanitizedName}`.replace(/\/+/g, '/');
    const storageRef = ref(storage, storagePath);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0 && onProgress) {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress(progress);
          }
        },
        (error) => {
          console.error(`Erro durante upload no Storage (${storagePath}):`, error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);

            const attachment: FileAttachment = {
              id: fileId,
              originalName: file.name,
              fileName: `${fileId}_${sanitizedName}`,
              contentType: file.type,
              size: file.size,
              storagePath,
              downloadURL,
              uploadedAt: new Date().toISOString(),
              categoria,
            };

            resolve(attachment);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  async deleteFile(storagePath: string): Promise<void> {
    if (!storagePath) return;

    try {
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
    } catch (error: any) {
      // Se o arquivo já não existir no Storage, consideramos a exclusão concluída (idempotência)
      if (error?.code === 'storage/object-not-found') {
        return;
      }
      console.warn(`Aviso ao excluir arquivo do Storage (${storagePath}):`, error);
    }
  }

  async deleteFolder(folderPath: string): Promise<void> {
    if (!folderPath) return;

    try {
      const folderRef = ref(storage, folderPath);
      const listResult = await listAll(folderRef);

      // Exclui todos os arquivos da pasta atual
      const deleteFilesPromises = listResult.items.map((item) =>
        deleteObject(item).catch((err) => {
          if (err?.code !== 'storage/object-not-found') {
            console.warn(`Erro ao excluir item do Storage (${item.fullPath}):`, err);
          }
        })
      );

      // Exclui recursivamente quaisquer subpastas
      const deleteSubfoldersPromises = listResult.prefixes.map((subfolder) =>
        this.deleteFolder(subfolder.fullPath)
      );

      await Promise.all([...deleteFilesPromises, ...deleteSubfoldersPromises]);
    } catch (error: any) {
      if (error?.code === 'storage/object-not-found') {
        return;
      }
      console.warn(`Aviso ao excluir pasta do Storage (${folderPath}):`, error);
    }
  }
}

export const storageService = new FirebaseStorageService();
