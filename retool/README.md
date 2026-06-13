# ReTool - Gestão de Ativos e Ferramentas Industriais

**ReTool** é uma aplicação web moderna voltada para o chão de fábrica, projetada para solucionar a dispersão, a desorganização e o isolamento de dados sobre dispositivos, maquinários e peças em ambientes de manufatura.

![ReTool Layout Desktop](./docs/images/ReTool%20Dashboard.png)

## 📌 O Problema
Em indústrias pesadas, o conhecimento sobre uma máquina ou ferramenta geralmente fica restrito à cabeça dos operadores mais antigos ou perdido em planilhas não padronizadas. Quando algo falha, o tempo de inatividade (Downtime) é estendido pela falta de um histórico claro de manutenções, peças de reposição rápidas ou documentação acessível.

## 🎯 Nossa Solução
Centralizar o conhecimento mecânico e elétrico numa plataforma que abraça o princípio da **Suposição de Mundo Aberto (Open World Assumption)**. O ReTool entende que o ambiente fabril é caótico: a ausência de um dado (ex: código do fabricante não legível na peça) não pode impedir que o equipamento seja catalogado. Os dados fluem sem bloqueios pesados.

### Principais Recursos
- **Gestão Aberta:** Cadastros ultra-flexíveis para Dispositivos (sensores, válvulas, CLPs) onde a falta de campo não trava o operador.
- **Histórico e Rastreio:** Registro de "Utilizações e Ocorrências" acopladas ao dispositivo, formando uma "Linha do tempo" de quebras, revisões ou modificações.
- **Eficiência e Acessibilidade:** Uso fabril em chão de fábrica exige rapidez. O sistema é operável **100% pelo teclado** através de atalhos globais, permitindo inserções rápidas com luvas (uso sem mouse).
- **Importação Inteligente em Lote:** Permite importar planilhas Excel/CSV mapeando e criando classificações (Categorias, Famílias de Produtos e Produtos) de forma automática e **livre de duplicidades** (com algoritmo de prevenção de duplicados insensível à capitalização e espaços extras).
- **Notificações Fluidas:** Sistema de *Toasts* embutido para dar clareza às interações na interface dinâmica.
- **Design Industrial Premium:** Construído em variáveis puras CSS acompanhando a paleta oficial Baldan (Vermelho e Cinza Aço).

---

## 🏗️ Arquitetura do Sistema (Clean Architecture)

O sistema foi refatorado seguindo os princípios de **Clean Architecture**, dividindo a aplicação em camadas bem definidas e desacopladas:

1. **Domínio (`src/domain/`)**: Contém as entidades puras de negócio (`Dispositivo`, `Categoria`, etc.) e as interfaces de repositórios (`IDispositivosRepository`, etc.) livres de dependências externas.
2. **Dados (`src/data/`)**: Contém a infraestrutura de dados (Firebase Datasource) e as implementações concretas dos repositórios (`FirestoreDispositivosRepository`, etc.), isolando o SDK do Firebase da interface.
3. **Aplicação (`src/application/`)**: Contém casos de uso de orquestração de negócios, como o `ImportarLoteUseCase`.
4. **Apresentação (`src/presentation/`)**: Contém o framework React, com páginas puras, separação de lógica usando hooks controladores (ex: `useDispositivosController`) e gerenciamento de estados.

---

## 🧪 Suíte de Testes Unitários

O projeto possui uma suíte de testes automatizados com **Jest** e **ts-jest**, atingindo **mais de 87% de cobertura geral**:

- **Mocks Controlados**: Banco Firestore simulado em memória em [firebaseMock.ts](./src/tests/mocks/firebaseMock.ts) para testes ultra-rápidos locais.
- **Cobertura**: Cobertura de 100% nos Casos de Uso e Repositórios auxiliares, e mais de 80% nos fluxos principais de CRUD e importação de planilhas.

```bash
# Executar todos os testes unitários
npm run test

# Executar testes gerando relatório detalhado de cobertura
npm run test:coverage
```

---

## 🚀 Como iniciar o projeto (Ambiente Local)

Este projeto foi construído com **React** e **Vite**.

```bash
# 1. Entre na pasta do projeto
cd retool

# 2. Instale todas as dependências (incluindo as de desenvolvimento e testes)
npm install

# 3. Rode o servidor local
npm run dev

# 4. Rode a suíte de testes para validar a integridade
npm run test
```

> **Acesso:** Por padrão, a aplicação Vite será exposta na porta http://localhost:5173.

---

Para detalhes técnicos sobre a engenharia de renderização do Contexto, Hooks de atalhos e a arquitetura semântica, acesse o [DOCUMENTATION.md](./DOCUMENTATION.md).
