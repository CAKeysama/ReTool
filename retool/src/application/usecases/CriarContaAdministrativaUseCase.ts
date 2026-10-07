import { ROLES_CONFIG, UserProfile, UserRole, isAdministrador, isPerfilAtribuivel } from '../../domain/entities/user';
import { gerarSenhaTemporaria } from '../../domain/services/senhaTemporaria';
import { IAuditLogRepository, IUsersRepository } from '../../domain/repositories/IAcessosRepositories';
import { ErroPermissao, ErroValidacao, autorAuditoria, emailValido, limparTexto, registrarAuditoriaSemFalhar } from './acessosComum';

/** Conta recém-criada no provedor de autenticação (Firebase Auth). */
export interface ContaAuthCriada {
  uid: string;
  /** Remove a conta de autenticação (rollback se o perfil não puder ser gravado). */
  desfazer: () => Promise<void>;
  /** Encerra a sessão efêmera usada na criação. */
  finalizar: () => Promise<void>;
}

export type CriarContaAuth = (email: string, senha: string) => Promise<ContaAuthCriada>;

export interface DadosNovaConta {
  admin: UserProfile | null;
  nome: string;
  email: string;
  perfil: UserRole;
}

export interface ContaCriada {
  perfil: UserProfile;
  /**
   * Senha temporária em texto puro — devolvida UMA vez à Administração
   * para repasse ao colaborador. Nunca é persistida nem auditada.
   */
  senhaTemporaria: string;
}

/**
 * Fluxo C (início): a Administração cria uma conta. O sistema gera uma
 * senha temporária segura (CSPRNG), o Firebase Auth guarda somente o
 * hash, e o perfil nasce com troca de senha obrigatória no 1º acesso.
 */
export class CriarContaAdministrativaUseCase {
  constructor(
    private usersRepo: IUsersRepository,
    private auditRepo: IAuditLogRepository,
    private criarContaAuth: CriarContaAuth,
    private gerarSenha: () => string = () => gerarSenhaTemporaria()
  ) {}

  async execute({ admin, nome, email, perfil }: DadosNovaConta): Promise<ContaCriada> {
    if (!isAdministrador(admin)) {
      if (admin) {
        await registrarAuditoriaSemFalhar(this.auditRepo, {
          ...autorAuditoria(admin),
          acao: 'criacao_usuario',
          resultado: 'negado',
          acaoDescricao: 'Tentativa de criar conta sem permissão',
          tipoEntidade: 'usuario',
          entidadeId: 'nova-conta'
        });
      }
      throw new ErroPermissao();
    }

    const nomeLimpo = limparTexto(nome, 120);
    const emailNormalizado = email.trim().toLowerCase();
    if (!nomeLimpo) throw new ErroValidacao('Informe o nome completo do colaborador.');
    if (!emailValido(emailNormalizado)) throw new ErroValidacao('Informe um e-mail válido.');
    if (!isPerfilAtribuivel(perfil)) throw new ErroValidacao('Selecione um cargo válido.');

    const senhaTemporaria = this.gerarSenha();
    let conta: ContaAuthCriada;
    try {
      conta = await this.criarContaAuth(emailNormalizado, senhaTemporaria);
    } catch (e) {
      await registrarAuditoriaSemFalhar(this.auditRepo, {
        ...autorAuditoria(admin!),
        acao: 'criacao_usuario',
        resultado: 'falha',
        acaoDescricao: `Falha ao criar a conta de ${nomeLimpo}`,
        tipoEntidade: 'usuario',
        entidadeId: emailNormalizado,
        entidadeNome: nomeLimpo,
        conteudo: { email: emailNormalizado, perfil, erro: (e as { code?: string })?.code || (e as Error)?.message }
      });
      throw e;
    }

    const novoPerfil: UserProfile = {
      uid: conta.uid,
      email: emailNormalizado,
      nome: nomeLimpo,
      perfil,
      ativo: true,
      statusAprovacao: 'aprovado',
      trocaSenhaObrigatoria: true,
      criadoEm: new Date().toISOString(),
      criadoPorUid: admin!.uid
    };

    try {
      await this.usersRepo.setProfile(novoPerfil);
    } catch (e) {
      // Sem perfil a conta seria inútil: remove a autenticação recém-criada.
      await conta.desfazer().catch(err => console.warn('Falha ao desfazer conta de autenticação:', err));
      await registrarAuditoriaSemFalhar(this.auditRepo, {
        ...autorAuditoria(admin!),
        acao: 'criacao_usuario',
        resultado: 'falha',
        acaoDescricao: `Falha ao gravar o perfil de ${nomeLimpo}; conta de autenticação desfeita`,
        tipoEntidade: 'usuario',
        entidadeId: conta.uid,
        entidadeNome: nomeLimpo,
        conteudo: { email: emailNormalizado, perfil }
      });
      throw e;
    } finally {
      await conta.finalizar().catch(() => undefined);
    }

    await registrarAuditoriaSemFalhar(this.auditRepo, {
      ...autorAuditoria(admin!),
      acao: 'criacao_usuario',
      acaoDescricao: `Criou a conta de ${nomeLimpo} com o cargo ${ROLES_CONFIG[perfil].titulo} (senha temporária gerada)`,
      tipoEntidade: 'usuario',
      entidadeId: conta.uid,
      entidadeNome: nomeLimpo,
      conteudo: { email: emailNormalizado, perfil, trocaSenhaObrigatoria: true }
    });

    return { perfil: novoPerfil, senhaTemporaria };
  }
}
