# Auto-Propagação de Imagens por Número da Peça

Uma única imagem alimenta todos os campos visuais da mesma linha de
inventário, eliminando uploads repetitivos.

## Como funciona

- **Gatilho:** salvamento bem-sucedido de um dispositivo com imagem
  (`imagemPeca` / `imagemDispositivo`) — criação ou edição via
  `DispositivoForm` (`addDispositivo` / `updateDispositivo` no
  `ReToolContext`).
- **Chave da linha:** o **Número da Peça** (`codigo`), normalizado
  (sem caixa/espaços) — `normalizarNumeroPeca()`.
- **Propagação em lote:** a imagem preenche instantaneamente todas as
  células vazias (`imagemPeca`/`imagemDispositivo`) dos demais dispositivos
  da mesma linha, cada campo de forma independente.
- **Herança na criação:** ao cadastrar um dispositivo novo com células
  vazias numa linha que já possui imagem, ele herda o visual existente.
- **Prevenção de sobrescrita:**
  - nunca substitui uma imagem já presente em qualquer dispositivo;
  - nunca toca dispositivos com Número da Peça diferente;
  - limpar a imagem de um dispositivo (edição com campo vazio) **não**
    dispara propagação nem re-preenchimento.

## Implementação

- Lógica pura e testada: `calcularPropagacaoImagens()` em
  `src/domain/entities/dispositivo.ts`
  (testes em `src/tests/domain/entities/dispositivo.test.ts`).
- Aplicação + auditoria: `propagarImagensPorCodigo()` em
  `src/context/ReToolContext.tsx` — cada dispositivo atualizado recebe um
  registro de auditoria ("Imagem propagada/herdada automaticamente — mesmo
  número de peça") e um aviso resume quantos dispositivos foram
  sincronizados.
