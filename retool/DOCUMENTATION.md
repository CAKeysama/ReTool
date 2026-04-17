# Documentação Técnica - ReTool

Esta documentação provê uma visão aprofundada das decisões arquiteturais e bibliotecas customizadas (hooks) projetadas para sustentar a aplicação **ReTool**. 

## 1. Stack Tecnológica
- **Linguagem:** TypeScript (Strict Mode).
- **Core:** React 18 / Vite.
- **Roteamento:** React Router DOM V6 (Single Page Application com Nested Routes e Modais Interceptadores).
- **Estilo:** CSS puro (`index.css`) com variáveis globais paramétricas no `:root`, mantendo a leveza sem dependências de frameworks cúbicos (Tailwind, Bootstrap). Estética alinhada com as tipografias institucionais *Effra* e *Inter*.

## 2. Paradigma de Domínio: FER e Mundo Aberto
O sistema foi estruturado não em tabelas relacionais duras, e sim em um protótipo de grafo lógico focado em flexibilidade:
- **Modelo FER (Fact, Event, Rule):** A espinha dorsal das iterações é separada do objeto estático. Um `Dispositivo` atua como o **Fato** inerte do chão de fábrica (ex: Motor Trifásico). Tudo o que ocorre nele são registrados separadamente nas `Utilizações`, formando os **Eventos** ancorados sem alterar a integridade principal da peça.
- **Open World Assumption:** Ao contrário do paradigma convencional (CWA), onde algo não listado não existe, o ReTool abraça os dados incompletos. Formulários *nunca bloqueiam o fluxo*: pesos podem ficar vazios, descrições ausentes exibem fallbacks inteligentes ("Não informado") garantindo continuidade na manutenção rápida.

## 3. Estrutura de Banco e Persistência
Para agilidade na fase de implantação/validação, toda a *Data Layer* e Mocks vivem assincronamente através de uma injeção de persistência por `localStorage`:
- **`ReToolContext.tsx`**: Contém três ramos principais geridos por UUIDs: `dispositivos`, `categorias` e `utilizacoes`.
- A API do Contexto provê métodos mastigados (`addDispositivo`, `deleteUtilizacao` etc.). Sempre que algum estado sofre alteração, instâncias de `useEffect` refletem agressivamente e localmente.

## 4. Engenharia de Acessibilidade Orgânica
A interface fabril do ReTool prescinde do uso do "mouse", sendo **100% operável via Teclado e Shortcuts nativos**. Funcionalidades criadas:

### Hooks Customizados
- **`useHotkeys()`**: Um listener global injetado no Layout. Intercepta combinações exatas em qualquer ponto da rotina (salvo quando você está digitando num input/textarea). Setado com:
  - `/` (foco na barra de pesquisa superior).
  - `P` (Navega instantaneamente para `/dispositivos`).
  - `N` (Abre modal global interativo de registro).
- **`useKeyboardNavigation()`**: Um controller customizado de setas up/down ligado a interface gráfica das listas (Renderizadas via `<FocusableList>`). Permite percorrer as informações com setas e executar rotina via `Enter`, poupando dezenas de cliques.

### Acessibilidade de Feedback (Toasts & Aria)
Para integrar os usuários e os Leitores Virtuais de tela, o ReTool possui Duplo-Vínculo na emissão de feedbacks (`announce`):
1. Elementos invisíveis (`.sr-only`) capturam a região e jogam pro auto-falante o contexto de navegação.
2. Em paralelo, a mesma rotina aciona um *Toast Alert Visual* (em CSS Keyframes Slide-in Right) e insere uma tarja temporária que limpa-se automaticamente após 3 segundos para confirmar operações de SUCESSO na criação / apagamento.

## 5. Rotas Aninhadas e Modais de Sobreposição
Para não "pular" e criar desconexão ao adicionar um aparelho (perdendo a visão da lista de trás), configurou-se `<Outlet/>` dentro de `Dispositivos.tsx`. Com isso, `/dispositivos/novo` não altera o ambiente principal, mas invoca em **Z-Index sobreposto** a interface de Cadastro (`<AccessibleModal>`) que captura magicamente o retorno da URL ao fechar.
