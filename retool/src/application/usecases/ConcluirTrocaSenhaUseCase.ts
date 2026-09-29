import { UserProfile } from '../../domain/entities/user';
import { validarNovaSenha } from '../../domain/services/senhaTemporaria';
import { IAuditLogRepository, IUsersRepository } from '../../domain/repositories/IAcessosRepositories';
import { ErroValidacao, autorAuditoria, registrarAuditoriaSemFalhar } from './acessosComum';

/** Reautentica com a senha atual e define a nova senha no provedor (Firebase Auth). */
export type AtualizarSenhaAuth = (senhaAtual: string, novaSenha: string) => Promise<void>;

export interface DadosTrocaSenha {
  usuario: UserProfile;
  senhaAtual: string;
  novaSenha: string;
  confirmacao: string;
}

/**
 * Fluxo C (conclusão): troca obrigatória da senha temporária no primeiro
 * acesso. Só depois de o provedor aceitar a nova senha a exigência é
 * removida do perfil. Nenhuma senha chega à auditoria.
 */
export class ConcluirTrocaSenhaUseCase {
  constructor(
    private usersRepo: IUsersRepository,
    private auditRepo: IAuditLogRepository,
    private atualizarSenhaAuth: AtualizarSenhaAuth
  ) {}

  async execute({ usuario, senhaAtual, novaSenha, confirmacao }: DadosTrocaSenha): Promise<void> {
    if (!senhaAtual) throw new ErroValidacao('Informe a senha temporária recebida.');
    const erro = validarNovaSenha(novaSenha, confirmacao, senhaAtual);
    if (erro) throw new ErroValidacao(erro);

    try {
      await this.atualizarSenhaAuth(senhaAtual, novaSenha);
    } catch (e) {
      await registrarAuditoriaSemFalhar(this.auditRepo, {
        ...autorAuditoria(usuario),
        acao: 'troca_senha',
        resultado: 'falha',
        acaoDescricao: 'Falha na troca obrigatória de senha (primeiro acesso)',
        tipoEntidade: 'usuario',
        entidadeId: usuario.uid,
        entidadeNome: usuario.nome,
        conteudo: { erro: (e as { code?: string })?.code || 'erro-desconhecido' }
      });
      throw e;
    }

    await this.usersRepo.updateProfile(usuario.uid, {
      trocaSenhaObrigatoria: false,
      senhaAlteradaEm: new Date().toISOString()
    });

    await registrarAuditoriaSemFalhar(this.auditRepo, {
      ...autorAuditoria(usuario),
      acao: 'troca_senha',
      acaoDescricao: 'Substituiu a senha temporária no primeiro acesso',
      tipoEntidade: 'usuario',
      entidadeId: usuario.uid,
      entidadeNome: usuario.nome,
      conteudo: { motivo: 'primeiro_acesso' }
    });
  }
}
