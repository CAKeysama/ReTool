import { UserProfile } from '../../domain/entities/user';
import { idNotificacao } from '../../domain/entities/notificacao';
import { IAuditLogRepository, INotificationsRepository, IUsersRepository } from '../../domain/repositories/IAcessosRepositories';
import { ErroValidacao, autorAuditoria, limparTexto, notificarAdministradores, registrarAuditoriaSemFalhar } from './acessosComum';

export interface DadosCadastro {
  uid: string;
  email: string;
  nome: string;
}

/**
 * Fluxo A (início): autocadastro público.
 * O cargo NUNCA vem do formulário: toda conta nasce como Convidado,
 * inativa e aguardando aprovação; a Administração é notificada.
 */
export class SolicitarCadastroUseCase {
  constructor(
    private usersRepo: IUsersRepository,
    private auditRepo: IAuditLogRepository,
    private notificationsRepo: INotificationsRepository
  ) {}

  async execute(dados: DadosCadastro): Promise<UserProfile> {
    const nome = limparTexto(dados.nome, 120);
    if (!nome) throw new ErroValidacao('Informe seu nome completo.');

    const perfil: UserProfile = {
      uid: dados.uid,
      email: dados.email.trim().toLowerCase(),
      nome,
      perfil: 'convidado',
      ativo: false,
      statusAprovacao: 'pendente',
      criadoEm: new Date().toISOString()
    };
    await this.usersRepo.setProfile(perfil);

    const notificados = await notificarAdministradores(this.usersRepo, this.notificationsRepo, admin => ({
      id: idNotificacao('conta_nova', perfil.uid, admin.uid),
      tipo: 'conta_nova',
      destinatarioUid: admin.uid,
      remetenteUid: perfil.uid,
      titulo: 'Novo cadastro aguardando aprovação',
      descricao: `${nome} (${perfil.email}) criou uma conta e aguarda a definição de cargo.`,
      dataHora: new Date().toISOString(),
      lida: false,
      entidadeId: perfil.uid
    }));

    await registrarAuditoriaSemFalhar(this.auditRepo, {
      ...autorAuditoria(perfil),
      acao: 'cadastro',
      acaoDescricao: 'Solicitou cadastro no sistema (Convidado aguardando aprovação)',
      tipoEntidade: 'usuario',
      entidadeId: perfil.uid,
      entidadeNome: nome,
      conteudo: {
        email: perfil.email,
        perfil: perfil.perfil,
        statusAprovacao: perfil.statusAprovacao,
        administradoresNotificados: notificados
      }
    });

    return perfil;
  }
}
