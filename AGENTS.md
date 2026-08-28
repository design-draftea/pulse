# Pulse — instruções de trabalho

## Início de qualquer tarefa

- Responda à pessoa usuária em português do Brasil.
- Leia [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md) para conhecer o contexto durável, a stack e as decisões já confirmadas.
- Leia [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) para verificar se existe trabalho em andamento.
- Antes de editar, confirme o diretório atual, a raiz do Git, a branch e `git status --short --branch`.
- Se houver mudanças não commitadas, trate-as como trabalho da pessoa usuária ou de outro agente. Não sobrescreva, reverta, mova ou inclua essas mudanças sem autorização explícita.
- Não trabalhe diretamente na `main`. Crie uma branch por tarefa e use um worktree isolado quando houver trabalho paralelo ou alterações locais não relacionadas.
- Em uma mesma pasta de trabalho, apenas um agente deve editar por vez.

## Continuidade entre Codex e Claude

- Este arquivo é a fonte única das regras compartilhadas do repositório.
- [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md) guarda apenas contexto durável. Atualize-o quando a arquitetura, os comandos ou decisões permanentes realmente mudarem.
- [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) registra o estado operacional da tarefa atual. Atualize-o ao transferir trabalho ou encerrar uma sessão com trabalho incompleto.
- O handoff deve registrar objetivo, critérios de aceite, branch, arquivos alterados, decisões, validações, pendências e próximo passo.
- Não declare como concluído algo que não foi verificado. Diferencie implementação, validação local, Pull Request, merge e deploy.
- Nunca registre credenciais, tokens, dados pessoais, URLs privadas ou outros segredos nesses documentos.

## Fluxo de Git

- `main` representa a versão oficial do projeto e não deve receber trabalho ou push direto.
- Crie branches a partir da `main` atualizada, usando prefixos como `feature/`, `fix/`, `chore/` ou `docs/`.
- Mantenha cada commit e Pull Request restritos ao objetivo da tarefa.
- Não abra Pull Request, faça merge ou publique sem a autorização correspondente.
- O processo de deploy ainda não foi definido. Não crie ou altere infraestrutura de publicação por suposição.
- Nunca remova o checkout principal do projeto. Limpezas podem atingir apenas worktrees temporários criados para tarefas específicas e exigem autorização quando houver risco de perda.

## Segurança e escopo

- Use dados mockados enquanto não houver uma fonte de dados aprovada.
- Não inclua credenciais, tokens, dados pessoais ou endpoints internos no código ou no histórico do Git.
- Não adicione dependências nem amplie o escopo sem explicar a necessidade.
- Preserve comportamentos existentes e mantenha as mudanças restritas ao pedido.

## Design e Figma

- Quando houver um link ou nó do Figma, use o design fornecido como fonte de verdade visual.
- Não invente espaçamentos, cores, estados, textos ou assets quando a referência puder ser consultada.
- Reutilize tokens e assets reais quando eles existirem. Se ainda não existirem, registre a decisão antes de criar um novo padrão.
- Considere acessibilidade, estados interativos, responsividade e comportamento em diferentes viewports desde a implementação.

## Validação

- Execute `pnpm lint` e `pnpm build` antes de apresentar uma mudança como tecnicamente pronta.
- Para mudanças de interface ou fluxo, valide o resultado no navegador em execução, na rota, viewport e estado relevantes.
- Um build concluído não comprova fidelidade visual nem funcionamento das interações.
- Quando a pessoa usuária pedir para testar o protótipo, inicie o servidor e informe uma URL local ou LAN utilizável.
- Registre separadamente o que foi implementado, o que foi validado localmente e o que foi publicado.
