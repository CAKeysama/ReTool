# Controle de Acesso — ReTool

Documento técnico do módulo de autenticação e autorização (RBAC) da plataforma.

## 1. Visão Geral

O controle de acesso opera em **duas camadas independentes e complementares**:

| Camada | Onde | O que impede |
| --- | --- | --- |
| **Interface (client-side)** | React (`usePermissions`, `telaDaSessao`, rotas, botões condicionais) | Uso indevido por usuários legítimos no fluxo normal da aplicação. |
| **Banco de dados (server-side)** | `firestore.rules` e `storage.rules` | Qualquer ataque direto à API do Firebase: escalonamento de privilégio, autoaprovação, escrita em nome de terceiros, leitura ou adulteração de auditoria. |

> ⚠️ **Regra de ouro:** a interface apenas *esconde* o que o usuário não pode fazer.
> A garantia real de segurança vem das **regras do Firestore/Storage** — sem elas,
> o RBAC não existe. Sempre faça o deploy das regras e índices ao publicar a
> aplicação (ver seção 8).

Uma conta só **opera** no sistema quando está **ativa**, **aprovada**, com
**cargo operacional** e **sem troca de senha pendente**
(`isContaOperacional` no domínio ⇄ `isActiveUser` nas regras).

## 2. Perfis de Acesso (papéis)

Matriz oficial (imagem institucional *"Retool ADM – Controle de Acesso"*),
travada como teste de regressão em `src/tests/domain/entities/user.test.ts`.
Para a Engenharia, o "Solicitar" das colunas Cadastrar/Aprovar da imagem é a
ação de **solicitar reutilização** (`canSolicitar`).

Definidos em `src/domain/entities/user.ts` (`ROLES_CONFIG` + `CONVIDADO_CONFIG`):

| Papel | Consultar | Cadastrar | Editar | Excluir | Aprovar | Solicitar reutilização | Gerir usuários | Ver auditoria |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Programadora / Administradora** (`admin`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Projetista – Ferramentaria** (`projetista`) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Engenharia de Processo / Industrial** (`engenharia`) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Gerência** (`gerencia`) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Convidado** (`convidado`) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

- `convidado` **não é um cargo atribuível**: é o estado do autocadastro até a
  decisão da Administração (`PERFIS_ATRIBUIVEIS` contém apenas os 4 cargos).
- Perfis desconhecidos caem no menor privilégio (`configDoPerfil` → Convidado).

A matriz é aplicada nos dois lugares ao mesmo tempo:
- **UI:** `src/hooks/usePermissions.ts` + guards em páginas/modais/rotas.
- **Firestore:** funções `canConsultar()`, `canCadastrar()`, `canEditar()`,
  `canExcluir()`, `isAdmin()` em `firestore.rules`.

## 3. Ciclo de Vida de um Usuário

### 3.1 Cadastro público (Fluxo A)
1. O colaborador cria a conta na tela de login (nome, e-mail, senha) — **não
   existe campo de cargo**.
2. `SolicitarCadastroUseCase` grava o perfil **sempre** como
   `perfil: 'convidado'`, `ativo: false`, `statusAprovacao: 'pendente'`. As
   regras recusam qualquer autocadastro com outro cargo, conta ativa, status
   aprovado ou campos extras.
3. Cada administrador ativo recebe a notificação `conta_nova`; a ação é
   auditada (`cadastro`).
4. A sessão continua aberta **somente** na tela *Cadastro em análise*
   (`AguardandoAprovacao`). Nenhuma rota do sistema é renderizada e as regras
   negam a leitura de qualquer dado.
5. Em **Administração → Cadastros pendentes** a Administração:
   - **aprova** escolhendo explicitamente o cargo (a conta passa a
     `ativo: true`, `statusAprovacao: 'aprovado'` e libera o sistema em tempo
     real para o usuário); ou
   - **rejeita** com motivo opcional (`statusAprovacao: 'rejeitado'`, conta
     inativa). O registro é preservado: um novo login é recusado exibindo o
     motivo, e o autocadastro não pode ser refeito com a mesma conta.
6. O solicitante recebe `conta_decidida`; a decisão é auditada
   (`aprovacao_usuario` / `rejeicao_usuario`).

### 3.2 Provisionamento pela Administração com senha temporária (Fluxo C)
- Em **Administração → Usuários → Nova conta** (nome, e-mail, cargo — sem
  campo de senha).
- `CriarContaAdministrativaUseCase` gera uma **senha temporária** de 14
  caracteres com `crypto.getRandomValues` (CSPRNG, amostragem sem viés,
  todas as classes de caracteres, sem caracteres ambíguos).
- A conta é criada numa **instância secundária do Firebase App**
  (`getSecondaryAuthApp()`), preservando a sessão da administradora. O
  **Firebase Auth armazena apenas o hash** da senha; ela nunca é gravada no
  Firestore, em URL, em storage do navegador ou na auditoria.
- O perfil nasce com `trocaSenhaObrigatoria: true` (exigido pelas regras).
  Se o perfil não puder ser gravado, a conta de autenticação é desfeita.
- A senha é exibida **uma única vez** à administradora (com botão *Copiar*) e
  descartada ao concluir ou sair da tela.
- No **primeiro acesso**, a sessão só renderiza *Defina sua nova senha*
  (`TrocaSenhaObrigatoria`): o usuário informa a senha temporária e a nova
  (mín. 8 caracteres, letras e números, diferente da temporária). O app
  reautentica, atualiza a senha no Firebase Auth e só então remove a
  exigência. Enquanto ela existir, as regras negam toda leitura/escrita de
  dados. Tudo é auditado (`criacao_usuario`, `login`, `troca_senha`) sem
  senhas.

### 3.3 Alteração de cargo (Fluxo B)
- O usuário **não altera o próprio cargo** (regras recusam `perfil`, `ativo`
  e `statusAprovacao` no próprio documento).
- Pelo menu do perfil → **Solicitar alteração de cargo** (contas operacionais
  que não são da Administração), com justificativa opcional.
- A solicitação (`solicitacoes_cargo`) guarda solicitante, cargo atual, cargo
  solicitado, data e status. Uma **trava** `pendencias_cargo/{uid}`, criada no
  mesmo lote atômico, garante no servidor **uma única solicitação pendente**
  por usuário.
- A Administração é notificada (`cargo_solicitado`) e decide em
  **Administração → Solicitações de cargo**. Na aprovação, o cargo do usuário
  é alterado **no mesmo lote** que fecha a solicitação e libera a trava (as
  regras exigem isso). A rejeição mantém o cargo. Ninguém decide a própria
  solicitação.
- O solicitante recebe `cargo_decidido`; tudo é auditado
  (`solicitacao_cargo`, `aprovacao_cargo`, `rejeicao_cargo`).

### 3.4 Bloqueio / desativação
- `ativo: false` derruba a sessão em tempo real (`subscribeProfile` no
  `AuthContext`) e todas as regras do Firestore/Storage passam a recusar o
  usuário. Cadastros pendentes não podem ser "desbloqueados": só a aprovação,
  com definição de cargo, ativa um convidado.
- A Administração não altera o próprio cargo nem se bloqueia (UI + regras),
  evitando auto-bloqueio.

### 3.5 Exclusão de usuários (somente Administração)
- Em **Administração → Usuários**, com **confirmação obrigatória**; a própria
  conta não pode ser excluída (UI + regras). A exclusão é auditada.
- O Firebase Auth não permite apagar a conta de autenticação de terceiros pelo
  SDK client; sem o perfil, porém, o acesso aos dados é negado. Se a pessoa
  entrar novamente, ela volta como **Convidado pendente** (novo pedido de
  acesso). Para remoção definitiva do Auth, use o Firebase Console.

## 4. Segurança aplicada

| Falha anterior | Correção |
| --- | --- |
| Sem regras no Firestore — qualquer pessoa com a API key escrevia em `users` e virava `admin` | `firestore.rules` com RBAC server-side em todas as coleções |
| Superusuário com credenciais fixas no código | Removido; conta administrativa criada manualmente (seção 5) |
| Cadastro público permitia escolher/indicar o cargo | Formulário sem cargo; autocadastro sempre `convidado` pendente, validado nas regras |
| Leitura liberada para qualquer autenticado (inclusive pendentes/bloqueados) | Leituras exigem conta operacional (`canConsultar()`), também no Storage |
| Regra de `update` em `users` exigia o **alvo** ativo (aprovação de pendentes falhava no servidor) | Administração decide cadastros pendentes; transições validadas (`decisaoCadastroValida`) |
| Aviso de novo cadastro dependia de listar todos os usuários (negado ao visitante) | Convidado pendente consulta apenas `perfil == 'admin'`; notificação validada por tipo/remetente |
| Admin criava usuário com senha digitada e sem troca obrigatória | Senha temporária gerada por CSPRNG, exibida uma vez, troca obrigatória no 1º acesso |
| Coleção `tipos` sem regra (leitura negada por padrão) | Regras de CRUD equivalentes às de `categorias` |
| Logs podiam ser forjados/apagados | Autoria própria obrigatória, carimbo do servidor (`request.time`), campos de segredo recusados, leitura só `admin`, update/delete negados |

## 5. Bootstrap da conta Administradora

Como não há credenciais fixas no código, a primeira conta `admin` é criada
**manualmente uma única vez**:

1. No [Firebase Console](https://console.firebase.google.com) do projeto
   (`retool-c25a9`), em **Authentication → Users → Add user**, crie a conta
   (ex.: `admin@suaempresa.com`) com senha forte.
2. Copie o **UID** gerado.
3. Em **Firestore Database**, crie o documento `users/{UID}` com:
   ```json
   {
     "uid": "{UID}",
     "email": "admin@suaempresa.com",
     "nome": "Administradora ReTool",
     "perfil": "admin",
     "ativo": true,
     "statusAprovacao": "aprovado",
     "criadoEm": "2026-09-16T00:00:00.000Z"
   }
   ```
4. Pronto: faça login na aplicação com essas credenciais e use
   **Administração** para criar/aprovar todos os demais usuários.

> Contas existentes sem `statusAprovacao` continuam válidas: ativas são tratadas
> como aprovadas; o formato antigo de cadastro pendente (Gerência inativa com
> `perfilSolicitado`) aparece em *Cadastros pendentes*.

## 6. Fluxo de Reutilização (máquina de estados)

Status (`src/domain/entities/reutilizacao.ts`), espelhados nas regras do
Firestore (`TRANSICOES_REUTILIZACAO` ⇄ `firestore.rules`):

```
Em análise (Engenharia) ──(Engenharia: Solicitar Análise · 1º filtro)──▶ Em análise (Projetista)
Em análise (Projetista) ──(Projetista)──▶ Reutilização aprovada | Reutilização não aprovada
Reutilização não aprovada ──(Engenharia)──▶ Aguardando novo filtro (Projetista)
Reutilização aprovada ──▶ estado final (solicitante notificado)
Aguardando novo filtro (Projetista) ──(Projetista · 2º filtro)──▶
      similar encontrado → Em análise (Projetista)
      sem similar       → Liberado para fabricação (novo dispositivo)
```

- **Fila do Projetista** (UI): `Em análise (Projetista)` + `Aguardando novo filtro (Projetista)`.
- **Fila da Engenharia** (UI): `Em análise (Engenharia)` (rascunhos) +
  `Reutilização aprovada`/`Reutilização não aprovada` (retornos da análise).
- Registros legados (`pendente/aprovado/rejeitado`) são normalizados na
  leitura para os novos estados.

## 7. Notificações

Coleção `notifications` (um documento por destinatário, `destinatarioUid`),
com **ids determinísticos** (`tipo_entidade_destinatario`) que impedem
duplicatas por construção. Estado de leitura (`lida`) e resolução
(`resolvida`) alteráveis apenas pelo destinatário.

| Tipo | Quando | Destinatário | Remetente validado nas regras | Ação ao clicar |
| --- | --- | --- | --- | --- |
| `reutilizacao_nova` | Solicitação de reutilização enviada | admin/projetista | conta operacional | Abre `/reutilizacoes` com destaque |
| `reutilizacao_decidida` | Decisões do fluxo de reutilização | Solicitante | conta operacional | Abre `/reutilizacoes` com destaque |
| `conta_nova` | Novo cadastro (Convidado pendente) | Administração | o próprio convidado pendente | Abre *Cadastros pendentes* com destaque |
| `conta_decidida` | Cadastro aprovado/recusado | Solicitante | Administração | Marca como lida |
| `cargo_solicitado` | Pedido de alteração de cargo | Administração | autor da solicitação | Abre *Solicitações de cargo* com destaque |
| `cargo_decidido` | Pedido aprovado/rejeitado | Solicitante | Administração | Marca como lida |

- O **status exibido é derivado em tempo real** da entidade referenciada
  (reutilização, usuário ou solicitação), então a notificação acompanha o
  fluxo sem escritas extras.
- O sino mostra o contador de não lidas, o total **aguardando ação** (itens
  administrativos ainda pendentes, com botão *Analisar*) e *Marcar todas como
  lidas*. O menu **Administração** exibe o total de pendências.

## 8. Deploy das regras e índices

```bash
cd retool
npm run build
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

`firestore.indexes.json` declara os índices compostos usados pelos filtros da
tela de histórico (ação, usuário, recurso e resultado combinados com a
ordenação por data). Sem eles, filtros combinados exibem um aviso na tela.

## 9. Trilha de auditoria (Histórico de ações)

Coleção `audit_logs`: registro imutável (update/delete negados nas regras) de
todas as ações relevantes do sistema.

**Campos:**

| Campo | Conteúdo |
| --- | --- |
| `usuarioUid` / `usuarioNome` / `usuarioEmail` / `usuarioPerfil` | Quem executou a ação (autoria validada: sempre o próprio usuário autenticado) |
| `acao` / `categoria` | Tipo da ação (token estável) e seu agrupamento: `autenticacao`, `usuarios`, `dados`, `fluxo` |
| `acaoDescricao` | Ação realizada em texto legível (ex.: "Aprovou o cadastro de Ana com o cargo Projetista") |
| `tipoEntidade` / `entidadeId` / `entidadeNome` | Recurso afetado e seu identificador |
| `resultado` | `sucesso`, `falha` ou `negado` (ausente no acervo legado = sucesso) |
| `conteudo` / `dadosAnteriores` | Informações adicionais em JSON (ids, motivos, valores anteriores/novos) |
| `dataHora` / `dataHoraServidor` | ISO ordenável + carimbo nativo do servidor (exigido igual a `request.time`) |

**Ações registradas:** login (inclusive acesso recusado), logout, cadastro,
aprovação/rejeição de usuário, criação de usuário, troca de senha (sucesso e
falha), solicitação/aprovação/rejeição de cargo, alteração direta de cargo,
bloqueio/desbloqueio, exclusões, todo o CRUD industrial, transições do fluxo
de reutilização e importações. Tentativas de aprovar/rejeitar cadastros,
criar contas ou decidir solicitações de cargo sem permissão são registradas
com `resultado: 'negado'`; falhas nessas operações, com `resultado: 'falha'`.

**Segredos nunca são gravados:** `sanitizarDadosAuditoria` remove
recursivamente campos de senha, token, hash, credencial e chaves antes da
escrita, e as regras recusam campos de segredo no registro.

**Tela exclusiva da Administração:** **Administração → Histórico de ações**
(`/administracao/logs`), com paginação por cursor no servidor, total por
agregação, filtros por categoria, ação, usuário, recurso, falhas e período,
busca na página, detalhes em JSON e aviso em tempo real de novos registros.
A rota é protegida (`RoleRoute`) e as regras só permitem leitura a `admin`.

## 10. Testes

| Comando | O que cobre |
| --- | --- |
| `npm test` | Domínio (perfis, situação da conta, auditoria, senha temporária, solicitações), casos de uso dos fluxos A, B e C sobre os repositórios com Firestore em memória, paginação/filtros do histórico |
| `npm run test:rules` | **Regras do Firestore no emulador oficial** (requer Java 11+): autocadastro, aprovação, alteração de cargo, senha temporária, auditoria e operações administrativas — incluindo tentativas diretas pela API |

## 11. Desenvolvimento local com emuladores

Para testar os fluxos sem tocar em dados ou contas reais:

```bash
cd retool
npm run emuladores                 # terminal 1: auth, firestore e storage locais
node scripts/semearEmulador.mjs    # cria contas demo (admin e engenharia)
npm run dev:emuladores             # terminal 2: app apontando para os emuladores
```

As credenciais de demonstração estão em `scripts/semearEmulador.mjs` e só
existem no emulador local (projeto `demo-retool`).
