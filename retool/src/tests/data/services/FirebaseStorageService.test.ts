import '../../mocks/firebaseMock';
import { FirebaseStorageService } from '../../../data/services/FirebaseStorageService';

describe('FirebaseStorageService', () => {
  let service: FirebaseStorageService;

  beforeEach(() => {
    service = new FirebaseStorageService();
    jest.clearAllMocks();
  });

  it('deve realizar o upload de uma imagem e retornar FileAttachment estruturado com progresso', async () => {
    const file = new File(['mock content'], 'minha_foto.png', { type: 'image/png' });
    const progressSpy = jest.fn();

    const attachment = await service.uploadFile(
      'retool/dispositivos/disp-123',
      file,
      'imagem_peca',
      progressSpy
    );

    expect(attachment).toBeDefined();
    expect(attachment.id).toBeDefined();
    expect(attachment.originalName).toBe('minha_foto.png');
    expect(attachment.contentType).toBe('image/png');
    expect(attachment.storagePath).toContain('retool/dispositivos/disp-123/imagem_peca/');
    expect(attachment.downloadURL).toContain('https://firebasestorage.googleapis.com');
    expect(progressSpy).toHaveBeenCalled();
  });

  it('deve rejeitar upload de arquivo que falhar na validação', async () => {
    const invalidFile = new File(['mock'], 'programa.exe', { type: 'application/x-msdownload' });

    await expect(
      service.uploadFile('retool/dispositivos/disp-123', invalidFile, 'documento_pdf')
    ).rejects.toThrow('Apenas documentos no formato PDF são aceitos');
  });

  it('deve chamar deleteFile sem lançar erro', async () => {
    await expect(
      service.deleteFile('retool/dispositivos/disp-123/imagem_peca/foto.png')
    ).resolves.toBeUndefined();
  });

  it('deve chamar deleteFolder sem lançar erro', async () => {
    await expect(
      service.deleteFolder('retool/dispositivos/disp-123')
    ).resolves.toBeUndefined();
  });
});
