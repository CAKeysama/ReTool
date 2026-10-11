import { db } from '../datasources/firebase';
import { collection, doc, getDoc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { SolicitacaoCargo } from '../../domain/entities/solicitacaoCargo';
import { DecisaoSolicitacaoCargo, ISolicitacoesCargoRepository } from '../../domain/repositories/IAcessosRepositories';

const COLECAO = 'solicitacoes_cargo';
/** Trava `pendencias_cargo/{uid}`: garante no servidor uma única solicitação pendente por usuário. */
const TRAVAS = 'pendencias_cargo';

function ordenarMaisRecentes(lista: SolicitacaoCargo[]): SolicitacaoCargo[] {
  return lista.sort((a, b) => new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime());
}

export class FirestoreSolicitacoesCargoRepository implements ISolicitacoesCargoRepository {
  async obter(id: string): Promise<SolicitacaoCargo | null> {
    const snap = await getDoc(doc(db, COLECAO, id));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as SolicitacaoCargo) : null;
  }

  async obterPendenteDoUsuario(uid: string): Promise<SolicitacaoCargo | null> {
    const trava = await getDoc(doc(db, TRAVAS, uid));
    if (!trava.exists()) return null;
    const solicitacao = await this.obter(trava.data().solicitacaoId);
    return solicitacao && solicitacao.status === 'pendente' ? solicitacao : null;
  }

  async criar(solicitacao: SolicitacaoCargo): Promise<void> {
    const batch = writeBatch(db);
    const dados = Object.fromEntries(Object.entries(solicitacao).filter(([, v]) => v !== undefined));
    batch.set(doc(db, COLECAO, solicitacao.id), dados);
    batch.set(doc(db, TRAVAS, solicitacao.usuarioUid), {
      solicitacaoId: solicitacao.id,
      criadoEm: solicitacao.dataSolicitacao
    });
    await batch.commit();
  }

  async decidir(solicitacao: SolicitacaoCargo, decisao: DecisaoSolicitacaoCargo): Promise<void> {
    const batch = writeBatch(db);
    const dados = Object.fromEntries(Object.entries(decisao).filter(([, v]) => v !== undefined));
    batch.update(doc(db, COLECAO, solicitacao.id), dados);
    if (decisao.status === 'aprovada') {
      // A troca efetiva do cargo acontece somente aqui, na aprovação.
      batch.update(doc(db, 'users', solicitacao.usuarioUid), {
        perfil: solicitacao.perfilSolicitado,
        atualizadoEm: decisao.dataDecisao
      });
    }
    batch.delete(doc(db, TRAVAS, solicitacao.usuarioUid));
    await batch.commit();
  }

  /** Todas as solicitações (Administração), mais recentes primeiro. */
  subscribeTodas(callback: (lista: SolicitacaoCargo[]) => void, onError?: (error: Error) => void): () => void {
    return onSnapshot(collection(db, COLECAO), (snap) => {
      callback(ordenarMaisRecentes(snap.docs.map(d => ({ ...d.data(), id: d.id } as SolicitacaoCargo))));
    }, (error) => {
      console.warn('Falha ao sincronizar solicitações de cargo:', error);
      callback([]);
      onError?.(error);
    });
  }

  /** Solicitações do próprio usuário (acompanhamento do status). */
  subscribeDoUsuario(uid: string, callback: (lista: SolicitacaoCargo[]) => void, onError?: (error: Error) => void): () => void {
    const q = query(collection(db, COLECAO), where('usuarioUid', '==', uid));
    return onSnapshot(q, (snap) => {
      callback(ordenarMaisRecentes(snap.docs.map(d => ({ ...d.data(), id: d.id } as SolicitacaoCargo))));
    }, (error) => {
      console.warn('Falha ao sincronizar suas solicitações de cargo:', error);
      callback([]);
      onError?.(error);
    });
  }
}
