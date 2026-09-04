export type CategoriaAnexo = 'imagem_peca' | 'imagem_dispositivo' | 'documento_pdf';

export interface FileAttachment {
  id: string;
  originalName: string;
  fileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  downloadURL: string;
  uploadedAt: string;
  categoria: CategoriaAnexo;
}
