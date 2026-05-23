# 🐛 Formulário de Reporte de Bugs - ReTool

Para garantir um desenvolvimento ágil e mitigar o tempo de inatividade (*downtime*) na fábrica da **Baldan**, adaptamos o formulário de reporte de bugs do **ReTool** para torná-lo altamente contextualizado com o escopo real da aplicação.

O script de criação do formulário foi salvo em: `retool/scripts/criarFormularioBugReTool.js` (vinculado à branch `formulario-bugs`).

---

## 🚀 O que mudou? (Melhorias e Adaptações)

O formulário original era genérico e focado em um sistema de "Gestão de Conhecimento Tácito". Adaptamos as questões para refletir o ecossistema real de **Gestão de Dispositivos e Ferramentas Industriais (Baldan / Fatec Matão)**. Veja as melhorias aplicadas:

1. **Contexto de Ativos Industriais:** 
   - A descrição do formulário agora foca nos ativos de chão de fábrica e na importância de relatar falhas para diminuir o tempo de inatividade do ferramental.
   - Adicionamos um campo opcional para identificar o **Dispositivo / Ativo específico** (como um Sensor, CLP ou Motor) que apresentou problemas, ajudando a rastrear bugs relacionados a dados específicos injetados no Firebase.

2. **Módulos Reais da Aplicação (React + Firebase):**
   - Alteramos a seleção de módulos para as telas e subsistemas reais do ReTool:
     - `Dashboard / Tela Inicial` (Busca, autocomplete e estatísticas)
     - `Lista de Dispositivos` (Visualização, paginação, filtros)
     - `Cadastro / Edição` (Modal global interceptador `AccessibleModal`)
     - `Histórico de Utilizações e Ocorrências` (A espinha dorsal de eventos do modelo Fact-Event-Rule)
     - `Parametrização de Categorias e Tipos`
     - `Sincronização / Conexão Firebase` (Persistência assíncrona com o Firestore)
     - `Toasts e Feedbacks Visuais`
     - `Atalhos de Teclado e Acessibilidade`

3. **Foco em Acessibilidade e Operação via Teclado:**
   - O ReTool é 100% operável via teclado (shortcuts globais e `FocusableList` via setas direcionais).
   - Inserimos uma pergunta crucial: **"O problema ocorreu durante a operação por teclado ou atalhos?"** para ajudar os desenvolvedores a debugar problemas nos hooks customizados `useHotkeys` ou `useKeyboardNavigation`.

4. **Ambiente / Terminais de Chão de Fábrica:**
   - No chão de fábrica, o ReTool pode rodar em coletores de dados, tablets industriais ou computadores convencionais de escritório.
   - Adaptamos a pergunta sobre o dispositivo para opções focadas no cenário fabril real.

5. **Lembrete do Paradigma "Open World Assumption":**
   - Incluímos um aviso nos campos para reforçar que o ReTool aceita dados incompletos por design. A ausência de dados não obrigatórios no cadastro nunca deve travar o fluxo.

---

## 🛠️ Como Utilizar no Google Apps Script

1. Acesse o [Google Apps Script](https://script.google.com/).
2. Crie um novo projeto.
3. Copie todo o conteúdo de [criarFormularioBugReTool.js](../scripts/criarFormularioBugReTool.js) e cole no editor do projeto.
4. Salve o projeto e selecione a função `criarFormularioBugReTool`.
5. Clique em **Executar**.
6. Conceda as permissões necessárias na sua conta Google para criar o formulário no seu Google Drive.
7. As URLs geradas de **Edição** (para desenvolvedores) e **Visualização** (para enviar aos operadores da Baldan) serão exibidas no console de execução!
