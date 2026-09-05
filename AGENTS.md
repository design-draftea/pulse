# Pulse — instruções de trabalho

## Início de qualquer tarefa

- Responda à pessoa usuária em português do Brasil.
- Leia [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md) para conhecer o contexto durável, a stack e as decisões já confirmadas.
- Leia [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) para verificar se existe trabalho em andamento.
- Antes de editar, verifique pelas ferramentas o diretório atual, a raiz do Git, a branch e `git status --short --branch`; não peça à pessoa usuária que confirme informações que podem ser consultadas.
- Trate mudanças não commitadas preexistentes ou de origem incerta como trabalho da pessoa usuária ou de outro agente. Não sobrescreva, reverta, mova ou inclua essas mudanças sem autorização explícita. Preserve-as e prossiga com o trabalho independente em um worktree isolado quando necessário.
- Não edite diretamente na `main`. Crie uma branch por tarefa de edição e use um worktree isolado quando houver trabalho paralelo ou alterações locais não relacionadas. Inspeções e revisões somente de leitura não exigem nova branch.
- Em uma mesma pasta de trabalho, apenas um agente deve editar por vez.

## Autonomia, esclarecimentos e aprovação

- Dentro do escopo solicitado, prossiga com inspeção, criação de branch/worktree, implementação, correções e validação sem pedir confirmação a cada etapa. Não encerre apenas com um plano quando o pedido for de execução.
- Use o pedido atual, as decisões já confirmadas e os padrões existentes para resolver escolhas rotineiras e reversíveis. Declare uma suposição relevante e prossiga quando ela não ampliar o escopo nem substituir uma referência ou decisão exigida.
- Pergunte somente quando faltar uma decisão material que não possa ser obtida dessas fontes e que impeça avançar corretamente. Enquanto aguarda, conclua o trabalho independente da resposta. Silêncio ou tempo decorrido não constituem resposta nem aprovação.
- “Confirmar” estado técnico significa verificá-lo pelas ferramentas. Explicar uma necessidade ou registrar uma decisão não significa aguardar aprovação, salvo quando uma regra a exigir explicitamente. Explicar uma ampliação de escopo não a autoriza.
- Reaproveite respostas e autorizações já concedidas na sessão para a mesma ação e escopo. Não as estenda a outro destino, publicação ou mudança material.
- Antes de pedir uma aprovação ainda necessária, conclua a preparação e as verificações permitidas para apresentar um resultado concreto e revisável. A preparação não autoriza executar a etapa protegida.
- Em falhas de permissão, diagnostique a causa e use o mecanismo normal de aprovação da ferramenta quando disponível e permitido. Não contorne restrições nem remova locks de Git indiscriminadamente. Peça execução manual somente quando não houver um caminho permitido disponível ou a aprovação for recusada.

## Continuidade entre Codex e Claude

- Este arquivo é a fonte única das regras compartilhadas do repositório.
- [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md) guarda apenas contexto durável. Atualize-o quando a arquitetura, os comandos ou decisões permanentes realmente mudarem.
- [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) registra o estado operacional da tarefa atual. Atualize o Estado atual ao transferir trabalho, encerrar uma sessão incompleta ou concluir uma tarefa que alterou o projeto; preserve registros anteriores como histórico.
- O handoff deve registrar objetivo, critérios de aceite, branch/worktree, arquivos alterados, decisões, validações, pendências obrigatórias e próximo passo. Separe sugestões futuras e etapas fora do escopo das pendências de conclusão.
- Ao retomar, confronte o handoff com o Git e as evidências disponíveis antes de perguntar sobre divergências. Registros históricos não são ordens para retomar trabalho antigo nem autorizações para novas ações.
- Não declare como concluído algo que não foi verificado. Diferencie implementação, validação local, Pull Request, merge e deploy.
- Nunca registre credenciais, tokens, dados pessoais, URLs privadas ou outros segredos nesses documentos.

## Fluxo de Git

- `main` representa a versão oficial do projeto e não deve receber trabalho ou push direto.
- Crie branches a partir da `main` atualizada, usando prefixos como `feature/`, `fix/`, `chore/` ou `docs/`.
- Mantenha cada commit e Pull Request restritos ao objetivo da tarefa.
- Pull Request, merge e publicação exigem autorização explícita correspondente. Uma mesma mensagem pode autorizar várias etapas; não solicite novamente autorização já concedida para a mesma ação e escopo. Antes do merge na `main`, verifique se tanto o merge quanto a publicação automática estão autorizados.
- O deploy da `main` é automático: `.github/workflows/deploy-pages.yml` testa e publica o build estático em `https://design-draftea.github.io/pulse/` após cada merge. O Worker de `infra/polymarket-proxy` continua sendo publicado manualmente. Não crie ou altere infraestrutura de publicação por suposição.
- Nunca remova o checkout principal do projeto. Limpezas podem atingir apenas worktrees temporários criados para tarefas específicas e exigem autorização quando houver risco de perda.
- Crie worktrees isolados dentro de `.worktrees/<nome-da-branch>`, nunca em `/tmp` ou `/private/tmp`, que o sistema apaga sem avisar e deixa registros órfãos.
- Ao encerrar uma tarefa que usou worktree isolado, remova-o somente depois de verificar que está limpo e não haverá perda de trabalho, usando `git worktree remove` e `git branch -d`. Se a exclusão segura for recusada ou houver trabalho não integrado, preserve-o e registre a limpeza pendente separadamente da conclusão do escopo. Não use exclusão forçada sem autorização explícita nem apague a pasta manualmente: o Git mantém o registro e ele vira um worktree órfão.
- Use `git worktree list` para conferir o que existe e `git worktree prune` para descartar registros cujas pastas já não existem.
- As branches remotas são apagadas automaticamente no merge (`delete_branch_on_merge`). Localmente, `fetch.prune` remove as referências mortas a cada `git fetch`.

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

## Aplicação de skills no Pulse

- Use skills conforme o objetivo do pedido. Uma correção rotineira de interface não exige o fluxo completo de Product Design apenas por tocar UI. Quando houver implementação a partir do Figma, mantenha o uso da skill de design para código e da referência fornecida.
- Ajustes em telas ou componentes existentes com alvo claro não exigem criar alternativas nem selecionar novamente uma direção visual. Preserve a seleção obrigatória prevista pela skill para novas direções sem referência escolhida; este arquivo não dispensa essa aprovação.
- Se a captura da referência, a captura do protótipo ou a comparação visual estiver bloqueada, mantenha o QA visual como `blocked` ou pendente. Continue verificações e correções independentes, registre o requisito exato para retomar e entregue o estado do trabalho para continuidade. Não declare fidelidade visual nem conclusão integral sem a evidência exigida.
- Em auditorias de AGENTS.md, skills e configurações locais, inspecione primeiro os arquivos fornecidos e as instruções vigentes. Consulte documentação oficial quando a conclusão depender de comportamento do produto que essas fontes não estabeleçam.
- Instruções históricas de skills ou memórias sobre erros de Git e preview não substituem o diagnóstico atual nem o mecanismo permitido de aprovação. Mantenha as exigências explícitas de acesso, seleção, publicação e validação; um bloqueio deve interromper apenas as etapas que dependem dele.

## Validação

- Execute `pnpm lint` e `pnpm build` antes de apresentar uma mudança como tecnicamente pronta.
- Para mudanças de interface ou fluxo, valide o resultado no navegador em execução, na rota, viewport e estado relevantes.
- Um build concluído não comprova fidelidade visual nem funcionamento das interações.
- Quando a pessoa usuária pedir para testar o protótipo, inicie o servidor e informe uma URL local ou LAN utilizável.
- Registre separadamente o que foi implementado, o que foi validado localmente e o que foi publicado.
- Conclua todas as etapas solicitadas e autorizadas que sejam viáveis. Se uma dependência obrigatória continuar bloqueada, entregue o estado parcial com a limitação e o próximo passo, sem apresentar a tarefa inteira como concluída. PR, merge, publicação e sugestões futuras fora do escopo não são requisitos para concluir uma entrega local.
