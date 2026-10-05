# Importação em Lote de Dispositivos

Importa planilhas `.xlsx` / `.csv` (modal **Importação em Lote** da tela de
Dispositivos) aplicando a regra de unicidade **Código + Dispositivo**.

## Regra de unicidade

A identidade lógica de um registro importado é o par **Código + Dispositivo**
(`codigo` + `nome`) — `chaveCodigoDispositivo()` em
`src/domain/entities/dispositivo.ts`.

| Linha A | Linha B | Resultado |
|---|---|---|
| ABC / D01 | ABC / D01 | 1 registro |
| ABC / D01 | ABC / D02 | 2 registros |
| ABC / D01 | XYZ / D01 | 2 registros |

Nenhum outro campo entra na chave. Linhas repetidas viram um registro só
(Código/Dispositivo da 1ª ocorrência, demais campos da última).

### Normalização da chave (`normalizarValorChave`)

Considerados **iguais** (diferença só de representação): espaços nas pontas,
espaços repetidos / tab / NBSP, caracteres invisíveis (zero-width, BOM),
forma Unicode (NFC × NFD) e maiúsculas/minúsculas — mesmo critério de
`normalizarNumeroPeca()` e do "Remover Duplicatas" do Excel. O número `123`
e o texto `"123"` também são iguais.

Considerados **diferentes**: zeros à esquerda (`0041` ≠ `41`), casas decimais
exibidas (`1.10` ≠ `1.1`), acentos (`PEÇA` ≠ `PECA`) e qualquer outro
caractere visível. A chave é serializada como tupla JSON, então nenhum
separador pode colidir.

## Fluxo

1. **Leitura** — `lerPlanilha()` (`src/application/importacao/planilhaDispositivos.ts`):
   - CSV é decodificado explicitamente (UTF-8 com/sem BOM, senão Windows-1252)
     e lido como texto puro: `0041` continua `0041` e o cabeçalho `Código`
     não vira `CÃ³digo`.
   - XLSX: número com formato explícito (`00000`, `0.00`, data) usa o texto
     exibido; número em formato Geral usa o valor completo (o texto do Geral
     abrevia códigos longos para `5.04001E+13`).
   - O intervalo da aba é calculado pelas células existentes, não pela tag
     `<dimension>` do arquivo (que pode estar desatualizada e cortar linhas).
2. **Processamento** — `processarPlanilhaDispositivos()`: reconhece colunas
   ignorando acento/caixa/pontuação (`Código`, `codigo`, `Código Peça`,
   `Nº Dispositivo`…), aplica a regra acima com `Map` (O(n)) e devolve um
   `resumo`: linhas lidas, combinações únicas, repetições removidas, linhas
   sem chave e avisos (ex.: coluna Código não encontrada numa aba).
3. **Pré-visualização** — o modal mostra o resumo, a coluna usada como Código
   e como Dispositivo em cada aba e os avisos antes de salvar.
4. **Gravação** — `FirestoreDispositivosRepository.importarLote()`:
   - um documento existente só é atualizado se tiver a **mesma** combinação
     Código + Dispositivo; caso contrário, cria um novo documento;
   - imagens já cadastradas não são apagadas ao atualizar;
   - grava em lotes de 500 (inclusive o último, incompleto); falha num lote
     não interrompe os demais e é devolvida em `erros`/`falhas`;
   - documento existente cujos campos importados já estão iguais **não é
     regravado** (`ignoradosSemAlteracao`);
   - devolve `inseridos`, `atualizados`, `ignoradosSemAlteracao`, `sucesso`,
     `erros` e, se parou antes do fim, `interrompido` (`'cancelado'` ou
     `'cota'`) e `naoGravados`. Reimportar o mesmo arquivo grava só o que
     faltou (sem duplicar).

Detalhes de desempenho e custo na seção abaixo.

## Desempenho e custo (arquivos grandes)

Referência: arquivo oficial com 472.976 linhas e 19.621 combinações
Código + Dispositivo; banco com ~13.400 dispositivos; plano gratuito (Spark)
com cota diária de operações do Firestore (~17 mil operações no uso do cliente).

### Como a importação é feita

| Etapa | Onde roda | Progresso | Cancelamento |
|---|---|---|---|
| Lendo arquivo (descompactar o .xlsx) | Web Worker (`planilhaDispositivos.worker.ts`) | indeterminado (a biblioteca faz numa chamada só) | encerra o Worker |
| Processando (linhas → regra Código + Dispositivo) | Web Worker | linhas feitas / total, a cada 5.000 | encerra o Worker |
| Lendo dispositivos existentes | thread principal, Firestore paginado | documentos lidos / total estimado (catálogo de busca já carregado; sem ele, indeterminado) | entre páginas — nada foi gravado ainda |
| Gravando | thread principal, `writeBatch` de até 500 operações | registros / total + "Lote N / M" | entre lotes — o que já foi gravado fica |

- **Worker**: o `ArrayBuffer` do arquivo é transferido (sem cópia) e a
  biblioteca `xlsx` só é carregada dentro do Worker. Se o navegador não tiver
  Worker, o mesmo código roda na thread principal (fallback) — mesmo
  resultado, mas a tela fica ocupada durante o processamento. O resultado do
  Worker e do fallback é idêntico ao do processamento anterior (teste de
  paridade célula a célula em `processamentoPlanilha.test.ts`).
- **Leitura mais rápida**: modo denso (`dense: true`) e texto formatado
  calculado só nas células com formato numérico explícito, com cache por
  formato. Medido em node com 472.976 linhas sintéticas (8 colunas, .xlsx
  de 55 MB): processamento anterior 33,3 s; atual 11,9 s. No Worker o maior
  bloqueio da thread principal foi de 33 ms (contra 11,9 s no fallback e
  33,3 s antes), com 191 avisos de progresso.
- **Leitura dos existentes paginada**: `orderBy(documentId())` + `limit(1000)`
  + `startAfter`, em vez de um `getDocs` da coleção inteira. O custo em
  leituras é o mesmo (1 por documento), mas há progresso, cancelamento e
  nenhuma resposta gigante. O estado final (`documentosFinais`) é devolvido ao
  contexto para refazer o catálogo de busca sem reler a coleção.
- **Planejamento** (`planejarGravacao`, `gravacaoDispositivos.ts`): compara,
  para cada combinação, os campos que seriam gravados com o documento atual
  (vazio = ausente; imagens vazias da planilha não contam nem apagam).
  ~80 ms para 19.621 registros × 13.400 existentes.

### Custo em operações do Firestore

- **Leituras**: com o catálogo de busca em dia (`entradas === count()`), os
  existentes vêm do catálogo: 1 leitura da meta, as partes que mudaram desde
  a última visita (no máximo uma por parte; 18 partes com ~13.400
  dispositivos) e o `count()` (1 leitura a cada 1.000 documentos). Sem
  catálogo, ou com catálogo divergente, a leitura é paginada: 1 por documento.
- **Escritas**: só registros **novos ou alterados** (+ categorias, famílias e
  produtos novos), mais, por lote, uma operação em cada parte do catálogo
  tocada e a meta. Lotes de até 500 operações; o tamanho do lote encolhe para
  caber as operações do catálogo.

Medido pela tela, ponta a ponta, no emulador (build de produção, planilha de
369.600 linhas e 15.400 combinações; banco com 13.400 dispositivos iguais):

| Cenário | Leituras | Escritas | Tempo de gravação |
|---|---|---|---|
| Primeira importação: 13.400 iguais + 2.000 novos | 159 | 2.000 dispositivos + catálogo + 1 auditoria | 33 s |
| Reimportar o mesmo arquivo (tudo igual) | 51 | 1 (auditoria) | 0,9 s |

O processamento da planilha (no Worker) levou cerca de 7 s em cada rodada.

Estimativa para o arquivo oficial (19.621 combinações) sobre o banco
publicado (~13.400):

| Cenário | Antes | Agora |
|---|---|---|
| Reimportar sobre banco já igual | 13.400 leituras + 19.621 escritas = **33.021** (estoura a cota) | ~50 leituras + **0** escritas de dispositivos |
| Banco com 13.400 iguais + 6.221 novos | 33.021 | ~160 leituras + 6.221 escritas + ~13 lotes × (até 19 operações do catálogo) |
| Catálogo ausente ou divergente | 33.021 | 13.400 leituras + só os novos/alterados (+ reconstrução do catálogo: ~20 escritas) |

### Cota esgotada (`resource-exhausted`)

A importação **para imediatamente** no primeiro lote recusado por cota
(não insiste nos seguintes, que também falhariam). Como o `writeBatch` é
atômico, o lote recusado não fica pela metade. O resultado vem com
`interrompido: 'cota'` e `naoGravados`; o modal mostra quantos foram
gravados, ignorados sem alteração e não gravados. Se a cota acabar ainda na
leitura dos existentes, nada é gravado. Para completar: importar o **mesmo
arquivo** no dia seguinte — o que já foi gravado é reconhecido pela chave
Código + Dispositivo e pulado por estar igual (sem duplicar e sem gastar
escrita).

### Cancelamento

O botão **Cancelar** do modal encerra o Worker na leitura/processamento; na
gravação, aborta (`AbortSignal`) antes do próximo lote — o lote em andamento
termina. Resultado: `interrompido: 'cancelado'` com `naoGravados`; o que já
foi gravado continua salvo e reimportar completa. Durante a gravação o botão
Importar fica travado e o modal não fecha (use Cancelar).

## Bug corrigido: combinações perdidas na importação

Relato: base de 472.976 linhas, esperadas 19.621 combinações únicas,
importadas 18.532 (−1.089). Mecanismos encontrados no fluxo antigo:

- **Gravação casava por Código sozinho (ou Dispositivo sozinho).** Ao
  importar numa base que já tinha dispositivos, toda linha cujo Código (ou,
  na falta, Dispositivo) já existia sobrescrevia aquele documento — mesmo
  Código com outro Dispositivo virava um único registro, e o contador
  informava sucesso para todas as linhas.
- **CSV UTF-8 sem BOM** (Google Sheets, LibreOffice): o arquivo era lido como
  binário Latin-1, o cabeçalho `Código` virava `CÃ³digo`, a coluna não era
  reconhecida e a chave caía para só o Dispositivo.
- **Conversão numérica**: em CSV, `0041`, `041` e `41` viravam o número 41;
  em XLSX, números formatados (`00041` × `0041`) eram lidos pelo valor bruto;
  `0` virava vazio.
- **`<dimension>` desatualizada** no XLSX cortava linhas silenciosamente.
- Falha de gravação no meio do processo interrompia sem informar quantos
  registros foram gravados.

## Limpeza de duplicados deixados por importações antigas

Com a gravação antiga, importar a mesma base de novo fazia vários documentos
ficarem com a mesma combinação, e a combinação original sumia. Com o arquivo
oficial (472.976 linhas, 19.621 combinações), uma 2ª importação deixava cerca
de 18.550–18.600 combinações distintas em 19.621 documentos.

Na tela **Dispositivos**, o botão **Duplicados** (somente Administradora)
abre `DuplicadosModal`, que usa `planejarLimpezaDuplicados()`:

- agrupa os documentos pela chave Código + Dispositivo e mostra o total de
  documentos, as combinações distintas e as repetidas;
- em cada grupo mantém o primeiro documento com vínculos (reutilizações,
  imagens, anexos, observações) ou, se nenhum tiver, o mais antigo;
- **nunca apaga** um repetido que tenha vínculos: ele aparece como "revisar";
- **Baixar lista (.csv)** exporta manter/remover/revisar com os ids;
- só remove depois de marcar "Revisei a lista". A remoção é feita em lotes
  de 500 e gera um registro de auditoria com os ids apagados.

Ordem recomendada: rodar a limpeza e depois importar o arquivo de novo (com a
correção), para recriar as combinações que tinham sido sobrescritas.

## Como validar novamente

```bash
npm test -- importacao FirestoreDispositivosRepository ImportarLoteUseCase
```

- `src/tests/application/importacao/planilhaDispositivos.test.ts` — regra,
  normalização, CSV UTF-8/Windows-1252, XLSX formatado, dimensão
  desatualizada, arquivo vazio/grande e a planilha `docs/RETOOL import test.xlsx`.
- `src/tests/data/repositories/FirestoreDispositivosRepository.test.ts` —
  chave composta na gravação, preservação de imagens, lotes de 500 com último
  incompleto, falha de lote, reimportação idempotente, 0 escritas sobre banco
  igual, leitura paginada, progresso, cancelamento e cota esgotada.
- `src/tests/application/importacao/gravacaoDispositivos.test.ts` — pular não
  alterados, regra Código + Dispositivo no planejamento, lotes, erro de cota.
- `src/tests/application/importacao/processamentoPlanilha.test.ts` — paridade
  Worker × fallback × processamento anterior e progresso.

Com uma planilha real: no modal, confira se "combinações únicas" bate com a
contagem feita no Excel (ex.: Remover Duplicatas nas colunas Código e
Dispositivo) e se "linhas lidas" = total de linhas de dados; após salvar, o
aviso informa inseridos + atualizados, e o total da tela de Dispositivos deve
subir exatamente em "inseridos".
