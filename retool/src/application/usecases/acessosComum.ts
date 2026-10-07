import { UserProfile } from '../../domain/entities/user';
import { AuditLogInput, IAuditLogRepository, INotificationsRepository, IUsersRepository } from '../../domain/repositories/IAcessosRepositories';
import { Notificacao } from '../../domain/entities/notificacao';

/** Operação recusada por falta de permissão (validada também nas regras do Firestore). */
export class ErroPermissao extends Error {
  constructor(mensagem = 'Acesso negado: operação exclusiva da Administração.') {
    super(mensagem);
    this.name = 'ErroPermissao';
  }
}

/** Regra de negócio violada (dados inválidos, estado inconsistente). */
export class ErroValidacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroValidacao';
  }
}

type Autor = Pick<AuditLogInput, 'usuarioUid' | 'usuarioNome' | 'usuarioEmail' | 'usuarioPerfil'>;

export function autorAuditoria(u: Pick<UserProfile, 'uid' | 'nome' | 'email' | 'perfil'>): Autor {
  return {
    usuarioUid: u.uid,
    usuarioNome: u.nome,
    usuarioEmail: u.email,
    usuarioPerfil: u.perfil
  };
}

/** A auditoria nunca derruba a operação principal: falhas viram aviso no console. */
export async function registrarAuditoriaSemFalhar(repo: IAuditLogRepository, input: AuditLogInput): Promise<void> {
  try {
    await repo.registrarLog(input);
  } catch (e) {
    console.warn('Falha ao registrar auditoria:', e);
  }
}

/**
 * Envia uma notificação a cada administrador ativo (ids determinísticos,
 * sem duplicatas). Retorna quantos foram notificados com sucesso.
 */
export async function notificarAdministradores(
  usersRepo: IUsersRepository,
  notificationsRepo: INotificationsRepository,
  montar: (admin: UserProfile) => Notificacao,
  exceto?: string
): Promise<number> {
  let admins: UserProfile[] = [];
  try {
    admins = await usersRepo.listarAdministradoresAtivos();
  } catch (e) {
    console.warn('Não foi possível localizar a Administração para notificar:', e);
    return 0;
  }
  let enviados = 0;
  for (const admin of admins) {
    if (admin.uid === exceto) continue;
    try {
      await notificationsRepo.criar(montar(admin));
      enviados++;
    } catch (e) {
      console.warn('Falha ao notificar a Administração:', e);
    }
  }
  return enviados;
}

export function limparTexto(valor: string | undefined, max: number): string {
  return (valor || '').trim().slice(0, max);
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
