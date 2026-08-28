# Pulse

Projeto web em React para explorar uma nova experiência de predictions.

O produto está no início: layout, componentes, fluxos, fontes de dados e regras de negócio ainda serão definidos. A base atual é um scaffold técnico limpo, sem reaproveitar a interface ou a arquitetura de produto do Draftaco.

## Stack

- React 19
- TypeScript 6
- Vite 8
- CSS
- pnpm

## Como executar

O scaffold foi validado com Node.js 24.

```bash
pnpm install
pnpm dev
```

O Vite informa a URL local disponível ao iniciar o servidor.

Scripts úteis:

```bash
pnpm dev      # servidor de desenvolvimento
pnpm build    # typecheck e build de produção
pnpm lint     # análise estática com Oxlint
pnpm preview  # preview local do build
```

## Estado atual

- A aplicação ainda usa a tela demonstrativa do scaffold oficial do Vite.
- Não existem rotas ou componentes de produto definidos.
- Não existe design system configurado.
- CI, hospedagem e deploy ainda não foram definidos.

## Estrutura inicial

```text
src/
  assets/      assets demonstrativos do scaffold
  App.tsx      componente inicial da aplicação
  App.css      estilos do componente inicial
  index.css    estilos globais iniciais
  main.tsx     inicialização do React
```

Novas pastas devem ser adicionadas conforme necessidades reais de produto surgirem, evitando antecipar uma arquitetura sem requisitos.

## Colaboração

- [AGENTS.md](AGENTS.md): regras compartilhadas de trabalho.
- [CLAUDE.md](CLAUDE.md): entrada de contexto para o Claude Code.
- [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md): contexto durável do produto e da arquitetura.
- [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md): estado operacional da tarefa atual.

Cada mudança deve ser desenvolvida em uma branch própria. Pull Request, merge e deploy são etapas separadas.
