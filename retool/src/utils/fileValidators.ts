import { CategoriaAnexo } from '../domain/entities/fileAttachment';

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFile(file: File, categoria: CategoriaAnexo): ValidationResult {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado.' };
  }

  const isImageCategory = categoria === 'imagem_peca' || categoria === 'imagem_dispositivo';

  if (isImageCategory) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Formato de imagem inválido (${file.type || 'desconhecido'}). Formatos suportados: JPG, PNG e WEBP.`
      };
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return {
        valid: false,
        error: `O tamanho da imagem (${formatFileSize(file.size)}) excede o limite máximo permitido de ${formatFileSize(MAX_IMAGE_SIZE_BYTES)}.`
      };
    }
  } else if (categoria === 'documento_pdf') {
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Formato de documento inválido. Apenas documentos no formato PDF são aceitos.`
      };
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return {
        valid: false,
        error: `O tamanho do documento (${formatFileSize(file.size)}) excede o limite máximo de ${formatFileSize(MAX_DOCUMENT_SIZE_BYTES)}.`
      };
    }
  }

  return { valid: true };
}

export function sanitizeFileName(originalName: string): string {
  // Remove caracteres especiais, espaços e mantém apenas letras, números, hífens, sublinhados e pontos
  const cleanName = originalName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '_') // substitui espaços por underscore
    .replace(/[^a-zA-Z0-9._-]/g, ''); // remove caracteres proibidos

  return cleanName || 'arquivo';
}

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const valor = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${valor} ${sizes[i]}`;
}
