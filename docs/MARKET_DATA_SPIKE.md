# Prova técnica de dados de mercado no navegador

Este documento registra a prova executada na branch histórica `spike/market-data-browser`. A interface diagnóstica citada nas seções originais não faz parte do layout atual; as decisões efetivamente incorporadas estão em **Decisão aplicada no protótipo**.

## Objetivo

Validar, antes da implementação do protótipo, se as fontes públicas necessárias funcionam diretamente em um navegador, sem credenciais ou backend:

- preço spot do Bitcoin com atualizações frequentes;
- preço Chainlink TWAP de 60 segundos usado como referência pela Polymarket;
- descoberta automática do mercado BTC UP/DOWN de 15 minutos;
- livro de ofertas e preços UP/DOWN;
- reconexão e nova assinatura depois de uma queda;
- troca automática do intervalo local de 15 minutos.

## Fontes testadas

| Responsabilidade | Fonte | Transporte |
| --- | --- | --- |
| Movimento visual do BTC | Coinbase Advanced Trade `BTC-USD` | WebSocket público |
| Referência compatível com a regra estudada | Chainlink TWAP 60s via Polymarket RTDS | WebSocket público |
| Descoberta da rodada atual | Polymarket Gamma API | HTTPS público |
| Preços negociáveis de UP/DOWN | Polymarket CLOB market channel | WebSocket público |

## Como executar

```bash
pnpm install
pnpm dev
```

A tela conecta às quatro fontes automaticamente. Os botões **Forzar reconexión** encerram deliberadamente cada WebSocket; o cliente aguarda dois segundos, conecta novamente e repete a assinatura.

## Limites da prova

- A página é um instrumento diagnóstico e não define o layout final do Pulse.
- O preço spot não deve ser usado para liquidar uma rodada que tenha regra baseada em Chainlink TWAP.
- O RTDS não oferece snapshot, histórico ou replay; após abrir ou reconectar, é necessário aguardar o próximo update.
- Para um protótipo robusto, o último valor válido e seu timestamp precisam ficar em memória e a interface deve representar dados atrasados ou indisponíveis.
- A descoberta tenta a janela atual, a anterior e a seguinte para tolerar a publicação da rodada perto da virada.

## Resultado

Validação executada em 2026-08-28, em uma página Vite local aberta no navegador integrado:

- as quatro fontes conectaram diretamente no navegador, sem credenciais;
- a Gamma API respondeu com CORS habilitado e entregou a rodada e os dois tokens CLOB;
- Coinbase e Chainlink receberam preços continuamente, com timestamps recentes;
- o CLOB entregou snapshot inicial, bid, ask, última negociação e atualizações contínuas para UP e DOWN;
- o encerramento forçado dos três WebSockets foi recuperado automaticamente em cerca de dois segundos, com nova assinatura e continuidade dos dados;
- após 45 segundos adicionais, os três WebSockets continuavam `En línea`, cada um com uma reconexão registrada e sem erros ou warnings no console do navegador;
- uma virada real de intervalo às 17:15 foi detectada; a Gamma API encontrou o novo slug e o CLOB assinou os tokens da nova rodada sem recarregar a página;
- no recorte de estabilidade, Coinbase chegou a 326 mensagens, Chainlink a 62 e CLOB a 19.133. O volume do CLOB próximo ao fechamento confirma que o app final não deve atualizar o React a cada evento recebido.

## Decisão aplicada no protótipo

A implementação atual do Pulse usa uma versão mais restrita da prova:

1. `openPrice` da rota de preço de cripto da Polymarket como `Precio objetivo`, acessado por proxy local do Vite porque a rota não libera CORS para o navegador;
2. Chainlink TWAP de 60 segundos via Polymarket RTDS como fonte única de `Precio actual` e do gráfico;
3. relógio real para calcular as janelas contínuas de 15 minutos e exibi-las no fuso do dispositivo que acessa o protótipo;
4. estados explícitos de conexão, reconexão, dado atrasado e indisponibilidade;
5. sem Coinbase e sem fallback inventado na interface.

O proxy do Vite atende apenas ao desenvolvimento e ao preview local. Uma publicação futura precisará substituir essa camada por uma função serverless ou backend sob controle do Pulse.

## Recomendação original da prova

A arquitetura sem backend é adequada para o protótipo de teste com usuários, desde que:

1. Coinbase seja usada para a animação frequente do preço e do gráfico;
2. Chainlink TWAP seja mantida separada como referência da regra e acompanhada por timestamp de frescor;
3. Gamma e CLOB sejam usados para descobrir a rodada e representar o preço de mercado UP/DOWN;
4. eventos do CLOB sejam agregados e aplicados à interface no máximo algumas vezes por segundo;
5. todos os feeds tenham estados explícitos de reconexão, dado atrasado e indisponibilidade;
6. a liquidação simulada nunca misture o spot da Coinbase com uma regra definida pelo TWAP Chainlink.

Para produto real, liquidação, auditoria, histórico e garantias de disponibilidade exigiriam uma camada confiável fora do navegador. Isso não é necessário para esta etapa de protótipo.
