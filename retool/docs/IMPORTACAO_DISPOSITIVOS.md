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
   - devolve `inseridos`, `atualizados`, `sucesso` e `erros`. Com `erros > 0`
     o modal continua aberto informando a importação parcial; reimportar o
     mesmo arquivo grava só o que faltou (sem duplicar).

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
npm test -- planilhaDispositivos FirestoreDispositivosRepository
```

- `src/tests/application/importacao/planilhaDispositivos.test.ts` — regra,
  normalização, CSV UTF-8/Windows-1252, XLSX formatado, dimensão
  desatualizada, arquivo vazio/grande e a planilha `docs/RETOOL import test.xlsx`.
- `src/tests/data/repositories/FirestoreDispositivosRepository.test.ts` —
  chave composta na gravação, preservação de imagens, lotes de 500 com último
  incompleto, falha de lote e reimportação idempotente.

Com uma planilha real: no modal, confira se "combinações únicas" bate com a
contagem feita no Excel (ex.: Remover Duplicatas nas colunas Código e
Dispositivo) e se "linhas lidas" = total de linhas de dados; após salvar, o
aviso informa inseridos + atualizados, e o total da tela de Dispositivos deve
subir exatamente em "inseridos".
