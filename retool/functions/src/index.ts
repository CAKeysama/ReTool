import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, DocumentData } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { gerarSenhaTemporaria } from './senhaTemporaria';

initializeApp();

// Região também usada pelo cliente (src/data/datasources/firebase.ts).
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 });

const PERFIS_OPERACIONAIS = ['admin', 'projetista', 'engenharia', 'gerencia'];

/** Mesmo critério de `isActiveUser` nas firestore.rules. */
function contaOperacional(u: DocumentData | undefined): boolean {
  return !!u
    && u.ativo === true
    && PERFIS_OPERACIONAIS.includes(u.perfil)
    && (u.statusAprovacao ?? 'aprovado') === 'aprovado'
    && u.trocaSenhaObrigatoria !== true;
}

/** Contas legadas sem `statusAprovacao`: pendente se for o autocadastro antigo. */
function statusDoCadastro(u: DocumentData): string {
  if (u.statusAprovacao) return u.statusAprovacao;
  return u.ativo === false && u.perfilSolicitado ? 'pendente' : 'aprovado';
}

interface RegistroAuditoria {
  resultado: 'sucesso' | 'falha' | 'negado';
  acaoDescricao: string;
  entidadeNome?: string;
  conteudo?: Record<string, unknown>;
}

/**
 * Administração gera uma nova senha temporária para outra conta aprovada.
 *
 * - Autorização verificada NO SERVIDOR contra o perfil persistido (o Admin
 *   SDK ignora as regras do Firestore, então nada é delegado ao cliente).
 * - A senha é gerada aqui (CSPRNG), aplicada no Firebase Auth (que guarda
 *   apenas o hash) e devolvida uma única vez a quem chamou. Nunca é
 *   persistida nem registrada em log.
 * - A conta passa a exigir troca de senha e as sessões abertas são revogadas.
 */
export const redefinirSenhaTemporaria = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Entre no sistema para continuar.');
  }
  const alvoUid = (request.data as { uid?: unknown } | undefined)?.uid;
  if (typeof alvoUid !== 'string' || !alvoUid.trim()) {
    throw new HttpsError('invalid-argument', 'Informe o usuário que terá a senha redefinida.');
  }

  const db = getFirestore();
  const chamadorUid = request.auth.uid;
  const [chamadorSnap, alvoSnap] = await Promise.all([
    db.doc(`users/${chamadorUid}`).get(),
    db.doc(`users/${alvoUid}`).get()
  ]);
  const chamador = chamadorSnap.data();
  const alvo = alvoSnap.data();

  const auditar = ({ resultado, acaoDescricao, entidadeNome, conteudo }: RegistroAuditoria) => {
    const id = randomUUID();
    return db.doc(`audit_logs/${id}`).set({
      id,
      usuarioUid: chamadorUid,
      usuarioNome: chamador?.nome ?? request.auth?.token.email ?? chamadorUid,
      usuarioEmail: chamador?.email ?? request.auth?.token.email ?? '',
      usuarioPerfil: chamador?.perfil ?? 'convidado',
      acao: 'redefinicao_senha',
      categoria: 'usuarios',
      resultado,
      acaoDescricao,
      tipoEntidade: 'usuario',
      entidadeId: alvoUid,
      entidadeNome: entidadeNome ?? alvo?.nome ?? alvoUid,
      ...(conteudo ? { conteudo } : {}),
      dataHora: new Date().toISOString(),
      dataHoraServidor: FieldValue.serverTimestamp()
    });
  };

  if (!contaOperacional(chamador) || chamador!.perfil !== 'admin') {
    if (chamador) {
      await auditar({ resultado: 'negado', acaoDescricao: 'Tentativa de redefinir senha sem permissão' });
    }
    throw new HttpsError('permission-denied', 'Acesso negado: operação exclusiva da Administração.');
  }
  if (alvoUid === chamadorUid) {
    throw new HttpsError('failed-precondition', 'A própria senha não é redefinida por aqui.');
  }
  if (!alvoSnap.exists || !alvo) {
    throw new HttpsError('not-found', 'Usuário não encontrado.');
  }
  if (statusDoCadastro(alvo) !== 'aprovado') {
    throw new HttpsError('failed-precondition', 'Somente contas aprovadas podem ter a senha redefinida.');
  }

  const agora = new Date().toISOString();
  const exigenciaAnterior = alvo.trocaSenhaObrigatoria === true;

  // Primeiro exige a troca (nega acesso aos dados), depois troca a senha.
  await alvoSnap.ref.update({
    trocaSenhaObrigatoria: true,
    senhaRedefinidaEm: agora,
    senhaRedefinidaPorUid: chamadorUid,
    atualizadoEm: agora
  });

  const senhaTemporaria = gerarSenhaTemporaria();
  try {
    await getAuth().updateUser(alvoUid, { password: senhaTemporaria });
    await getAuth().revokeRefreshTokens(alvoUid);
  } catch (e) {
    await alvoSnap.ref.update({ trocaSenhaObrigatoria: exigenciaAnterior }).catch(() => undefined);
    const code = (e as { code?: string })?.code || 'erro-desconhecido';
    await auditar({
      resultado: 'falha',
      acaoDescricao: `Falha ao redefinir a senha de ${alvo.nome ?? alvoUid}`,
      conteudo: { erro: code }
    });
    if (code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'A conta de autenticação deste usuário não existe mais.');
    }
    throw new HttpsError('internal', 'Não foi possível redefinir a senha. Tente novamente.');
  }

  await auditar({
    resultado: 'sucesso',
    acaoDescricao: `Gerou nova senha temporária para ${alvo.nome ?? alvoUid} (troca obrigatória no próximo acesso)`,
    conteudo: { email: alvo.email, trocaSenhaObrigatoria: true, sessoesEncerradas: true }
  });

  return { senhaTemporaria };
});
