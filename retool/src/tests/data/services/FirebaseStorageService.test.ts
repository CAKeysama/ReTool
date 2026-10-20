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

  describe('deleteFolder com arquivos ainda usados', () => {
    const pasta = 'retool/dispositivos/disp-123';
    const arquivos = [
      `${pasta}/imagem_peca/u1_usada.png`,
      `${pasta}/imagem_peca/u2_sobrando.png`,
      `${pasta}/documento_pdf/u3_manual.pdf`,
    ];

    beforeEach(() => {
      const { listAll } = jest.requireMock('firebase/storage') as { listAll: jest.Mock };
      listAll.mockImplementation(async (r: { fullPath: string }) => r.fullPath === pasta
        ? { items: arquivos.map(fullPath => ({ fullPath })), prefixes: [] }
        : { items: [], prefixes: [] });
    });

    const apagados = () => (jest.requireMock('firebase/storage') as { deleteObject: jest.Mock })
      .deleteObject.mock.calls.map(([item]) => (item as { fullPath: string }).fullPath).sort();

    it('preserva o que `manter` indicar e apaga o resto', async () => {
      await service.deleteFolder(pasta, async caminho => caminho.endsWith('u1_usada.png'));
      expect(apagados()).toEqual([arquivos[2], arquivos[1]].sort());
    });

    it('preserva o arquivo quando a checagem falha (nunca apaga por engano)', async () => {
      await service.deleteFolder(pasta, async caminho => {
        if (caminho.endsWith('.png')) throw new Error('sem conexão');
        return false;
      });
      expect(apagados()).toEqual([arquivos[2]]);
    });
  });
});
