import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { BarraProgresso, mensagemDeErro } from './feedback';
import { comTimeout } from '../utils/tempo';
import { useAvisoAoSair } from '../hooks/useAvisoAoSair';
import { useAuth } from '../context/AuthContext';
import { FirestoreReutilizacoesRepository } from '../data/repositories/FirestoreReutilizacoesRepository';
import { FirestoreAuditLogRepository } from '../data/repositories/FirestoreAuditLogRepository';
import { PlanoNormalizacao, planejarNormalizacaoReutilizacoes } from '../domain/services/consultaReutilizacoes';

const repo = new FirestoreReutilizacoesRepository();
const auditRepo = new FirestoreAuditLogRepository();
const fmt = new Intl.NumberFormat('pt-BR');

type Etapa =
  | { tipo: 'inicial' }
  | { tipo: 'lendo' }
  | { tipo: 'confirmar'; plano: PlanoNormalizacao }
  | { tipo: 'gravando'; feitos: number; total: number }
  | { tipo: 'erro'; mensagem: string; feitos?: number };

interface Props {
  /** Registros que as consultas no servidor não alcançam (das contagens). */
  legados: number;
  /** Total da coleção (leituras do modo legado a cada abertura). */
  total: number;
  /** Normalização gravada: refazer as contagens (a tela passa ao modo servidor). */
  onConcluido: (alterados: number) => void;
}

/**
 * Aviso do modo legado para a Administração, com a normalização do acervo:
 * lê a coleção uma vez (ação explícita), mostra quantos registros mudam e
 * grava status canônico + dataCriacao em lotes de 500. Ver PERFORMANCE.md.
 */
export function NormalizarReutilizacoes({ legados, total, onConcluido }: Props) {
  const { userProfile } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'inicial' });
  useAvisoAoSair(etapa.tipo === 'gravando');

  const analisar = async () => {
    if (etapa.tipo === 'lendo' || etapa.tipo === 'gravando') return;
    setEtapa({ tipo: 'lendo' });
    try {
      const docs = await comTimeout(repo.listarDocumentosCrus(), 60_000);
      setEtapa({ tipo: 'confirmar', plano: planejarNormalizacaoReutilizacoes(docs) });
    } catch (e) {
      console.error(e);
      setEtapa({ tipo: 'erro', mensagem: mensagemDeErro(e, 'Não foi possível ler as reutilizações. Tente novamente.') });
    }
  };

  const gravar = async (plano: PlanoNormalizacao) => {
    if (etapa.tipo === 'gravando') return;
    let feitos = 0;
    setEtapa({ tipo: 'gravando', feitos: 0, total: plano.itens.length });
    try {
      await repo.aplicarNormalizacao(plano, (f, t) => { feitos = f; setEtapa({ tipo: 'gravando', feitos: f, total: t }); });
      // Um registro de auditoria para a operação inteira (não um por documento).
      try {
        await auditRepo.registrarLog({
          usuarioUid: userProfile?.uid || 'sistema',
          usuarioNome: userProfile?.nome || 'Desconhecido',
          usuarioEmail: userProfile?.email || '',
          usuarioPerfil: 'admin',
          acao: 'edicao',
          acaoDescricao: 'Normalizou reutilizações antigas',
          tipoEntidade: 'reutilizacao',
          entidadeId: 'normalizacao',
          entidadeNome: 'Reutilizações antigas',
          detalhes: 'Normalizou reutilizações antigas',
          conteudo: {
            alterados: plano.itens.length,
            comStatusAlterado: plano.comStatusAlterado,
            comDataCriacaoAlterada: plano.comDataCriacaoAlterada,
            comDataCriacaoAtual: plano.comDataCriacaoAtual,
          },
        });
      } catch (e) {
        console.warn('Erro ao registrar log de auditoria:', e);
      }
      setEtapa({ tipo: 'inicial' });
      onConcluido(plano.itens.length);
    } catch (e) {
      console.error(e);
      setEtapa({
        tipo: 'erro',
        feitos,
        mensagem: mensagemDeErro(e, 'Não foi possível gravar todos os registros. Tente novamente: só os que faltam serão alterados.'),
      });
    }
  };

  const ocupado = etapa.tipo === 'lendo' || etapa.tipo === 'gravando';

  return (
    <section
      aria-label="Reutilizações antigas"
      aria-busy={ocupado || undefined}
      style={{ background: '#fff7e6', border: '1px solid #f0c36d', color: '#5c4400', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '12px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      <div>
        <strong>{fmt.format(legados)} {legados === 1 ? 'reutilização antiga' : 'reutilizações antigas'}</strong> (status antigo ou sem data de criação)
        {' '}obrigam esta tela a carregar todo o histórico a cada abertura ({fmt.format(total)} leituras).
        Normalize uma vez para a tela passar a carregar só as pendências e a página atual.
      </div>

      {etapa.tipo === 'inicial' && (
        <div>
          <button type="button" className="btn" onClick={analisar}>
            <Wrench size={14} aria-hidden="true" /> Normalizar reutilizações antigas
          </button>
        </div>
      )}

      {etapa.tipo === 'lendo' && (
        <div role="status"><BarraProgresso feitos={0} rotulo={`Lendo as ${fmt.format(total)} reutilizações para planejar a normalização`} /></div>
      )}

      {etapa.tipo === 'confirmar' && (
        etapa.plano.itens.length === 0 ? (
          <div role="status" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            Nenhum registro precisa de alteração (outra pessoa pode ter normalizado agora).
            <button type="button" className="btn" onClick={() => { setEtapa({ tipo: 'inicial' }); onConcluido(0); }}>Verificar de novo</button>
          </div>
        ) : (
          <div role="alertdialog" aria-label="Confirmar normalização" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div>
              Serão alterados <strong>{fmt.format(etapa.plano.itens.length)}</strong> de {fmt.format(etapa.plano.analisados)} registros:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {etapa.plano.comStatusAlterado > 0 && (
                <li>{fmt.format(etapa.plano.comStatusAlterado)} com status antigo ou ausente recebem o status atual equivalente (pendente → Em análise (Projetista); aprovado e Em andamento - OS → Reutilização aprovada; rejeitado → Reutilização não aprovada; ausente ou desconhecido → Em análise (Projetista)).</li>
              )}
              {etapa.plano.comDataCriacaoAlterada > 0 && (
                <li>
                  {fmt.format(etapa.plano.comDataCriacaoAlterada)} sem data de criação recebem a data informada no registro
                  {etapa.plano.comDataCriacaoAtual > 0 && <> ({fmt.format(etapa.plano.comDataCriacaoAtual)} sem nenhuma data recebem a data de hoje)</>}.
                </li>
              )}
            </ul>
            <div>Nenhum outro campo é alterado. A operação fica registrada na auditoria.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => gravar(etapa.plano)}
                style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: 'white' }}>
                Confirmar normalização
              </button>
              <button type="button" className="btn" onClick={() => setEtapa({ tipo: 'inicial' })}>Cancelar</button>
            </div>
          </div>
        )
      )}

      {etapa.tipo === 'gravando' && (
        <div role="status">
          <BarraProgresso feitos={etapa.feitos} total={etapa.total} rotulo="Normalizando reutilizações" detalhe="Não feche esta aba até terminar." />
        </div>
      )}

      {etapa.tipo === 'erro' && (
        <div role="alert" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', color: 'var(--color-danger)' }}>
          <span>
            {etapa.mensagem}
            {!!etapa.feitos && <> ({fmt.format(etapa.feitos)} já gravados.)</>}
          </span>
          <button type="button" className="btn" onClick={analisar}>Tentar novamente</button>
        </div>
      )}
    </section>
  );
}
