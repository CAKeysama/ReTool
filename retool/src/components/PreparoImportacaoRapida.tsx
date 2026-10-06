import { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';
import { BarraProgresso, mensagemDeErro } from './feedback';
import { useReTool } from '../context/ReToolContext';
import { useAvisoAoSair } from '../hooks/useAvisoAoSair';

const fmt = new Intl.NumberFormat('pt-BR');

type Etapa =
  | { tipo: 'verificando' }
  | { tipo: 'pronto'; total: number; comChave: number }
  | { tipo: 'preparando'; lidos: number; gravados: number; total: number }
  | { tipo: 'erro'; mensagem: string };

/**
 * Painel da Administração na importação: mostra se todos os dispositivos já
 * têm a chave Código + Dispositivo (`chaveCD`) e permite gravá-la nos que
 * faltam. Sem a chave em todos, toda importação lê o banco inteiro (correto,
 * mas caro); com ela, arquivos pequenos leem só as combinações do arquivo.
 */
export function PreparoImportacaoRapida() {
  const { estadoImportacaoRapida, prepararImportacaoRapida } = useReTool();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'verificando' });
  const [cancelando, setCancelando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const montadoRef = useRef(true);
  useAvisoAoSair(etapa.tipo === 'preparando');

  const verificar = async () => {
    setEtapa({ tipo: 'verificando' });
    try {
      const e = await estadoImportacaoRapida();
      if (montadoRef.current) setEtapa({ tipo: 'pronto', ...e });
    } catch (e) {
      console.error(e);
      if (montadoRef.current) setEtapa({ tipo: 'erro', mensagem: mensagemDeErro(e, 'Não foi possível verificar a importação rápida.') });
    }
  };

  useEffect(() => {
    montadoRef.current = true;
    void verificar();
    return () => { montadoRef.current = false; abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preparar = async () => {
    if (etapa.tipo !== 'pronto' || abortRef.current) return;
    const total = etapa.total;
    const ctl = new AbortController();
    abortRef.current = ctl;
    setCancelando(false);
    setEtapa({ tipo: 'preparando', lidos: 0, gravados: 0, total });
    try {
      const r = await prepararImportacaoRapida(p => { if (montadoRef.current) setEtapa({ tipo: 'preparando', ...p, total }); }, ctl.signal);
      if (!montadoRef.current) return;
      if (r.interrompido === 'erro') {
        setEtapa({ tipo: 'erro', mensagem: `O preparo parou por uma falha (${fmt.format(r.gravados)} dispositivos preparados). Rodar de novo continua de onde parou.` });
      } else if (r.interrompido === 'cota') {
        setEtapa({ tipo: 'erro', mensagem: `Cota diária do banco atingida (${fmt.format(r.gravados)} dispositivos preparados). Rode de novo outro dia: continua de onde parou.` });
      } else {
        await verificar();
      }
    } catch (e) {
      console.error(e);
      if (montadoRef.current) setEtapa({ tipo: 'erro', mensagem: mensagemDeErro(e, 'Não foi possível concluir o preparo. Rodar de novo continua o trabalho.') });
    } finally {
      if (abortRef.current === ctl) abortRef.current = null;
    }
  };

  if (etapa.tipo === 'pronto' && etapa.total > 0 && etapa.comChave >= etapa.total) {
    return (
      <p role="status" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-body)' }}>
        <Zap size={14} aria-hidden="true" /> Importação rápida ativa: arquivos pequenos leem só as combinações Código + Dispositivo do arquivo.
      </p>
    );
  }
  if (etapa.tipo === 'pronto' && etapa.total === 0) return null;

  return (
    <section
      aria-label="Importação rápida"
      aria-busy={etapa.tipo === 'verificando' || etapa.tipo === 'preparando' || undefined}
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      {etapa.tipo === 'verificando' && (
        <div role="status"><BarraProgresso feitos={0} rotulo="Verificando a importação rápida" /></div>
      )}

      {etapa.tipo === 'pronto' && (
        <>
          <div>
            <strong>Importação rápida desativada:</strong> {fmt.format(etapa.total - etapa.comChave)} de {fmt.format(etapa.total)} dispositivos
            ainda não têm a chave Código + Dispositivo. Até todos terem, cada importação lê o banco inteiro
            (cerca de {fmt.format(etapa.total)} leituras), mesmo para um arquivo pequeno.
          </div>
          <div>
            Preparar custa cerca de 1 leitura por dispositivo e 1 gravação por dispositivo sem a chave, uma única vez.
            Se a cota diária acabar, rode de novo outro dia: continua de onde parou.
          </div>
          <div>
            <button type="button" className="btn" onClick={preparar}>
              <Zap size={14} aria-hidden="true" /> Preparar importação rápida
            </button>
          </div>
        </>
      )}

      {etapa.tipo === 'preparando' && (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <BarraProgresso
            feitos={etapa.lidos}
            total={etapa.total}
            rotulo="Preparando a importação rápida"
            detalhe={`${fmt.format(etapa.gravados)} dispositivos receberam a chave`}
          />
          <div>
            <button type="button" className="btn" onClick={() => { setCancelando(true); abortRef.current?.abort(); }} disabled={cancelando}>
              {cancelando ? 'Cancelando…' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {etapa.tipo === 'erro' && (
        <div role="alert" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {etapa.mensagem}
          <button type="button" className="btn" onClick={verificar}>Verificar de novo</button>
        </div>
      )}
    </section>
  );
}
