# Contexto compartilhado do Pulse

Este arquivo contém o contexto durável para Codex e Claude. Para o estado da tarefa atual, consulte [AI_HANDOFF.md](AI_HANDOFF.md).

## Produto

- Pulse é um protótipo mobile de prediction market para testes com usuários no México.
- O escopo atual é exclusivamente Bitcoin, rodadas contínuas de 15 minutos e decisão UP/DOWN, sem alavancagem.
- A interface e os textos do protótipo são em espanhol do México.
- Dados de preço, tempo da rodada, últimas rodadas, preços UP/DOWN e profundidade usam as fontes públicas reais quando disponíveis. Uma contingência local e invisível mantém o protótipo operacional durante indisponibilidades; compra, venda e saldo continuam simulados e não enviam ordens.

## Stack e execução

- React 19, TypeScript 6, Vite 8 e CSS.
- Gerenciador de pacotes: pnpm.
- O scaffold atual foi validado com Node.js 24.
- Instalação: `pnpm install`.
- Desenvolvimento: `pnpm dev`.
- Build com typecheck: `pnpm build`.
- Lint: `pnpm lint`.
- Testes do motor de mercado: `pnpm test:market`.
- Testes da carteira do protótipo: `pnpm test:wallet`.
- Testes da contingência de dados: `pnpm test:fallback`.
- Preview de produção: `pnpm preview`.

## Estado da arquitetura

- `src/main.tsx` inicializa a aplicação React.
- `src/App.tsx` monta a experiência mobile atual e coordena a rodada de mercado.
- `src/components/` concentra os componentes visuais construídos a partir do Figma.
- `src/hooks/useResilientBtcMarketRound.ts` coordena relógio, alvo bloqueado, histórico, cache local e seleção resiliente do preço atual.
- `src/hooks/useBtcPriceFeeds.ts` mantém Chainlink, Coinbase e Kraken conectados em paralelo, considera um feed atrasado após `10s` e fixa a fonte escolhida por rodada enquanto ela permanecer saudável.
- `src/hooks/useOutcomeMarket.ts` descobre os tokens UP/DOWN pela Gamma e mantém os livros do CLOB; enquanto conecta ou quando a fonte falha, publica um livro sintético local e bloqueia essa origem até a rodada seguinte.
- `src/hooks/usePresentedQuotes.ts` desacopla o livro publicado a cada `250ms` dos snapshots visuais de UP/DOWN e do betslip, atualizados de forma atômica no máximo uma vez por segundo, salvo mudanças imediatas iniciadas pelo usuário, troca de rodada ou disponibilidade.
- `src/hooks/usePrototypeWallet.ts` centraliza compra, venda, liquidação, restauração, reset e sincronização da carteira simulada entre abas.
- `src/services/marketData.ts` contém os cálculos determinísticos da rodada e o acesso ao preço objetivo.
- `src/services/outcomeMarket.ts` contém o mapeamento outcomes/tokens, a regra de preço exibido da Polymarket e o VWAP de compra e venda por profundidade.
- `src/services/quotePresentation.ts` contém as decisões puras de publicação visual e a proteção de execução: compra tolera até `1¢` de piora no preço médio; venda aplica a regra inversa; melhora de preço é sempre aceita.
- `src/services/marketPriceDirection.ts` estabiliza o indicador do gráfico por janela de tendência, confirmação de direção e expiração por inatividade.
- `src/services/marketFallback.ts` contém seleção de feeds, probabilidade local, suavização, livro sintético e serialização segura do cache de até 12 rodadas.
- `src/services/prototypeWallet.ts` mantém saldo em centavos, posições por rodada e IDs de créditos já aplicados, sem integrar qualquer movimentação financeira real.
- `vite.config.ts` expõe no ambiente local o proxy necessário para a rota sem CORS da Polymarket e aceita `VITE_BASE_PATH` para gerar o build sob `/pulse/` no GitHub Pages.
- Em produção, `VITE_POLYMARKET_PROXY_ORIGIN` aponta para o Worker público de `infra/polymarket-proxy`; sem essa variável, a aplicação falha rapidamente para a contingência local invisível, sem consultar uma rota inexistente do GitHub Pages.

## Design

- Os tokens exportados do Figma estão preservados em `src/styles/tokens/mode-1.tokens.json` e são a fonte de verdade para cores do Pulse.
- O arquivo deve permanecer fiel ao export original; `src/styles/tokens/colors.css` expõe somente os tokens que já começaram a ser consumidos pela interface.
- O protótipo é exclusivamente mobile responsivo e suporta o conteúdo principal até `499px` de largura.
- A partir de `500px`, a aplicação deve cobrir o conteúdo com o mesmo aviso `MobileOnly` usado no Draftaco em `/apostas`.
- O `bgHeader.png` permanece fixo no topo, abaixo da interface, sempre com `300px` de altura.
- Ao alcançar o topo durante o scroll, a pilha formada por `SubHeader` e `PriceComparison` permanece fixa e os dois componentes animam simultaneamente com `ease-in-out`.
- `PriceComparison` exibe o `openPrice` real da rodada como preço objetivo e compara o preço atual real para determinar direção e diferença.
- A borda dos cards de `PriceComparison` preserva o espaço externo transparente e desenha o token de 12% em uma camada interna sobre o próprio card, reproduzindo a composição `Inside` do Figma sem alterar dimensões ou alinhamento.
- O preço atual possui uma única transição compartilhada de `360ms`: card, diferença, ponta e etiqueta do gráfico e indicador direcional recebem exatamente o mesmo valor animado em cada frame.
- `PriceChart` representa o gráfico dinâmico do mercado: ocupa toda a largura mobile, mantém `256px` de altura e desenha a série recebida do feed real usando o preço animado compartilhado como ponto atual. A série pertence à rodada corrente, mantém até 120 pontos ordenados e deduplicados por segundo e não é limpa durante reconexões ou trocas entre Chainlink, Coinbase e Kraken.
- O gráfico também exibe entradas simuladas do mercado separadas do feed real: valores UP sobem em verde e DOWN em vermelho durante `3,2s`, com novos eventos em intervalos aleatórios de `7,5s` a `16s`. Esses eventos são apenas ambientação visual do protótipo e não alteram preço, saldo ou histórico.
- Os preços do gráfico usam duas casas decimais e sete níveis horizontais. O domínio considera os 20 pontos mais recentes, parte de intervalos de `$2,50` e amplia automaticamente o passo para `$5`, `$10` ou mais quando a variação exigir. Expansões necessárias são imediatas; contrações exigem `5s` de estabilidade e deslocamentos no mesmo passo exigem `750ms` de tendência consistente. Bottom, top e step são interpolados durante `280ms`; linhas, área, tracejados e os sete rótulos permanecem sempre visíveis, enquanto os números apenas atualizam seu valor nas mesmas posições, sem fade. Todos os rótulos permanecem renderizados, inclusive o nível localizado atrás da etiqueta do preço atual. O eixo temporal usa marcações a cada `5s`.
- `Precio objetivo` usa primeiro o `openPrice` da Polymarket, depois o alvo já salvo para a rodada e, após `3s`, o preço capturado localmente. Uma vez definido, ele permanece bloqueado até o encerramento. `Precio actual` e o gráfico priorizam Chainlink TWAP e trocam silenciosamente para Coinbase e Kraken quando o feed selecionado passa `10s` sem atualização.
- As janelas contínuas de 15 minutos são calculadas pelo relógio real. Data, horário da rodada, histórico e eixo temporal do gráfico usam automaticamente o fuso do dispositivo que acessa o protótipo. Na virada, o timer, o slug e o alvo mudam automaticamente; somente então a série reinicia, sem estado vazio e sem fade global, usando o último preço real válido exatamente no início da nova rodada.
- As três conexões de preço ficam em hot standby. A aplicação conserva o último valor durante a troca, sem zerar o card nem a série, e expõe a origem somente em atributos `data-*` para diagnóstico.
- Consulte `docs/MARKET_DATA_SPIKE.md` para evidências, limites e requisitos de produção. O protótipo publicado usa um Cloudflare Worker mínimo para o preço objetivo; uma arquitetura de produto final ainda exige backend próprio, observabilidade e política aprovada de uso das fontes.
- O início da linha e da área do `PriceChart` usa uma máscara SVG de `96px` com progressão suave para desaparecer sobre o fundo real, sem sobrepor um gradiente preto nem criar uma borda perceptível no preenchimento. O indicador UP/DOWN é desenhado inline e não possui caixa de fundo.
- Quando pontos antigos saem da janela móvel, o gráfico conserva o último ponto externo como guarda e interpola geometricamente a passagem por `x=0` entre os pontos reais vizinhos. Assim a linha permanece ancorada na borda esquerda e não reaparece no meio do gráfico.
- Os dois chevrons do indicador usam uma sequência única de fade in e fade out: `620ms` por chevron, `120ms` de diferença e aproximadamente `740ms` no total. A direção considera uma janela de `1,5s`, exige duas leituras consecutivas para confirmar início ou inversão e repete o ciclo com pausa de `120ms` enquanto a tendência permanecer ativa. Atualizações na mesma direção não reiniciam a animação, a inversão aguarda o próximo ciclo e o indicador fica neutro após `2s` sem movimento relevante. O ciclo é independente da animação numérica de `360ms`; um fallback de `800ms` cobre ambientes sem evento de animação. O recorte quadrado permanece para esconder linha e tracejados atrás da área reservada ao indicador.
- Uma máscara quadrada de `30px`, sem borda, cria uma zona limpa atrás do indicador, recortando linha, área e tracejados sem introduzir uma cor de fundo.
- `SubHeader` e `PriceComparison` travam juntos no topo por meio de `position: sticky`, sem trocar bruscamente para `fixed`. A pilha possui uma cópia opaca e alinhada do fundo fixo desde o primeiro frame, impedindo que o gráfico apareça por trás durante scrolls rápidos. Em `56px` continuam no tamanho normal; o estado compacto começa somente em `80px`: as alturas animam de `64px` para `40px` e de `90px` para `55px`; o segundo componente acompanha continuamente a borda inferior do primeiro, sem sobreposição, enquanto um slot de `154px` preserva o fluxo.
- `PreviousRounds` representa o layout do nó `188:3013`, com o título `Últimas 10 rondas`, carrossel horizontal, snap e bullets dinâmicos equivalentes ao `CompetitionMatchCarousel` do Draftaco.
- Cada card de `PreviousRounds` usa largura responsiva de `100vw - 40px`, considerando `16px` de margem inicial e mantendo sempre `24px` do viewport livres à direita.
- A borda dos cards de `PreviousRounds` segue a mesma composição interna de `PriceComparison`: reserva `1px` transparente na estrutura e desenha o token de 12% sobre o próprio card, sem alterar a largura responsiva.
- O brilho superior dos cards de `PreviousRounds` reutiliza o asset original, esticado de forma responsiva entre `24px` de margem interna em cada lateral.
- `PreviousRounds` mostra as 10 rodadas concluídas mais recentes, em ordem decrescente, com `openPrice`, `closePrice`, resultado e horários no fuso do dispositivo. A lista é sempre calculada a partir da rodada atual do relógio: ao abrir ou recarregar a página, na virada de rodada e ao retornar por foco, `pageshow` ou visibilidade, a aplicação consulta imediatamente as dez janelas anteriores, sem depender de o usuário ter permanecido no site. Cada janela tenta primeiro os valores da Polymarket e usa candles reais de 15 minutos da Coinbase apenas quando essa consulta não responde; o cache antigo só pode preencher uma janela cujo `roundStart` pertença exatamente às dez esperadas, impedindo saltos para rodadas de ontem. Na virada, o snapshot local entra imediatamente e é persistido; quando a fonte confirma os dados oficiais, o card é atualizado pela mesma `roundStart`, sem duplicação nem nova animação. A consulta só assume estado completo quando o primeiro item é exatamente a rodada imediatamente anterior e existem dez resultados; enquanto isso, repete a tentativa sem inventar resultados. O cache validado mantém até 12 rodadas para histórico e liquidação durante falhas da consulta oficial.
- Somente a rodada adicionada na virada recebe a microinteração de atualização; o carregamento inicial do histórico permanece neutro. O card é revelado da esquerda para a direita durante `860ms`, com fade, leve deslocamento e overshoot. Um brilho e uma borda temporários usam verde para UP ou vermelho para DOWN, enquanto o título exibe o badge `Nueva` por `1,8s`. A identidade usa `roundStart`, garantindo uma única execução por rodada, e o carrossel retorna imediatamente ao primeiro card. Uma mensagem `aria-live` comunica a nova rodada e o resultado sem depender do movimento.
- `PulseFooter` representa o footer informativo do nó `188:3060`, montado abaixo de `PreviousRounds` com largura fluida, margem lateral de `16px`, explicação do produto e links institucionais ainda sem navegação.
- `Navbar` representa a navegação fixa do nó `188:3113`: altura de `58px`, margens laterais de `16px`, distância inferior de `8px` e os itens `Home`, `Movimientos` e `Entradas`, com `Home` ativo nesta etapa. Atrás dela, o container aplica o mesmo fade inferior preto da variante `navbar--liquid-v2` do Draftaco. Enquanto existir uma posição UP ou DOWN na rodada atual, `Entradas` exibe um indicador vermelho pulsante; ele permanece após F5 e desaparece ao vender toda a posição ou liquidar a rodada.
- `MarketChoice` representa os botões fixos do nó `188:3099`, posicionados `8px` acima da Navbar. Com CLOB ativo, UP e DOWN seguem midpoint/última negociação. Enquanto a fonte conecta ou fica indisponível, recebem probabilidades locais complementares entre `3%` e `97%`, atualizadas e suavizadas a cada `250ms`, sem qualquer indicação visual de mudança de origem.
- Nos últimos `5s`, `MarketChoice` substitui as escolhas por `Cerrando ronda…`, sem borda e com `Background/backgroundPrimGradStart`, e qualquer betslip aberto é fechado. Na virada, o protótipo captura o último preço real válido, determina UP/DOWN e inicia imediatamente a nova rodada.
- Somente quem participou do lado vencedor recebe o toast do nó `320:13133`, a `12px` do topo, com o valor total recebido. Ele usa a mesma entrada, permanência de `4s` e saída de `300ms` do toast de compra. Derrota ou ausência de participação não exibem mensagem de resultado.
- Em desenvolvimento, `?previewRoundResult=won` inicia uma demonstração em `00:05` e reproduz uma vitória em UP com o mesmo toast temporário; recarregar a URL reinicia a sequência. Sem esse parâmetro, a rodada segue o relógio e o fechamento reais.
- `BuyBetslip` implementa os nós `244:3684`, `244:3941` e `244:4222`: compra expandida, teclado numérico próprio e resumo recolhido. O handle recolhe por toque ou arraste para baixo; o resumo volta a expandir por toque. No resumo de compra, o retorno usa o rótulo curto `Ganancia`; o estado expandido e o toaster preservam `Ganancia potencial`.
- Ao abrir a edição de `Monto`, o teclado limpa temporariamente o campo e preserva o valor anterior. `Hecho` mantém um novo valor digitado ou restaura o valor preservado quando a edição termina vazia.
- No estado expandido de monto livre, os rótulos `Monto`, `Precio promedio` e `Ganancia potencial` permanecem em uma única linha com `18px` de altura de linha e sem altura mínima adicional. Essa composição preserva o ritmo vertical da referência dentro do estágio fixo do betslip e evita comprimir o espaço entre o handle, o cabeçalho, as métricas e o controle de deslize.
- O controle `Desliza para comprar` reutiliza a mecânica de preenchimento progressivo do Draftaco, com confirmação a partir de 60% do trilho e retorno suave ao início quando o gesto não é concluído. Compra consome asks e venda consome bids para calcular `Precio promedio` por VWAP.
- `Monto libre` e cada opção de `Un toque` possuem cotação própria por profundidade. A interface preserva os textos `Precio promedio`, `Ganancia potencial` e `Monto a recibir`; a tolerância de `1¢` funciona internamente, sem uma linha permanente de proteção. Os valores só avançam automaticamente quando o percentual inteiro muda, o preço médio acumula pelo menos `1¢` de diferença ou a disponibilidade muda.
- Ao confirmar, compra e venda recalculam no livro mais recente. Dentro da tolerância, a execução simulada e a atualização da carteira acontecem imediatamente com a nova cotação congelada; o loading global de `2s` serve apenas como confirmação antes do toaster. Acima do limite, não há loading nem alteração da carteira e o betslip exibe `El precio cambió. Revisa la nueva cotización.`; sem profundidade completa, exibe `Cotización no disponible`.
- Quando o CLOB não oferece um snapshot completo em `3s`, desconecta ou a rodada já possui interação local, a mesma interface passa a consumir cinco níveis sintéticos por lado, com spread total de `1` ponto percentual e liquidez suficiente para todo o saldo fictício, sem mensagem ou diferença visual. Taxas taker permanecem fora do cálculo.
- A carteira simulada inicia em `$2,000.00` e persiste no `localStorage` saldo em centavos, posições UP/DOWN por rodada e créditos já aplicados. Compra desconta o monto; venda credita o `grossValue` real calculado pelos bids; no resultado, cada participação restante do lado vencedor paga `$1.00` e a posição da rodada é removida. A carteira sincroniza entre abas e `?resetWallet=1` restaura o estado inicial e remove o parâmetro da URL.
- Compras acima do saldo são bloqueadas e exibem `Saldo insuficiente`; comprar exatamente o saldo permanece permitido. Rodadas pendentes restauradas após F5 são liquidadas pelo resultado oficial ou pelo snapshot persistido, com proteção contra crédito duplicado. A demonstração `?previewRoundResult=won` credita `$149.25` somente uma vez por rodada.
- Em desenvolvimento, `?testDataFailure=` aceita `gamma`, `clob`, `target`, `history`, `chainlink`, `coinbase`, `kraken` e `all-polymarket`, combináveis por vírgula, para validar a contingência sem alterar a interface. `?testQuoteReprice=buy|sell|both` força uma única piora de `2¢` por operação e rodada para validar a recotação sem movimentar a carteira.
- Não reutilize automaticamente decisões visuais do Draftaco; os projetos têm contextos independentes.
- Quando houver referência do Figma, use o nó fornecido como fonte de verdade e valide a implementação no navegador.

## Git e publicação

- Repositório: `design-draftea/pulse`.
- `main` representa a versão oficial e não deve receber trabalho direto.
- Crie uma branch por tarefa e mantenha mudanças não relacionadas fora dela.
- Pull Request, merge e deploy são etapas separadas e exigem autorização explícita.
- `.github/workflows/deploy-pages.yml` testa e publica o build estático em `https://design-draftea.github.io/pulse/` após mudanças na `main`.
- `.github/workflows/deploy-market-proxy.yml` publica manualmente o Worker gratuito do protótipo. Ele exige os secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`; a URL resultante deve ser salva na variável `PULSE_POLYMARKET_PROXY_ORIGIN`.

## Critério de entrega

Uma tarefa só pode ser descrita como concluída quando o escopo solicitado foi implementado e a validação proporcional ao risco foi executada. Relate separadamente:

1. código ou documentação alterados;
2. lint, typecheck e build;
3. validação visual e interativa local, quando aplicável;
4. Pull Request;
5. merge;
6. deploy e ambiente validado.
