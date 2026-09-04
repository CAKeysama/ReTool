import { validateFile, sanitizeFileName, formatFileSize, MAX_IMAGE_SIZE_BYTES, MAX_DOCUMENT_SIZE_BYTES } from '../../utils/fileValidators';

describe('fileValidators utility', () => {
  describe('formatFileSize', () => {
    it('deve formatar 0 bytes corretamente', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('deve formatar kilobytes', () => {
      expect(formatFileSize(2048)).toBe('2 KB');
    });

    it('deve formatar megabytes', () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
    });
  });

  describe('sanitizeFileName', () => {
    it('deve remover acentos e substituir espaços por underscores', () => {
      const sanitized = sanitizeFileName('Desenho Técnico Peça #12.pdf');
      expect(sanitized).toBe('Desenho_Tecnico_Peca_12.pdf');
    });

    it('deve retornar arquivo se o nome original estiver vazio após sanitização', () => {
      const sanitized = sanitizeFileName('???');
      expect(sanitized).toBe('arquivo');
    });
  });

  describe('validateFile', () => {
    it('deve rejeitar arquivo nulo ou indefinido', () => {
      const result = validateFile(null as any, 'imagem_peca');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Nenhum arquivo selecionado');
    });

    it('deve aceitar imagem válida (JPEG/PNG/WEBP)', () => {
      const mockFile = new File(['mock content'], 'peca.jpg', { type: 'image/jpeg' });
      const result = validateFile(mockFile, 'imagem_peca');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar tipo de imagem não suportado', () => {
      const mockFile = new File(['mock content'], 'peca.gif', { type: 'image/gif' });
      const result = validateFile(mockFile, 'imagem_peca');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Formato de imagem inválido');
    });

    it('deve rejeitar imagem que excede o limite de tamanho', () => {
      const bigFile = new File(['x'.repeat(100)], 'huge.png', { type: 'image/png' });
      Object.defineProperty(bigFile, 'size', { value: MAX_IMAGE_SIZE_BYTES + 1024 });

      const result = validateFile(bigFile, 'imagem_peca');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('excede o limite máximo permitido');
    });

    it('deve aceitar documento PDF válido', () => {
      const mockPdf = new File(['%PDF-1.4 mock content'], 'manual.pdf', { type: 'application/pdf' });
      const result = validateFile(mockPdf, 'documento_pdf');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar documento que não é PDF', () => {
      const mockDoc = new File(['word content'], 'manual.docx', { type: 'application/msword' });
      const result = validateFile(mockDoc, 'documento_pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Apenas documentos no formato PDF são aceitos');
    });

    it('deve rejeitar PDF que excede limite de tamanho', () => {
      const bigPdf = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
      Object.defineProperty(bigPdf, 'size', { value: MAX_DOCUMENT_SIZE_BYTES + 1024 });

      const result = validateFile(bigPdf, 'documento_pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('excede o limite máximo');
    });
  });
});
