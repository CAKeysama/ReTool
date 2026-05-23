/**
 * Script para automatizar a criação do formulário de reporte de bugs oficial do ReTool.
 * Projeto: ReTool - Gestão de Dispositivos e Ferramentas Industriais (Baldan / Fatec Matão)
 * 
 * Como usar:
 * 1. Acesse o Google Apps Script (script.google.com).
 * 2. Cole este código no editor de projetos.
 * 3. Clique no botão de Executar (ícone de play) na função `criarFormularioBugReTool`.
 * 4. Autorize a execução do script na sua Conta Google.
 * 5. Os links para edição e visualização do formulário gerado serão impressos no console.
 */
function criarFormularioBugReTool() {
  // Cria o formulário com título alinhado ao escopo real do projeto
  var form = FormApp.create('ReTool - Reporte de Bug');

  // Define a descrição alinhada ao projeto Baldan/Fatec e à natureza de chão de fábrica
  form.setDescription(
    'Utilize este formulário para reportar bugs, falhas de usabilidade ou comportamentos inesperados na plataforma ReTool (Gestão de Dispositivos, Ativos e Ferramentas Industriais - Baldan / Fatec Matão).\n\n' +
    'Seus relatos ajudam a manter a integridade dos dados no chão de fábrica e a otimizar o tempo de inatividade. Por favor, forneça o máximo de detalhes possível!\n\n' +
    'Lembre-se: O ReTool foi construído sob a Suposição de Mundo Aberto (Open World Assumption) e com forte foco em Acessibilidade via Teclado.'
  );

  // 1. Resumo do Bug (Título rápido)
  form.addTextItem()
      .setTitle('Resumo do Bug')
      .setHelpText('Descreva o problema de forma concisa e direta (ex: "Tecla de atalho N não abre o modal de cadastro").')
      .setRequired(true);

  // 2. Nome e Setor do Relator (Essencial para feedbacks no chão de fábrica)
  form.addTextItem()
      .setTitle('Seu Nome e Setor / Equipe')
      .setHelpText('Exemplo: Miguel - Ferramental / Douglas - TI / Pedro - Manutenção.')
      .setRequired(true);

  // 3. Módulo/Área Afetada (Adaptado à arquitetura de Fatos/Eventos e telas reais do ReTool)
  form.addMultipleChoiceItem()
      .setTitle('Qual módulo ou tela do ReTool apresenta o problema?')
      .setChoiceValues([
        '🏠 Dashboard / Tela Inicial (Busca, autocomplete de ativos, cartões de estatísticas)',
        '🛠️ Lista de Dispositivos / Ativos (Listagem geral, paginação, filtros por código/categoria)',
        '📋 Cadastro ou Edição de Dispositivos (Formulário do modal AccessibleModal, validações)',
        '🔗 Histórico de Utilizações / Ocorrências (Linha do tempo de eventos, registros vinculados ao ativo)',
        '🏷️ Parametrização de Categorias e Tipos (Criação, ativação/desativação e exclusão)',
        '⌨️ Atalhos de Teclado e Acessibilidade (Hotkeys nativas /, P, U, C, N, Esc ou FocusableList)',
        '🔥 Sincronização e Conexão Firebase (Persistência no banco de dados Firestore, latência em tempo real)',
        '🔔 Toasts e Feedbacks Visuais (Alertas de sucesso/erro que surgem no canto inferior direito)',
        '❓ Outro / Página Sobre'
      ])
      .setRequired(true);

  // 4. Modo de Operação (Relevante devido à natureza keyboard-first do ReTool)
  form.addMultipleChoiceItem()
      .setTitle('O problema ocorreu durante a operação por teclado ou atalhos?')
      .setChoiceValues([
        'Sim, utilizando os atalhos globais de teclado (ex: /, P, U, C, N, Esc)',
        'Sim, utilizando a navegação por setas (FocusableList na lista de dispositivos)',
        'Não, ocorreu durante a navegação/operação convencional com mouse/touchpad',
        'Não se aplica / Não notei relação'
      ])
      .setRequired(true);

  // 5. Passos para Reproduzir
  form.addParagraphTextItem()
      .setTitle('Passos para Reproduzir')
      .setHelpText(
        'Descreva o passo a passo exato para que a equipe possa simular e entender o erro.\n' +
        'Exemplo:\n' +
        '1. Acessar a tela inicial (Home)\n' +
        '2. Pressionar a tecla "N" para abrir o modal de cadastro\n' +
        '3. Preencher apenas o campo "Nome" e tentar salvar\n' +
        '4. O formulário trava e nenhum aviso/toast de erro é exibido.'
      )
      .setRequired(true);

  // 6. Comportamento Esperado vs. Atual (Mundo Aberto)
  form.addParagraphTextItem()
      .setTitle('Comportamento Esperado vs. Comportamento Atual')
      .setHelpText(
        'O que deveria ter acontecido e o que realmente aconteceu?\n' +
        'Lembre-se: no ReTool, a ausência de dados não obrigatórios (ex: peso, fabricante) nunca deve travar o fluxo do operador!'
      )
      .setRequired(true);

  // 7. Nível de Gravidade / Impacto no Chão de Fábrica
  form.addListItem() // Lista suspensa (Dropdown)
      .setTitle('Nível de Gravidade e Impacto na Operação')
      .setChoiceValues([
        '🟢 Baixa (Erros de digitação, pequenos desajustes visuais, atalhos alternativos funcionam)',
        '🟡 Média (Funcionalidade importante falhou, mas existe um contorno temporário/workaround)',
        '🟠 Alta (Funcionalidade principal quebrada, impede o cadastro ou alteração de ativos sem contorno)',
        '🔴 Crítica (Sistema fora do ar, perda ou corrupção de dados no Firebase, impede totalmente a operação)'
      ])
      .setRequired(true);

  // 8. Dispositivo / Ativo Afetado (Opcional - Útil para debugar inconsistências em dados de ativos reais)
  form.addTextItem()
      .setTitle('Código ou Nome do Dispositivo Afetado (Opcional)')
      .setHelpText('Se o bug ocorreu ao interagir com um ativo específico, informe o código Baldan ou nome dele (ex: "CLP-02", "Sensor Indutivo").')
      .setRequired(false);

  // 9. Ambiente de Execução e Terminal Industrial
  form.addMultipleChoiceItem()
      .setTitle('Qual dispositivo/ambiente você estava usando?')
      .setChoiceValues([
        '💻 Computador de mesa / Notebook de escritório',
        '📟 Coletor de Dados ou Terminal Industrial de Chão de Fábrica',
        '📱 Tablet Industrial ou Smartphone corporativo',
        'Outro'
      ])
      .setRequired(true);

  // 10. Evidências (Links)
  form.addTextItem()
      .setTitle('Links para Evidências (Opcional)')
      .setHelpText('Cole aqui o link de um vídeo (ex: Loom) ou imagem/screenshot (Google Drive) com a evidência do bug no console ou na tela.');

  // Registra as URLs de controle e visualização no console do Google Apps Script
  Logger.log('========================================================================');
  Logger.log('✅ Formulário de Bug ReTool criado com sucesso!');
  Logger.log('✏️ URL para EDIÇÃO (Apenas desenvolvedores/admin):');
  Logger.log(form.getEditUrl());
  Logger.log('------------------------------------------------------------------------');
  Logger.log('🚀 URL de RESPOSTA (Enviar para os usuários/operadores Baldan):');
  Logger.log(form.getPublishedUrl());
  Logger.log('========================================================================');
}
