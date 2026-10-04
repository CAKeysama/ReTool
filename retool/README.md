# ReTool - Gestão de Dispositivos e Reutilização Industrial

**ReTool** é uma aplicação web para o chão de fábrica que centraliza o cadastro dos dispositivos da ferramentaria e o fluxo de **reutilização de peças**, com rastreabilidade de todas as operações. Projeto do curso DSM da **Fatec Matão** em parceria com a **Baldan**.

![ReTool Layout Desktop](./docs/images/ReTool%20Dashboard.png)

📚 **Documentação completa: [Wiki do projeto](https://github.com/CAKeysama/ReTool/wiki)**

## O problema

Em indústrias pesadas, o conhecimento sobre uma ferramenta costuma ficar com os operadores mais antigos ou em planilhas sem padrão. Sem um histórico claro, decidir se um dispositivo pode ser reaproveitado leva tempo.

## A solução

Uma plataforma única, que aceita dados incompletos: a falta de um campo não impede o cadastro.

- **Dispositivos:** cadastro flexível, imagens e PDFs, busca multidimensional, importação de planilhas (CSV/XLSX) sem duplicar classificações e ações em massa.
- **Reutilizações:** fluxo entre Engenharia e Projetista com filas por perfil, histórico e *hard saving*.
- **Controle de acesso:** cargos com permissões validadas no servidor (regras do Firestore); cadastro público como Convidado, sujeito a aprovação; solicitações de alteração de cargo; contas com senha temporária e troca obrigatória no primeiro acesso.
- **Notificações e auditoria:** avisos em tempo real e Histórico de Ações imutável, com filtros, exclusivo da Administração.
- **Teclado e acessibilidade:** atalhos globais e navegação por setas nas listas.

## Tecnologias

React 19 · Vite · TypeScript · Firebase (Authentication, Cloud Firestore, Cloud Storage, Cloud Functions e Hosting) · Jest. Detalhes em [Arquitetura](https://github.com/CAKeysama/ReTool/wiki/Arquitetura).

## Início rápido

```bash
cd retool
npm install
cp .env.example .env   # preencha com a configuração do projeto Firebase
npm run dev            # http://localhost:5173
```

Para rodar sem tocar em dados reais, use os emuladores (`npm run emuladores` e `npm run dev:emuladores`). Veja [Configuração do Ambiente](https://github.com/CAKeysama/ReTool/wiki/Configuração-do-Ambiente).

## Testes

```bash
npm test               # domínio, casos de uso e repositórios (Firestore em memória)
npm run test:rules     # regras do Firestore e consultas do histórico (emulador; requer Java)
npm run test:funcoes   # Cloud Function (emuladores; requer Java)
```

Veja [Testes](https://github.com/CAKeysama/ReTool/wiki/Testes) e [Build e Deploy](https://github.com/CAKeysama/ReTool/wiki/Build-e-Deploy).
