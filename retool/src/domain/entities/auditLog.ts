import { PerfilUsuario } from './user';

/**
 * Tipos de ação auditável.
 * Tokens de máquina (estáveis para filtros/regras); o rótulo legível
 * correspondente vai em `acaoDescricao` (ex.: "Aprovou Reutilização").
 */
export type AuditLogAcao =
  | 'criacao'
  | 'edicao'
  | 'exclusao'
  | 'transicao'
  | 'importacao'
  | 'aprovacao'
  | 'rejeicao'
  | 'alteracao_perfil'
  | 'bloqueio_usuario'
  | 'desbloqueio_usuario'
  // Autenticação e ciclo de vida das contas
  | 'login'
  | 'logout'
  | 'cadastro'
  | 'aprovacao_usuario'
  | 'rejeicao_usuario'
  | 'criacao_usuario'
  | 'troca_senha'
  | 'redefinicao_senha'
  // Fluxo de alteração de cargo
  | 'solicitacao_cargo'
  | 'aprovacao_cargo'
  | 'rejeicao_cargo';

/** Agrupamento das ações para filtros da tela de histórico. */
export type AuditLogCategoria = 'autenticacao' | 'usuarios' | 'dados' | 'fluxo';

export type AuditLogResultado = 'sucesso' | 'falha' | 'negado';

export type AuditLogTipoEntidade =
  | 'dispositivo'
  | 'categoria'
  | 'tipo'
  | 'familia'
  | 'produto'
  | 'reutilizacao'
  | 'usuario'
  | 'solicitacao_cargo'
  | 'sessao';

export interface AuditLog {
  id: string;
  /** ISO (compatível com o acervo legado) — campo usado na ordenação. */
  dataHora: string;
  /** Carimbo nativo do servidor (serverTimestamp), normalizado para ISO na leitura. */
  dataHoraServidor?: string;
  usuarioUid: string;
  usuarioNome: string;
  usuarioEmail: string;
  usuarioPerfil: PerfilUsuario;
  acao: AuditLogAcao;
  /** Categoria derivada de `acao` (ausente no acervo legado; recalculada na leitura). */
  categoria?: AuditLogCategoria;
  /** Resultado da operação (ausente no acervo legado = sucesso). */
  resultado?: AuditLogResultado;
  /** Rótulo humano da ação, ex.: "Aprovou Reutilização", "Solicitou Novo Filtro". */
  acaoDescricao?: string;
  tipoEntidade: AuditLogTipoEntidade;
  entidadeId: string;
  entidadeNome?: string;
  detalhes?: string;
  /** Detalhes estruturados da operação (JSON): ids, motivos, valores alterados. */
  conteudo?: Record<string, any>;
  dadosAnteriores?: Record<string, any>;
}

export const ACOES_POR_CATEGORIA: Record<AuditLogCategoria, AuditLogAcao[]> = {
  autenticacao: ['login', 'logout', 'cadastro', 'troca_senha'],
  usuarios: [
    'aprovacao_usuario', 'rejeicao_usuario', 'criacao_usuario', 'redefinicao_senha', 'alteracao_perfil',
    'bloqueio_usuario', 'desbloqueio_usuario', 'solicitacao_cargo', 'aprovacao_cargo', 'rejeicao_cargo'
  ],
  dados: ['criacao', 'edicao', 'exclusao', 'importacao'],
  fluxo: ['transicao', 'aprovacao', 'rejeicao'],
};

export const ROTULO_CATEGORIA: Record<AuditLogCategoria, string> = {
  autenticacao: 'Autenticação',
  usuarios: 'Usuários e cargos',
  dados: 'Alteração de dados',
  fluxo: 'Fluxo de reutilização',
};

export const ROTULO_ACAO: Record<AuditLogAcao, string> = {
  criacao: 'Criação',
  edicao: 'Edição',
  exclusao: 'Exclusão',
  transicao: 'Transição de fluxo',
  importacao: 'Importação',
  aprovacao: 'Aprovação',
  rejeicao: 'Rejeição',
  alteracao_perfil: 'Alteração de cargo',
  bloqueio_usuario: 'Bloqueio de usuário',
  desbloqueio_usuario: 'Desbloqueio de usuário',
  login: 'Login',
  logout: 'Logout',
  cadastro: 'Cadastro',
  aprovacao_usuario: 'Aprovação de usuário',
  rejeicao_usuario: 'Rejeição de usuário',
  criacao_usuario: 'Criação de usuário',
  troca_senha: 'Troca de senha',
  redefinicao_senha: 'Redefinição de senha',
  solicitacao_cargo: 'Solicitação de cargo',
  aprovacao_cargo: 'Aprovação de cargo',
  rejeicao_cargo: 'Rejeição de cargo',
};

export const ROTULO_TIPO_ENTIDADE: Record<AuditLogTipoEntidade, string> = {
  dispositivo: 'Dispositivo',
  categoria: 'Categoria',
  tipo: 'Tipo',
  familia: 'Família',
  produto: 'Produto',
  reutilizacao: 'Reutilização',
  usuario: 'Usuário',
  solicitacao_cargo: 'Solicitação de cargo',
  sessao: 'Sessão',
};

export function categoriaDaAcao(acao: AuditLogAcao): AuditLogCategoria {
  const categoria = (Object.keys(ACOES_POR_CATEGORIA) as AuditLogCategoria[])
    .find(c => ACOES_POR_CATEGORIA[c].includes(acao));
  return categoria || 'dados';
}

/**
 * Palavras que identificam segredos. A comparação é feita sobre as palavras
 * do nome do campo (camelCase/snake_case), então `senhaTemporaria`,
 * `novaSenha`, `password` e `idToken` são removidos.
 */
const PALAVRAS_SENSIVEIS = ['senha', 'password', 'passwd', 'pwd', 'token', 'secret', 'segredo', 'hash', 'credential', 'credencial'];
/** Termos compostos detectados mesmo sem separador (ex.: `userpassword`, `apiKey`). */
const TERMOS_SENSIVEIS = ['password', 'passwd', 'apikey', 'privatekey', 'credential', 'credencial', 'segredo'];

function palavrasDoCampo(campo: string): string[] {
  return campo
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .map(p => p.toLowerCase())
    .filter(Boolean);
}

export function isCampoSensivel(campo: string): boolean {
  const palavras = palavrasDoCampo(campo);
  const junto = palavras.join('');
  return palavras.some(p => PALAVRAS_SENSIVEIS.includes(p))
    || TERMOS_SENSIVEIS.some(t => junto.includes(t));
}

/**
 * Remove recursivamente campos com segredos antes de persistir na
 * auditoria. Flags booleanas (ex.: `trocaSenhaObrigatoria`) não carregam
 * segredo e são preservadas.
 */
export function sanitizarDadosAuditoria<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map(item => sanitizarDadosAuditoria(item)) as unknown as T;
  }
  if (valor && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
    const limpo: Record<string, unknown> = {};
    for (const [campo, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === undefined) continue;
      if (isCampoSensivel(campo) && typeof v !== 'boolean') continue;
      limpo[campo] = sanitizarDadosAuditoria(v);
    }
    return limpo as T;
  }
  return valor;
}
