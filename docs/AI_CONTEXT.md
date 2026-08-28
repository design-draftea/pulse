# Contexto compartilhado do Pulse

Este arquivo contém o contexto durável para Codex e Claude. Para o estado da tarefa atual, consulte [AI_HANDOFF.md](AI_HANDOFF.md).

## Produto

- Pulse é um novo projeto de predictions em fase inicial de definição.
- O objetivo atual é construir a fundação técnica antes de definir layout, componentes, fluxos e regras de produto.
- Público, tipos de prediction, fontes de dados, regras de pontuação e proposta detalhada ainda não foram definidos.
- Use dados mockados enquanto não houver uma fonte de dados aprovada.

## Stack e execução

- React 19, TypeScript 6, Vite 8 e CSS.
- Gerenciador de pacotes: pnpm.
- O scaffold atual foi validado com Node.js 24.
- Instalação: `pnpm install`.
- Desenvolvimento: `pnpm dev`.
- Build com typecheck: `pnpm build`.
- Lint: `pnpm lint`.
- Preview de produção: `pnpm preview`.

## Estado da arquitetura

- `src/main.tsx` inicializa a aplicação React.
- `src/App.tsx` contém apenas a experiência padrão do scaffold do Vite.
- `src/App.css` e `src/index.css` contêm apenas os estilos iniciais do scaffold.
- `src/assets/` contém somente assets demonstrativos do scaffold.
- Rotas, componentes de produto, estado compartilhado, serviços, design system e estrutura de dados ainda não foram definidos.
- Crie novas camadas apenas quando uma necessidade real do produto justificar a organização.

## Design

- Nenhum layout, token, tema ou biblioteca de componentes do Pulse foi definido.
- Não reutilize automaticamente decisões visuais do Draftaco; os projetos têm contextos independentes.
- Quando houver referência do Figma, use o nó fornecido como fonte de verdade e valide a implementação no navegador.

## Git e publicação

- Repositório: `design-draftea/pulse`.
- `main` representa a versão oficial e não deve receber trabalho direto.
- Crie uma branch por tarefa e mantenha mudanças não relacionadas fora dela.
- Pull Request, merge e deploy são etapas separadas e exigem autorização explícita.
- CI, hospedagem e processo de deploy ainda não foram definidos.

## Critério de entrega

Uma tarefa só pode ser descrita como concluída quando o escopo solicitado foi implementado e a validação proporcional ao risco foi executada. Relate separadamente:

1. código ou documentação alterados;
2. lint, typecheck e build;
3. validação visual e interativa local, quando aplicável;
4. Pull Request;
5. merge;
6. deploy e ambiente validado.
