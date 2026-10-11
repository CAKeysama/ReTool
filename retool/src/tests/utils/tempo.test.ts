import { comTimeout, ErroTimeout, gravarComPrazo, MENSAGEM_GRAVACAO_SEM_RESPOSTA, PRAZO_GRAVACAO_MS } from '../../utils/tempo';

describe('comTimeout / gravarComPrazo', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolve quando a promessa conclui antes do prazo', async () => {
    const p = comTimeout(Promise.resolve(42), 1000);
    await expect(p).resolves.toBe(42);
  });

  it('rejeita com ErroTimeout (code "timeout") quando o prazo esgota', async () => {
    const p = comTimeout(new Promise(() => undefined), 1000, 'demorou');
    jest.advanceTimersByTime(1000);
    await expect(p).rejects.toMatchObject({ name: 'ErroTimeout', code: 'timeout', message: 'demorou' });
  });

  it('repassa o erro original quando a promessa falha antes do prazo', async () => {
    const erro = Object.assign(new Error('negado'), { code: 'permission-denied' });
    await expect(comTimeout(Promise.reject(erro), 1000)).rejects.toBe(erro);
  });

  it('gravarComPrazo usa 15 s e a mensagem de gravação pendente', async () => {
    expect(PRAZO_GRAVACAO_MS).toBe(15_000);
    const p = gravarComPrazo(new Promise(() => undefined));
    jest.advanceTimersByTime(PRAZO_GRAVACAO_MS - 1);
    let estado = 'pendente';
    p.catch(() => { estado = 'rejeitada'; });
    await Promise.resolve();
    expect(estado).toBe('pendente');
    jest.advanceTimersByTime(1);
    const e = (await p.catch(x => x)) as Error;
    expect(e).toBeInstanceOf(ErroTimeout);
    expect(e.message).toBe(MENSAGEM_GRAVACAO_SEM_RESPOSTA);
  });
});
