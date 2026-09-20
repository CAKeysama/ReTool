# Controle de Acesso — ReTool

Documento técnico do módulo de autenticação e autorização (RBAC) da plataforma.

## 1. Visão Geral

O controle de acesso opera em **duas camadas independentes e complementares**:

| Camada | Onde | O que impede |
| --- | --- | --- |
| **Interface (client-side)** | React (`usePermissions`, rotas, botões condicionais) | Uso indevido por usuários legítimos no fluxo normal da aplicação. |
| **Banco de dados (server-side)** | `firestore.rules` e `storage.rules` | Qualquer ataque direto à API do Firebase: escalonamento de privilégio, escrita em nome de terceiros, adulteração ou exclusão de auditoria. |

> ⚠️ **Regra de ouro:** a interface apenas *esconde* o que o usuário não pode fazer.
> A garantia real de segurança vem das **regras do Firestore/Storage** — sem elas,
> o RBAC não existe. Sempre faça o deploy das regras ao publicar a aplicação
> (`npx firebase deploy --only firestore:rules,storage`).

## 2. Perfis de Acesso (papéis)

Matriz oficial (imagem institucional *"Retool ADM – Controle de Acesso"*),
travada como teste de regressão em `src/tests/domain/entities/user.test.ts`.
Para a Engenharia, o "Solicitar" das colunas Cadastrar/Aprovar da imagem é a
ação de **solicitar reutilização** (`canSolicitar`).

Definidos em `src/domain/entities/user.ts` (`ROLES_CONFIG`):

| Papel | Consultar | Cadastrar | Editar | Excluir | Aprovar | Solicitar reutilização | Gerir usuários | Ver auditoria |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Programadora / Administradora** (`admin`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Projetista – Ferramentaria** (`projetista`) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Engenharia de Processo / Industrial** (`engenharia`) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Gerência** (`gerencia`) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

A matriz acima é aplicada nos dois lugares ao mesmo tempo:
- **UI:** `src/hooks/usePermissions.ts` + guards em páginas/modais/rotas.
- **Firestore:** funções `canCadastrar()`, `canEditar()`, `canExcluir()`,
  `canAprovar()`, `canSolicitar()` em `firestore.rules`.

## 3. Ciclo de Vida de um Usuário

### 3.1 Cadastro público (autoatendimento)
1. O colaborador cria a conta na tela de login (e-mail, senha, nome).
2. O sistema grava o perfil **sempre** como `gerencia` + `ativo: false`
   (aguardando aprovação). Não existe campo de perfil no formulário — e as
   regras do Firestore **recusam** qualquer escrita de criação que tente
   definir outro perfil ou `ativo: true` por conta própria.
3. A conta só passa a navegar no sistema depois que a Administração aprova
   ("Aprovar Acesso") e define o papel correto no modal *Gerenciamento de
   Acessos & Perfis*.

### 3.2 Provisionamento pela Administração
- Feito no modal *Gerenciamento de Acessos & Perfis* → "Cadastrar Novo Usuário".
- Utiliza uma **instância secundária do Firebase App**
  (`getSecondaryAuthApp()`), de modo que criar a conta **não substitui a
  sessão da administradora** (bug comum ao usar `createUserWithEmailAndPassword`
  na instância principal).
- O perfil já nasce com o papel escolhido e `ativo: true`, com registro em
  auditoria.

### 3.3 Bloqueio / desativação
- `ativo: false` derruba a sessão em tempo real (`subscribeProfile` no
  `AuthContext`) e todas as regras do Firestore passam a recusar escritas do
  usuário bloqueado.

### 3.4 Exclusão de usuários (somente Administração)
- Disponível no modal *Gerenciamento de Acessos & Perfis*, com **confirmação
  obrigatória** antes de excluir.
- A exclusão remove o perfil do Firestore (`allow delete: if isAdmin()` nas
  regras) e registra auditoria; a lista é atualizada em tempo real via
  `onSnapshot`.
- A própria conta não pode ser excluída (botão desabilitado), evitando
  auto-lockout.
- Observação: o Firebase Auth não permite apagar a conta de autenticação pelo
  SDK client; sem o perfil no Firestore, porém, o login é recusado e todas as
  regras do banco/storage negam acesso — a conta fica inoperante. Para
  remoção definitiva do Auth, use o Firebase Console.

## 4. Segurança aplicada (o que foi corrigido)

| Falha anterior | Correção |
| --- | --- |
| Sem regras no Firestore — qualquer pessoa com a API key escrevia em `users` e virava `admin` | `firestore.rules` com RBAC server-side em todas as coleções |
| Superusuário com credenciais fixas (`admin@retool.com`/`admin123`) no código e na tela, com auto-provisionamento | Removido por completo (`DEFAULT_SUPERUSER` extinto). Conta administrativa é criada manualmente no Firebase Console, sem credenciais no repositório |
| Cadastro público permitia escolher o próprio papel (inclusive `admin`) | Cadastro público cria apenas conta restrita (`gerencia`, inativa) sujeita a aprovação; UI sem seletor de papel + regras bloqueando a escrita |
| Admin criava usuário e era deslogado no processo | App Firebase secundário para provisionamento |
| Perfil confiável em `localStorage` (dado antigo/alterável) | Estado sempre derivado do Firestore em tempo real; cache local removido |
| Storage público para leitura/exclusão | `storage.rules` exige sessão ativa; escrita só para quem pode cadastrar; exclusão só admin |
| Logs de auditoria podiam ser forjados/apagados | Criação exige `usuarioUid == request.auth.uid` (autoatribuição, sem forjar autoria); leitura exclusiva de `admin`; update/delete negados para todos |

## 5. Bootstrap da conta Administradora

Como não há mais credenciais fixas no código, a primeira conta `admin` é
criada **manualmente uma única vez**:

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
     "criadoEm": "2026-09-16T00:00:00.000Z"
   }
   ```
4. Pronto: faça login na aplicação com essas credenciais.
5. A partir daí, use o modal de gerenciamento para criar/aprovar todos os
   demais usuários.

> Se as regras já estiverem publicadas, apenas esse bootstrap manual
> funciona — o auto-provisionamento do app cria contas restritas e inativas.

## 6. Fluxo de Reutilização (máquina de estados)

Status (`src/domain/entities/reutilizacao.ts`), espelhados nas regras do
Firestore (`TRANSICOES_REUTILIZACAO` ⇄ `firestore.rules`):

```
Em análise (Engenharia) ──(Engenharia: Solicitar Análise · 1º filtro)──▶ Em análise (Projetista)
Em análise (Projetista) ──(Projetista)──▶ Reutilização aprovada | Reutilização não aprovada
Reutilização não aprovada ──(Engenharia)──▶ Aguardando novo filtro (Projetista) | Em andamento - OS
Reutilização aprovada ──(Engenharia: Gerar OS)──▶ Em andamento - OS
Aguardando novo filtro (Projetista) ──(Projetista · 2º filtro)──▶
      similar encontrado → Em análise (Projetista)
      sem similar       → Liberado para fabricação (novo dispositivo)
```

- **Fila do Projetista** (UI): `Em análise (Projetista)` + `Aguardando novo filtro (Projetista)`.
- **Fila da Engenharia** (UI): `Em análise (Engenharia)` (rascunhos) +
  `Reutilização aprovada`/`Reutilização não aprovada` (retornos para OS).
- Registros legados (`pendente/aprovado/rejeitado`) são normalizados na
  leitura para os novos estados.

## 7. Notificações

Coleção `notifications` (um documento por destinatário, `destinatarioUid`),
com **ids determinísticos** (`tipo_entidade_destinatario`) que impedem
duplicatas por construção.

| Tipo | Quando | Destinatário | Ação ao clicar |
| --- | --- | --- | --- |
| `reutilizacao_nova` | Solicitação de reutilização criada (pendente) | Perfis que aprovam (admin/projetista) | Abre `/reutilizacoes` com a solicitação destacada |
| `reutilizacao_decidida` | Aprovação/rejeição da solicitação | Solicitante | Abre `/reutilizacoes` com a solicitação destacada |
| `conta_nova` | Cadastro público solicitando tier ≠ Gerência | Administração | Abre o gerenciamento de usuários; botões Aprovar/Recusar na própria notificação |
| `conta_decidida` | Decisão da Administração sobre a conta | Solicitante | Marca como lida |

- O **status exibido é derivado em tempo real** da entidade referenciada
  (reutilização ou usuário), então a notificação acompanha o fluxo sem
  escritas extras.
- Somente o destinatário lê as próprias notificações; só o remetente legítimo
  cria (validado nas regras por tipo e papel do destinatário).
- Ícone de sino com contador de não lidas no Layout (sidebar e fullscreen);
  clicar marca como lida e navega; botão dedicado também marca como lida.

## 8. Deploy das regras

```bash
cd retool
npm run build
npx firebase deploy --only firestore:rules,storage
```

Após o deploy, valide no console (aba *Rules → Rules Playground*) que:
- um usuário `gerencia` **não consegue** escrever em `dispositivos`;
- um usuário qualquer **não consegue** alterar o próprio `perfil`;
- apenas `admin` **lê** `audit_logs`; qualquer usuário autenticado escreve
  apenas registros com `usuarioUid` igual ao próprio uid.

## 9. Trilha de auditoria (Audit Log)

Coleção `audit_logs`: registro imutável (update/delete negados nas regras) de
todas as ações críticas do sistema.

**Campos** (equivalência com o modelo Retool):

| Campo | Conteúdo | Equivalente Retool |
| --- | --- | --- |
| `usuarioNome` / `usuarioEmail` | Quem executou a ação | `{{ current_user.fullName }}` / e-mail |
| `usuarioPerfil` | Grupo de permissões do autor | `{{ current_user.groups[0] }}` |
| `acao` / `acaoDescricao` | Token estável + rótulo legível (ex.: "Aprovou Reutilização", "Gerou OS", "Solicitou Novo Filtro") | identificação da operação |
| `conteudo` / `dadosAnteriores` | Detalhes estruturados em JSON (IDs, motivo, valores alterados) | payload da operação |
| `dataHora` / `dataHoraServidor` | `dataHora` é ISO (ordena junto com o acervo legado); `dataHoraServidor` é o carimbo nativo do servidor (`serverTimestamp`) e é o exibido na UI | `DEFAULT CURRENT_TIMESTAMP` |

**Acionamento:** cada mutação bem-sucedida (INSERT/UPDATE/DELETE) nos
repositórios chama `registrarAuditoria(...)` logo após o `await` da escrita —
o equivalente ao Event Handler *On Success* disparando a query `insert_log`
com parâmetros dinâmicos por contexto (criação/edição de dispositivos,
categorias, tipos, famílias e produtos; solicitação e todas as transições do
fluxo de reutilização; importação em lote; limpeza total; gestão de usuários).

**Acesso exclusivo da Administração:**
- UI: menu, modal e subscrição em tempo real condicionados a `canVerLogs`
  (`admin`); demais perfis nem recebem os dados em memória.
- Firestore: `get/list` em `audit_logs` apenas para `isAdmin()`.
- A tabela abre sempre ordenada do registro mais recente para o mais antigo.
