# Handoff entre Codex e Claude

Este é o estado operacional compartilhado da tarefa atual. Atualize apenas com fatos verificados e mantenha o conteúdo conciso.

## Estado atual

- Atualizado em: 2026-08-28
- Agente que entrega: Codex
- Agente esperado a seguir: nenhum
- Status: pronto para revisão
- Objetivo: criar a documentação inicial de colaboração e contexto do Pulse
- Critérios de aceite: documentos adaptados ao Pulse, sem importar contexto de produto do Draftaco, com lint e build validados
- Branch: `docs/project-context`

## Alterações realizadas

- `AGENTS.md` criado como fonte única das regras do repositório.
- `CLAUDE.md` criado para encaminhar o Claude às regras compartilhadas.
- `docs/AI_CONTEXT.md` criado com o contexto durável confirmado do Pulse.
- `docs/AI_HANDOFF.md` criado para continuidade operacional.
- `README.md` atualizado para apresentar o novo projeto.

## Decisões e limites

- O Pulse é um projeto independente; regras de produto, rotas, componentes e decisões visuais do Draftaco não foram importados.
- React, TypeScript, Vite, CSS e pnpm formam a fundação técnica atual.
- Arquitetura de produto, dados, design system, CI e deploy permanecem a definir.
- `AGENTS.md` é a fonte única das regras compartilhadas entre agentes.

## Validações executadas

- `pnpm lint`: passou sem erros.
- `pnpm build`: passou com TypeScript e Vite 8.2.2.
- `git diff --check`: passou.

## Pendências

- Apresentar a documentação para revisão antes de Pull Request, merge ou publicação.

## Próximo passo

- Validar os documentos e decidir o primeiro fluxo de predictions a ser explorado.

## Modelo para o próximo handoff

- Atualizado em:
- Agente que entrega:
- Agente esperado a seguir:
- Status: em andamento | bloqueado | pronto para revisão | concluído
- Objetivo:
- Critérios de aceite:
- Branch/worktree:
- Arquivos alterados:
- Decisões tomadas:
- Validações executadas e resultados:
- Pendências ou riscos:
- Próximo passo concreto:
