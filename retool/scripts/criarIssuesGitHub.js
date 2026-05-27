import { spawnSync } from 'child_process';

const requiredLabels = [
  { name: "enhancement", color: "a2eeef", description: "Melhoria ou nova funcionalidade" },
  { name: "UI", color: "007acc", description: "Interface do Usuário (User Interface)" },
  { name: "UX", color: "8f39fc", description: "Experiência do Usuário (User Experience)" },
  { name: "backend", color: "d13b40", description: "Lógica interna e backend" },
  { name: "performance", color: "ff9800", description: "Otimizações de performance e velocidade" },
  { name: "feature", color: "4caf50", description: "Nova funcionalidade implementada" },
  { name: "data", color: "009688", description: "Tratamento de dados e inteligência" },
  { name: "data-cleanup", color: "795548", description: "Saneamento e padronização de dados" }
];

const issues = [
  // Milestone 1: Identidade e UX Base
  {
    title: "Configurar Logotipo e Branding no Cabeçalho",
    body: `Utilizar o componente 'Header' nativo do Retool para incluir o logo oficial da Baldan/Portal, garantindo a identidade visual corporativa.

**Critérios de Aceite:**
- [ ] Logo oficial posicionado no canto superior esquerdo.
- [ ] Validação com o usuário final sobre a posição de um logo secundário (se fica no rodapé ou menu lateral).
- [ ] Design limpo e minimalista, utilizando os componentes nativos para manter a performance.`,
    labels: "enhancement,UI",
    milestone: "v0.2.0 - UX Base"
  },
  {
    title: "Configurar Favicon e Metadados (SEO/UX)",
    body: `Atualizar as configurações globais do app (App Settings) para melhorar a identificação do portal no navegador.

**Critérios de Aceite:**
- [ ] Upload do arquivo \`.ico\` ou \`.png\` oficial para o favicon concluído.
- [ ] O ícone é renderizado corretamente nas abas do navegador.`,
    labels: "enhancement,UX",
    milestone: "v0.2.0 - UX Base"
  },

  // Milestone 2: Motor de Busca Semântica
  {
    title: "Refatorar Escopo da Query Global (Busca Multidimensional)",
    body: `Alterar a lógica de busca que atualmente olha apenas para 'Nome'. A query precisa buscar em Família de Produto, Grupo e Descrição Técnica.

**Critérios de Aceite:**
- [ ] A barra de busca continua sendo única na interface.
- [ ] Buscar pelo termo 'Ávula' retorna todos os 10 dispositivos correspondentes, não apenas 2.`,
    labels: "enhancement,backend",
    milestone: "v0.3.0 - Busca Semantica"
  },
  {
    title: "Implementar 'Mega Descrição' (Flattening Semântico)",
    body: `Criar uma sub-query (ou concatenação de campos) que 'achate' a hierarquia de dados semânticos em um único campo indexável, otimizando a velocidade de resposta no Retool.

**Critérios de Aceite:**
- [ ] Busca retorna resultados sem lentidão (degradação de performance) perceptível.
- [ ] A Mega Descrição contempla todos os dados relevantes daquele registro.`,
    labels: "enhancement,performance",
    milestone: "v0.3.0 - Busca Semantica"
  },
  {
    title: "Adicionar Suporte a Operadores e Curingas na Busca",
    body: `Permitir que o usuário digite operadores específicos na barra de busca para filtragens rápidas.

**Critérios de Aceite:**
- [ ] Suporte a \`%term%\` para buscas parciais.
- [ ] Suporte a \`@term\` para buscar em categorias específicas.`,
    labels: "enhancement,feature",
    milestone: "v0.3.0 - Busca Semantica"
  },

  // Milestone 3: Transparência e Similaridade
  {
    title: "Criar Badges (Labels) de Origem do Resultado",
    body: `Incluir um feedback visual na listagem de resultados que explique ao usuário por que aquele item apareceu.

**Critérios de Aceite:**
- [ ] Cada resultado exibe uma label visual limpa (ex: 'Encontrado em: Família').
- [ ] A lógica identifica corretamente qual coluna disparou o match na busca.`,
    labels: "enhancement,UI",
    milestone: "v0.4.0 - Transparencia"
  },
  {
    title: "Implementar Feedback Visual de Similaridade (Ranking)",
    body: `Criar uma lógica de similaridade (baseada em Minkowski) para ranquear os resultados de 0 a 1.

**Critérios de Aceite:**
- [ ] O ranking considera pesos para Área Total, Número de Operadores e Volume de Produção.
- [ ] A interface exibe a pontuação ou nível de similaridade de forma clara e visualmente agradável.`,
    labels: "enhancement,data",
    milestone: "v0.4.0 - Transparencia"
  },

  // Milestone 4: Saneamento e Filtros Avançados
  {
    title: "Ativar e Persistir Filtro Manual na Tabela",
    body: `Habilitar a filtragem de colunas na página de dispositivos, permitindo refinar resultados que já passaram pela busca global.

**Critérios de Aceite:**
- [ ] O componente de filtro manual está ativo nas tabelas/listas.
- [ ] O filtro manual não quebra nem conflita com o estado da busca semântica global.`,
    labels: "enhancement,feature",
    milestone: "v0.5.0 - Saneamento"
  },
  {
    title: "Padronização de Nomenclaturas (VFDM) e Processos Industriais",
    body: `Ajustar labels, categorias e nomes de campos para refletir o vocabulário oficial da engenharia.

**Critérios de Aceite:**
- [ ] Nomes de campos (Grupo, Família) atualizados para a terminologia técnica da Baldan.
- [ ] Labels e filtros configurados para os processos: Shotblaster, Coping, Sawing e Drilling.
- [ ] Lógica de ocultação pós-busca implementada via filtro.`,
    labels: "enhancement,data-cleanup",
    milestone: "v0.5.0 - Saneamento"
  }
];

function checkAuth() {
  const result = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  return result.status === 0;
}

function ensureLabelsExist() {
  console.log('--- Garantindo que as Labels existam no repositório ---');
  for (const label of requiredLabels) {
    // Tentar criar a label. Se já existir, o gh dará erro, mas nós ignoramos silenciosamente
    spawnSync('gh', [
      'label',
      'create',
      label.name,
      '--color', label.color,
      '--description', label.description
    ], { encoding: 'utf8' });
  }
  console.log('Fase de verificação de labels concluída!\n');
}

function createIssues() {
  console.log('--- Iniciando Criação de Issues no GitHub ---\n');

  if (!checkAuth()) {
    console.error('ERRO: Você não está logado no GitHub CLI.');
    console.error('Execute: gh auth login');
    process.exit(1);
  }

  // Criar labels primeiro para evitar erros na criação das issues
  ensureLabelsExist();

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    console.log(`[${i + 1}/${issues.length}] Criando issue: "${issue.title}"...`);
    
    // Construir os argumentos de forma segura
    const args = [
      'issue',
      'create',
      '--title', issue.title,
      '--body', issue.body
    ];

    // Adicionar labels individualmente para evitar problemas de parsing do CLI
    if (issue.labels) {
      issue.labels.split(',').forEach(label => {
        args.push('--label', label.trim());
      });
    }

    if (issue.milestone) {
      args.push('--milestone', issue.milestone);
    }
    
    const result = spawnSync('gh', args, { encoding: 'utf8' });
    
    if (result.status === 0 && result.stdout) {
      const url = result.stdout.trim();
      console.log(`  ✓ Criada com sucesso! URL: ${url}\n`);
    } else {
      console.error(`  ✗ Erro ao criar a issue "${issue.title}"`);
      if (result.stderr) {
        console.error(`  Detalhes do erro: ${result.stderr.trim()}`);
      }
      console.log();
    }
  }

  console.log('--- Processo Concluído! ---');
}

createIssues();
