# ReTool - Gestão de Ativos e Ferramentas Industriais

**ReTool** é uma aplicação web moderna voltada para o chão de fábrica, projetada para solucionar a dispersão, a desorganização e o isolamento crônico de dados sobre dispositivos, maquinários e peças em ambientes de manufatura.

![ReTool Layout Desktop](./docs/images/ReTool%20Dashboard.png)

## 📌 O Problema
Em indústrias pesadas, o conhecimento sobre uma máquina ou ferramenta geralmente fica restrito à cabeça dos operadores mais antigos ou perdido em planilhas não padronizadas. Quando algo falha, o tempo de inatividade (Downtime) é estendido pela falta de um histórico claro de manutenções, peças de reposição rápidas ou documentação acessível.

## 🎯 Nossa Solução
Centralizar o conhecimento mecânico e elétrico numa plataforma que abraça o princípio da **Suposição de Mundo Aberto (Open World Assumption)**. O ReTool entende que o ambiente fabril é caótico: a ausência de um dado (ex: código do fabricante não legível na peça) não pode impedir que o equipamento seja catalogado. Os dados fluem sem bloqueios pesados.

### Principais Recursos
- **Gestão Aberta:** Cadastros ultra-flexíveis para Dispositivos (sensores, válvulas, CLPs) onde a falta de campo não trava o operador.
- **Histórico e Rastreio:** Registro de "Utilizações e Ocorrências" acopladas ao dispositivo, formando uma "Linha do tempo" de quebras, revisões ou modificações.
- **Eficiência e Acessibilidade:** Uso fabril em chão de fábrica exige rapidez. O sistema é operável **100% pelo teclado** através de atalhos globais, permitindo inserções rápidas com luvas (uso sem mouse).
- **Notificações Fluidas:** Sistema de *Toasts* embutido para dar clareza às interações na interface dinâmica sem interromper o fluxo cerebral do operador.
- **Design Industrial Premium:** Casca construída em variáveis puras CSS acompanhando a paleta oficial Baldan (Vermelho e Cinza Aço).

---

## 🚀 Como iniciar o projeto (Ambiente Local)

Este projeto foi construído com a última versão do **React** acoplado ao poderoso **Vite** para entregas hiper-rápidas.

```bash
# 1. Clone ou abra o repositório em sua máquina
cd retool

# 2. Instale todas as dependências
npm install

# 3. Rode o servidor local
npm run dev
```

> **Acesso:** Por padrão, a aplicação Vite será exposta na porta http://localhost:5173. 
*Nota: a base de dados MOCK interna (com mais de 20 equipamentos simulados) será construída automaticamente no seu LocalStorage no primeiro carregamento.*

---

Para detalhes sobre a engenharia de renderização do Contexto, Hooks de atalhos e a arquitetura semântica, acesse o [DOCUMENTATION.md](./DOCUMENTATION.md).
