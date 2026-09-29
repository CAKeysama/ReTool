import { useCallback, useEffect, useRef, useState } from 'react';
import { AuditLog } from '../../domain/entities/auditLog';
import { FirestoreAuditLogRepository, FiltrosAuditoria } from '../../data/repositories/FirestoreAuditLogRepository';

const auditRepo = new FirestoreAuditLogRepository();

export type EstadoConsulta = 'carregando' | 'pronto' | 'erro';

function mensagemErroConsulta(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === 'permission-denied') {
    return 'Acesso negado: somente a Administração consulta o histórico de ações.';
  }
  if (code === 'failed-precondition') {
    return 'Esta combinação de filtros precisa de um índice no Firestore. Publique os índices do projeto (npx firebase-tools deploy --only firestore:indexes) ou simplifique os filtros.';
  }
  return 'Não foi possível carregar o histórico. Verifique sua conexão e tente novamente.';
}

/**
 * Estado da tela de histórico: paginação por cursor no servidor (anterior/
 * próxima), total por agregação e aviso em tempo real de novos registros.
 * `habilitado` evita qualquer consulta fora da Administração.
 */
export function useHistoricoAuditoriaController(habilitado: boolean) {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({});
  const [tamanhoPagina, setTamanhoPagina] = useState(25);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [estado, setEstado] = useState<EstadoConsulta>('carregando');
  const [erro, setErro] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [haNovos, setHaNovos] = useState(false);
  const [versao, setVersao] = useState(0);

  // cursores[i] = cursor que inicia a página i (a página 0 não tem cursor).
  const cursoresRef = useRef<unknown[]>([undefined]);
  const requisicaoRef = useRef(0);

  const carregarPagina = useCallback(async (indice: number) => {
    const id = ++requisicaoRef.current;
    setEstado('carregando');
    setErro('');
    try {
      const pagina = await auditRepo.listarPagina(filtros, tamanhoPagina, cursoresRef.current[indice]);
      if (id !== requisicaoRef.current) return; // resposta obsoleta
      cursoresRef.current[indice + 1] = pagina.cursor;
      setLogs(pagina.logs);
      setTemMais(pagina.temMais);
      setPaginaAtual(indice);
      setEstado('pronto');
    } catch (e) {
      if (id !== requisicaoRef.current) return;
      console.warn('Falha ao consultar o histórico de ações:', e);
      setErro(mensagemErroConsulta(e));
      setEstado('erro');
    }
  }, [filtros, tamanhoPagina]);

  // Filtros, tamanho de página ou recarga: volta para a primeira página.
  useEffect(() => {
    if (!habilitado) return;
    cursoresRef.current = [undefined];
    setHaNovos(false);
    carregarPagina(0);
    setTotal(null);
    auditRepo.contar(filtros).then(setTotal).catch(() => setTotal(null));
  }, [habilitado, filtros, carregarPagina, versao]);

  // Aviso de novos registros sem recarregar a página em exibição.
  useEffect(() => {
    if (!habilitado) return;
    let referencia: string | null = null;
    return auditRepo.subscribeLogs((lista) => {
      const maisRecente = lista[0]?.id ?? '';
      if (referencia === null) {
        referencia = maisRecente;
        return;
      }
      if (maisRecente && maisRecente !== referencia) setHaNovos(true);
    }, 1);
  }, [habilitado, versao]);

  return {
    filtros,
    setFiltros,
    tamanhoPagina,
    setTamanhoPagina,
    logs,
    paginaAtual,
    temMais,
    estado,
    erro,
    total,
    haNovos,
    proximaPagina: () => { if (temMais) carregarPagina(paginaAtual + 1); },
    paginaAnterior: () => { if (paginaAtual > 0) carregarPagina(paginaAtual - 1); },
    recarregar: () => setVersao(v => v + 1),
  };
}
