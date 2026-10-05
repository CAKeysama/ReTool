# Desempenho com grandes volumes

Como o ReTool se mantém rápido com milhares de dispositivos, quanto cada tela
custa no Firestore e o que fazer quando o volume crescer.

Referências de volume usadas nas medições:

- produção: cerca de 13.400 dispositivos;
- arquivo oficial de importação: 472.976 linhas e 19.621 combinações
  Código + Dispositivo;
- plano gratuito do Firebase (Spark), com cota diária de cerca de 50 mil
  leituras e 20 mil escritas (na prática, cerca de 17 mil operações por dia
  no uso atual).

Todas as medições foram feitas com dados sintéticos no emulador do Firestore
(projeto `demo-retool`), nunca no banco publicado, com a CPU do navegador
desacelerada 4 vezes (equivale a um notebook corporativo modesto).

## Resultado

| Medida (13.400 dispositivos) | Antes | Depois |
|---|---|---|
| Leituras ao abrir a lista de dispositivos | 14.269 | 69 |
| Leituras ao reabrir o app e buscar | 14.269 | 29 |
| Primeira linha visível em /dispositivos | 3,96 s | 1,27 s |
| Lista logo após o login | vazia (bug) | 13.400 cadastrados, 0,31 s |
| Tempo de resposta por tecla na busca (média / pior) | 383 / 456 ms | 39 / 104 ms |
| Opção "Tudo" (13.400 linhas no DOM) | travava 29,3 s, 217 mil nós | removida; lista paginada e virtualizada |
| Autocomplete da Home | 7,4 s, 13.400 sugestões no DOM | 9 sugestões, pior evento 48 ms, nenhuma tarefa longa |
| Próxima página | (tudo em memória) | 168 ms |
| JavaScript inicial (gzip) | 357 KB | 223 KB, `xlsx` só dentro do Worker |
| Processar a planilha oficial (472.976 linhas) | 33,3 s com a tela travada | 11,8 s em segundo plano, maior bloqueio da tela 33 ms |
| Reimportar planilha igual ao banco (369.600 linhas, 15.400 combinações) | 1 leitura por dispositivo + regravava tudo | 51 leituras, 0 dispositivos regravados, 0,9 s |
| Importar 2.000 novos sobre 13.400 iguais | idem | 159 leituras, 2.000 gravações, 33 s |

Os números da importação ponta a ponta estão em
[IMPORTACAO_DISPOSITIVOS.md](IMPORTACAO_DISPOSITIVOS.md#desempenho-e-custo-arquivos-grandes).

## Causas encontradas

1. **Coleções inteiras em tempo real.** Ao abrir o app, o contexto assinava
   `dispositivos`, `reutilizacoes`, `categorias`, `familias`, `produtos` e
   `audit_logs` inteiras. Cada abertura custava uma leitura por documento,
   e cada alteração feita por qualquer pessoa reenviava dados para todos.
2. **Filtro e busca no navegador** sobre a coleção inteira, a cada tecla.
3. **Renderização de tudo**: a opção "Tudo" e o autocomplete da Home
   colocavam todas as linhas no DOM.
4. **Importação na thread principal**: ler o .xlsx travava a tela, e a
   comparação com os existentes relia a coleção inteira.
5. **Código carregado de uma vez**: `xlsx`, Storage e todas as telas no
   pacote inicial.

## Arquitetura

### Lista de dispositivos: paginação no servidor

- `useListaDispositivos` busca uma página por vez: `orderBy(documentId())`,
  `limit(n + 1)` e cursor pelo id do último documento. O documento extra
  diz se há próxima página sem outra consulta.
- O filtro por categoria é feito no servidor (`where categoriaId ==`).
- O total vem de `count()` (1 leitura a cada 1.000 documentos), guardado por
  60 s e refeito quando o próprio app grava.
- A página atual fica em tempo real (só os documentos dela).
- Página e cursores ficam guardados por filtro: voltar dos detalhes mantém a
  página; busca, categoria, processo e tamanho da página ficam na URL; a
  rolagem é restaurada.
- Clicar duas vezes em "Próxima" não pula páginas (só avança quando o cursor
  da página atual já existe).

### Busca por trecho: catálogo de busca

O Firestore não busca por trecho de texto. Em vez de baixar a coleção, o app
mantém um catálogo compacto em `indices/dispositivos`:

- **Meta** (`indices/dispositivos`): `{partes, versoes, total, geracao,
  atualizadoEm}`.
- **Partes** (`indices/dispositivos/partes/{n}`): `{itens: {id: entrada}}`,
  com nome, código, descrição, categoria, processo e status de cada
  dispositivo. Cada id vai para uma parte fixa (hash FNV-1a do id). A
  reconstrução divide em cerca de 750 itens por parte (até 200 partes) e
  mira em cerca de 250 KB por parte, longe do limite de 1 MiB por documento.
  Campos longos são cortados em 2.000 caracteres. **As partes só são
  redivididas quando o catálogo é reconstruído**: entre reconstruções, novos
  dispositivos engordam as partes existentes. Por isso a tela de Dispositivos
  sugere "Atualizar índice" quando uma parte passa de ~600 KB (medido no
  navegador ao montar o catálogo) ou de 1.500 itens; toda importação que lê o
  banco já refaz o catálogo no fim, sem leituras extras. Sem nenhuma
  reconstrução, as gravações começariam a falhar perto de 90 mil
  dispositivos (com 18 partes).
- **Gravação junto**: criar, editar, excluir, desativar em massa e importar
  atualizam a parte correspondente no **mesmo writeBatch** do dispositivo
  (uma operação por parte tocada, mais a meta). Se a meta não puder ser lida,
  a gravação falha em vez de deixar o catálogo para trás.
- **No navegador** (`IndiceBuscaStore`): cache em IndexedDB; baixa só as
  partes cuja versão mudou; só escuta a meta enquanto alguém usa a busca
  (campo focado, filtros abertos ou texto digitado) e pausa 30 s depois;
  monta as entradas em blocos de 2.000 com pausas para a tela não travar.
- **Primeira vez**: depois de publicar, uma Administradora ou Projetista
  clica em **"Criar índice de busca"** na tela de Dispositivos. Isso lê todos
  os dispositivos uma vez (cerca de 13.400 leituras e 20 escritas hoje). Se
  alguém gravar fora do app, a tela compara `meta.total` com o `count()` e
  oferece **"Atualizar índice"**. A reconstrução confere as versões antes e
  depois da leitura e desiste se alguém gravou no meio; se alguém gravar
  enquanto as partes novas estão sendo escritas (poucos segundos), o catálogo
  novo é publicado e a tela pede para atualizar de novo, porque essa
  alteração pode ter ficado de fora.

Custo da busca: 1 leitura da meta + as partes que mudaram desde a última
visita (18 partes na primeira vez em um navegador, com 13.400 dispositivos).

### Categorias, famílias e produtos: catálogo de classificações

`indices/classificacoes` guarda as três listas num documento só. Abrir o app
custa 1 leitura do documento + 3 `count()` para conferir que ele bate com as
coleções (antes: cerca de 520 leituras). Toda gravação feita pelo app muda a
coleção e o catálogo no mesmo writeBatch. Se o catálogo faltar ou não bater,
o app volta a ler as coleções e quem pode editar o recria.

### Outras leituras sob demanda

- Logs de auditoria: só com o modal aberto (100 mais recentes).
- Status nas notificações: só ao abrir o painel, só das notificações listadas.
- Nomes de dispositivos em Reutilizações: catálogo ou leitura por id das
  linhas visíveis.
- Notificações: as 50 mais recentes da pessoa (índice composto
  `destinatarioUid` + `dataHora`).
- Propagação de imagens por Número da Peça: consulta `codigo in [original,
  sem espaços, MAIÚSCULAS, minúsculas]` (até 500); se o catálogo de busca já
  estiver carregado na sessão, ele também aponta grafias mistas ("Abc",
  " abc "), lidas por id. Sem catálogo carregado, uma grafia mista não
  recebe a imagem automaticamente.
- Lista de usuárias: só depois do login.

### Renderização

- Lista de ações em massa virtualizada (`VirtualList`): só as linhas visíveis
  existem no DOM, com navegação por teclado e seleção anunciada a leitores de
  tela.
- Histórico de reutilizações paginado (25 por página); filas em blocos de 50
  ("Mostrar mais").
- Busca com espera de digitação (debounce) e proteção contra resposta antiga.

### Importação

Detalhes em [IMPORTACAO_DISPOSITIVOS.md](IMPORTACAO_DISPOSITIVOS.md). Resumo:

- leitura do .xlsx num Web Worker, com progresso real e cancelamento;
- existentes sempre lidos do servidor, em páginas de 1.000 (1 leitura por
  dispositivo); o catálogo não é usado como fonte, porque é gravável por
  quem edita e não prova o conteúdo atual de cada documento;
- no fim, o catálogo é refeito a partir dessa leitura (sem leituras extras);
- linhas iguais ao banco não são regravadas;
- catálogo atualizado lote a lote, no mesmo writeBatch;
- para no primeiro lote recusado por cota (`resource-exhausted`) e pode ser
  retomada no dia seguinte com o mesmo arquivo.

### Código sob demanda

Telas e modais com `React.lazy`, protegidos por um limite de erro
(`LimiteDeErro`): se um arquivo não carregar (rede instável ou nova
publicação), a página recarrega uma vez sozinha; senão mostra "Tentar
novamente". As telas principais são pré-carregadas no tempo ocioso depois do
login. `xlsx` só existe dentro do Worker; Storage só carrega ao enviar ou
apagar arquivos.

## Experiência durante o carregamento

- Esqueletos em listas, detalhes, formulário e modais.
- Estados distintos: carregando, vazio, sem resultados, erro, tempo esgotado,
  sem permissão e cancelado (`EstadoDados`).
- Botões travados durante a ação; sucesso só depois da confirmação do banco.
- Gravações de um clique com prazo de 15 s: sem resposta, a tela diz que a
  conexão pode estar fora e que a gravação pode ser concluída quando ela
  voltar (o Firestore mantém a gravação pendente), pedindo para conferir.
- Ações em massa mostram a etapa ("Lendo dados atuais", "Gravando lote 2 de
  9", "Excluindo"); excluir mais de 50 itens exige digitar EXCLUIR; o aviso
  mostra quantos selecionados estão fora da busca; anexos são apagados em
  segundo plano.
- Aviso ao fechar a aba durante importação ou ação em massa.
- Lista mostrada a partir do cache local (sem conexão) vem com aviso.

## Observabilidade

`src/data/observabilidade/metricas.ts` registra, só no navegador e sem dados
pessoais, o nome de cada consulta, quantos documentos trouxe, o tempo e o
código do erro, além do tempo de trabalhos pesados (montar o catálogo, por
exemplo). No console: `__retoolPerf.resumo()`. Com
`localStorage.retoolPerf = '1'` as medições também são impressas no console.
Nenhum conteúdo de documento, e-mail ou nome é registrado.

## Segurança

Nada de autorização foi movido para o cliente. As regras novas
(`firestore.rules`):

- `indices/dispositivos`: leitura para quem está logado; criar e alterar
  para quem pode editar, com validação dos campos da meta (`partes` inteiro
  entre 1 e 200, `versoes` mapa com até 200 chaves, `total` inteiro >= 0,
  sem campos extras); excluir só Administradora. Partes: id numérico menor
  que 200, só o campo `itens`, até 5.000 itens.
- Limite conhecido: as regras não medem o conteúdo de cada item. Quem pode
  editar dispositivos consegue gravar um catálogo inútil ou pesado; o
  estrago máximo é cada navegador baixar até 200 partes uma vez (200
  leituras) e a busca mostrar dados errados até alguém clicar em "Atualizar
  índice". Os dispositivos em si não são afetados, e nenhuma decisão de
  permissão usa o catálogo. Fechar isso exige Cloud Functions (plano pago).
- O catálogo e a lista de usuárias são legíveis por qualquer conta logada,
  como já eram as coleções de origem.
- `indices/classificacoes`: mesmas permissões, só os campos `categorias`,
  `familias`, `produtos` e `atualizadoEm`.

## Limites e quando agir

| Situação | Limite | O que fazer |
|---|---|---|
| Reconstruir o catálogo ("Atualizar índice") | lê todos os dispositivos: 1 leitura por dispositivo | no plano gratuito (~50 mil leituras/dia) só cabe até cerca de 40 mil dispositivos, num dia sem importação. Acima disso, Cloud Functions no plano Blaze |
| Tamanho das partes | 1 MiB por documento; partes só são redivididas na reconstrução | a tela sugere "Atualizar índice" a partir de ~600 KB numa parte ou 1.500 itens por parte; toda importação refaz o catálogo |
| Download do catálogo na primeira busca | cresce com o total (≈ 1 leitura a cada 750 dispositivos; 18 partes hoje) | aceitável até dezenas de milhares; acima disso, busca no servidor (próximos passos) |
| Custo de uma edição | 1 escrita do dispositivo + 1 da parte + 1 da meta + 1 da auditoria; até 2 leituras (meta e, com imagem, a linha do mesmo Número da Peça) | antes eram 2 escritas, mas abrir o app lia a coleção inteira |
| Reutilizações | a tela ainda assina a coleção inteira (301 leituras no teste) | paginar no servidor depois de migrar os status antigos (ver abaixo) |
| Gravação de importações grandes | o SDK do Firestore processa cada lote de ~480 documentos de uma vez: com CPU 4x mais lenta, tarefas de até ~1,3 s durante a gravação (processar a planilha não trava) | lotes menores reduziriam as pausas, mas cada lote também grava as partes do catálogo (+~19 escritas por lote), o que pesa na cota; mantido |
| Cota diária | ~17 mil operações | importação grande pode precisar de dois dias; criar o índice custa ~13.400 leituras e reimportar também (os existentes são lidos do servidor), então não faça os dois no mesmo dia |

## Publicação

1. `firebase deploy --only firestore:rules,firestore:indexes` (ou o
   `npm run deploy` de sempre). O `firebase.json` agora aponta para
   `firestore.indexes.json`, que só isenta de indexação os mapas grandes do
   catálogo. Se o console perguntar se deve apagar índices compostos que não
   estão no arquivo, responda **não** e acrescente-os ao arquivo.
2. Uma Administradora ou Projetista abre Dispositivos e clica em **"Criar
   índice de busca"** (uma vez).

## Próximos passos

1. **Reutilizações paginadas no servidor.** Hoje a tela filtra os status no
   navegador porque há documentos com status antigos ou ausentes; consultar
   por status no servidor perderia esses registros. Migrar os status e então
   paginar.
2. **Ids determinísticos na importação** (a partir de Código + Dispositivo),
   para duas importações simultâneas não criarem duplicados.
3. **Leituras exigindo usuária ativa** nas regras (hoje basta estar logada).
4. **Regra para `tipos`** ou remoção da coleção (nenhuma tela usa).
5. **Cloud Functions** (plano Blaze) para manter o catálogo no servidor e
   fazer busca por trecho sem baixar o catálogo.
