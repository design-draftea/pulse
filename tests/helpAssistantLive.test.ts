import assert from 'node:assert/strict'
import test from 'node:test'
import {
  helpFaqItems,
  helpGlossaryItems,
  helpProductItems,
  helpTopicItems,
} from '../src/content/help/es-MX/helpContent.ts'
import { askHelpAssistant } from '../src/services/helpAssistant.ts'
import {
  detectSide,
  FOLLOW_UPS,
  parseMoneyAmountCents,
} from '../src/services/helpAssistantLive.ts'
import type { HelpAssistantLiveSnapshot } from '../src/services/helpAssistantSnapshot.ts'
import type { ExecutionQuote, OutcomeSide } from '../src/services/outcomeMarket.ts'

const BOOK_PRICE: Record<OutcomeSide, number> = { up: 0.62, down: 0.38 }

const buyQuote = (side: OutcomeSide, amount: number): ExecutionQuote | null => {
  if (amount > 500) return null

  const averagePrice = BOOK_PRICE[side]
  return {
    side,
    operation: 'buy',
    requestedValue: amount,
    participations: amount / averagePrice,
    grossValue: amount,
    averagePrice,
    complete: true,
    quotedAt: 0,
  }
}

const sellQuote = (side: OutcomeSide, participations: number): ExecutionQuote => {
  const averagePrice = BOOK_PRICE[side] - 0.01
  return {
    side,
    operation: 'sell',
    requestedValue: participations,
    participations,
    grossValue: participations * averagePrice,
    averagePrice,
    complete: true,
    quotedAt: 0,
  }
}

const createSnapshot = (
  overrides: Partial<HelpAssistantLiveSnapshot> = {},
): HelpAssistantLiveSnapshot => ({
  market: { prices: { up: 0.62, down: 0.38 }, status: 'live' },
  now: new Date(2026, 8, 4, 14, 32, 0).getTime(),
  pendingRoundsCount: 0,
  position: { up: 0, down: 0 },
  positionCostCents: { up: 0, down: 0 },
  previousRounds: Array.from({ length: 10 }, (_, index) => ({
    result: (index < 6 ? 'up' : 'down') as OutcomeSide,
    roundStart: index,
  })),
  quoteBuy: buyQuote,
  quoteSell: sellQuote,
  round: {
    currentPrice: 109_432.1,
    endTime: '14:45',
    isClosing: false,
    remainingSeconds: 432,
    targetPrice: 109_380,
  },
  settledEntries: [],
  wallet: {
    availableBalanceCents: 191_618,
    netResultCents: -8_382,
    openEntriesCents: 928,
    portfolioTotalCents: 192_546,
  },
  ...overrides,
})

const withPosition = (side: OutcomeSide) => createSnapshot({
  position: { up: side === 'up' ? 16 : 0, down: side === 'down' ? 16 : 0 },
  positionCostCents: { up: side === 'up' ? 928 : 0, down: side === 'down' ? 928 : 0 },
})

const ask = (query: string, snapshot?: HelpAssistantLiveSnapshot) => askHelpAssistant(
  query,
  {
    availableBalanceCents: 191_618,
    hasOpenEntries: (snapshot?.position.up ?? 0) + (snapshot?.position.down ?? 0) > 0,
    live: snapshot,
  },
)

test('responde a probabilidade implícita do lado que a pessoa realmente tem', () => {
  const result = ask('¿Cuál es la probabilidad de que yo gane?', withPosition('up'))

  assert.equal(result.confidence, 'high')
  assert.equal(result.source?.type, 'live')
  assert.equal(result.source?.id, 'implied-probability')
  assert.match(result.answer, /62%/)
  assert.match(result.answer, /16 participaciones en UP/)
  assert.match(result.answer, /probabilidad implícita/)
  assert.deepEqual(
    result.highlight?.items.map(({ label, value }) => `${label} ${value}`),
    ['UP 62%', 'DOWN 38%'],
  )
  assert.equal(result.highlight?.timeLabel, '14:32')
  assert.ok(result.details?.some((line) => line.includes('$0.58')))
  assert.ok(result.details?.some((line) => line.includes('$16.00')))
  assert.ok(result.details?.some((line) => /no es una predicción de Pulse/.test(line)))
})

test('o porcentaje do assistente usa o mesmo arredondamento da tela inicial', () => {
  const snapshot = createSnapshot({
    market: { prices: { up: 0.6249, down: 0.3751 }, status: 'live' },
  })
  const result = ask('¿Qué probabilidad hay de ganar?', snapshot)

  assert.equal(
    result.highlight?.items[0].value,
    `${Math.round(snapshot.market.prices.up! * 100)}%`,
  )
  assert.match(result.answer, /62%/)
})

test('sem entrada aberta, explica os dois lados sem inventar uma probabilidade da pessoa', () => {
  const result = ask('¿Qué probabilidad tengo de ganar?', createSnapshot())

  assert.match(result.answer, /UP a \$0\.62 \(62%\) y DOWN a \$0\.38 \(38%\)/)
  assert.match(result.answer, /Todavía no tienes una entrada/)
})

test('não inventa número quando o preço não está disponível', () => {
  const withoutPrices = createSnapshot({
    market: { prices: { up: null, down: null }, status: 'unavailable' },
  })
  const unavailableMarket = createSnapshot({
    market: { prices: { up: 0.62, down: 0.38 }, status: 'unavailable' },
  })

  for (const snapshot of [withoutPrices, unavailableMarket]) {
    const result = ask('¿Cuál es la probabilidad de que yo gane?', snapshot)

    assert.match(result.answer, /no tengo el precio de UP y DOWN/)
    assert.equal(result.highlight, undefined)
  }
})

test('calcula o retorno com a mesma cotação que o betslip usaria', () => {
  const result = ask('¿Cuánto gano si pongo $10 en UP?', createSnapshot())

  assert.equal(result.source?.id, 'return-simulation')
  assert.match(result.answer, /Con \$10\.00 en UP/)
  assert.match(result.answer, /16\.13 participaciones/)
  assert.match(result.answer, /\$0\.62/)
  assert.ok(result.details?.some((line) => line.includes('$16.13')))
  assert.ok(result.details?.some((line) => line.includes('+$6.13')))
})

test('lê montos escritos de formas diferentes', () => {
  assert.equal(parseMoneyAmountCents('¿cuánto gano con $10?'), 1_000)
  assert.equal(parseMoneyAmountCents('si pongo 10.50 en up'), 1_050)
  assert.equal(parseMoneyAmountCents('si pongo 10,50 en up'), 1_050)
  assert.equal(parseMoneyAmountCents('si invierto $1,000 en down'), 100_000)
  assert.equal(parseMoneyAmountCents('si pongo cincuenta en up'), 5_000)
  assert.equal(parseMoneyAmountCents('si pongo diez en up'), 1_000)
})

test('não confunde minutos, rondas ou porcentajes com un monto', () => {
  assert.equal(parseMoneyAmountCents('¿cuánto gano en 15 minutos?'), null)
  assert.equal(parseMoneyAmountCents('¿cuánto gano en las últimas 10 rondas?'), null)
  assert.equal(parseMoneyAmountCents('¿cuánto gano con 62%?'), null)
  assert.equal(parseMoneyAmountCents('¿cuánto gano con 5 participaciones?'), null)
})

test('reconhece o lado apenas quando ele é inequívoco', () => {
  assert.equal(detectSide('si pongo 10 en up'), 'up')
  assert.equal(detectSide('si pongo 10 abajo'), 'down')
  assert.equal(detectSide('si pongo 10 en up o down'), null)
  assert.equal(detectSide('si pongo 10'), null)
})

test('pede o lado quando o monto existe mas a direção não', () => {
  const result = ask('¿Cuánto gano si pongo $10?', createSnapshot())

  assert.match(result.answer, /Dime si es UP o DOWN/)
  assert.equal(result.suggestions.length, 2)
})

test('avisa quando não há profundidade para o monto pedido', () => {
  const result = ask('¿Cuánto gano si pongo $900 en UP?', createSnapshot())

  assert.match(result.answer, /no hay participaciones suficientes de UP/i)
  assert.ok(!/\$1,451/.test(result.answer))
})

test('avisa quando o monto passa do máximo aceito pelo campo de compra', () => {
  const result = ask('¿Cuánto gano si pongo $200,000 en UP?', createSnapshot())

  assert.match(result.answer, /\$99,999\.99/)
})

test('descreve a entrada aberta com custo, pago potencial e valor de venda', () => {
  const result = ask('¿Cómo va mi entrada?', withPosition('down'))

  assert.equal(result.source?.id, 'my-entry')
  assert.equal(result.action?.id, 'entries')
  assert.match(result.answer, /16 participaciones en DOWN/)
  assert.ok(result.details?.some((line) => line.includes('precio promedio $0.58')))
  assert.ok(result.details?.some((line) => line.includes('recibes $16.00')))
  assert.ok(result.details?.some((line) => /vendes DOWN ahora, recibes \$5\.92/.test(line)))
})

test('menciona entradas de rondas anteriores esperando liquidação', () => {
  const result = ask('¿Cómo va mi entrada?', createSnapshot({ pendingRoundsCount: 2 }))

  assert.match(result.answer, /2 entradas de rondas anteriores/)
})

test('conta as últimas rondas e sempre fecha com a ressalva de independência', () => {
  const result = ask('¿Cuántas rondas terminaron arriba?', createSnapshot())

  assert.equal(result.source?.id, 'previous-rounds-count')
  assert.equal(result.action?.id, 'previous-rounds')
  assert.match(result.answer, /De las últimas 10 rondas, 6 terminaron arriba y 4 abajo/)
  assert.ok(result.details?.some((line) => /Cada ronda es independiente/.test(line)))
})

test('não conta rondas quando o histórico ainda não carregou', () => {
  const result = ask('¿Cuántas rondas terminaron arriba?', createSnapshot({
    previousRounds: [],
  }))

  assert.match(result.answer, /no tengo cargado el historial/)
})

test('responde o tempo restante e a comparação contra o precio objetivo', () => {
  const result = ask('¿Cuánto tiempo queda?', createSnapshot())

  assert.equal(result.source?.id, 'round-state')
  assert.match(result.answer, /Quedan 07:12 en esta ronda, que cierra a las 14:45/)
  assert.ok(result.details?.some((line) => line.includes('$109,432.10')))
  assert.ok(result.details?.some((line) => /ganaría UP/.test(line)))
})

test('responde o preço do Bitcoin com o objetivo antes da comparação', () => {
  const result = ask('¿Cuánto está Bitcoin?', createSnapshot({
    round: {
      currentPrice: 109_300,
      endTime: '14:45',
      isClosing: false,
      remainingSeconds: 432,
      targetPrice: 109_380,
    },
  }))

  assert.match(result.answer, /Bitcoin está en \$109,300\.00/)
  assert.equal(result.details?.[0], 'El precio objetivo de esta ronda es $109,380.00.')
  assert.ok(result.details?.some((line) => /ganaría DOWN/.test(line)))
})

test('diz que a ronda está cerrando em vez de mostrar um relógio zerado', () => {
  const result = ask('¿Cuánto tiempo queda?', createSnapshot({
    round: {
      currentPrice: 109_432.1,
      endTime: '14:45',
      isClosing: true,
      remainingSeconds: 3,
      targetPrice: 109_380,
    },
  }))

  assert.match(result.answer, /está cerrando en este momento/)
})

test('recusa recomendação e ainda entrega o preço de mercado', () => {
  const result = ask('¿Me conviene UP?', withPosition('up'))

  assert.equal(result.source?.type, 'policy')
  assert.match(result.answer, /no puedo recomendarte UP o DOWN/)
  assert.match(result.answer, /UP a \$0\.62 \(62%\) y DOWN a \$0\.38 \(38%\)/)
})

test('pergunta de probabilidade não cai na guarda de recomendação', () => {
  for (const query of [
    '¿Cuál es la probabilidad de que yo gane?',
    '¿Qué tan probable es UP?',
    '¿Tengo chance de ganar?',
    '¿Cuántas posibilidades tengo?',
  ]) {
    const result = ask(query, withPosition('up'))

    assert.equal(result.source?.type, 'live', query)
    assert.equal(result.source?.id, 'implied-probability', query)
  }
})

test('o saldo ganha o retrato da carteira quando existe estado ao vivo', () => {
  const result = ask('¿Cuál es mi saldo disponible?', createSnapshot())

  assert.match(result.answer, /\$1,916\.18/)
  assert.ok(result.details?.some((line) => line.includes('$1,925.46')))
  assert.ok(result.details?.some((line) => line.includes('-$83.82')))
})

test('o conteúdo curado continua vencendo os dados ao vivo', () => {
  const snapshot = withPosition('up')
  const curatedItems = [
    ...helpFaqItems.map((item) => ({ id: item.id, queries: [item.question, ...item.examples] })),
    ...helpGlossaryItems.map((item) => ({ id: item.id, queries: item.examples })),
    ...helpProductItems.map((item) => ({ id: item.id, queries: item.examples })),
    ...helpTopicItems.map((item) => ({ id: item.id, queries: item.examples })),
  ]

  for (const { id, queries } of curatedItems) {
    for (const query of queries) {
      const result = ask(query, snapshot)

      assert.equal(result.confidence, 'high', `${id} · ${query}`)
      assert.equal(result.source?.id, id, `${id} · ${query}`)
    }
  }
})

test('sem estado ao vivo, o assistente mantém o comportamento anterior', () => {
  const result = askHelpAssistant('¿Cuál es la probabilidad de que yo gane?', {
    availableBalanceCents: 191_618,
    hasOpenEntries: false,
  })

  assert.equal(result.confidence, 'low')
  assert.equal(result.source, undefined)
})

test('todo chip de acompanhamento resolve em conteúdo de alta confiança', () => {
  for (const followUp of Object.values(FOLLOW_UPS)) {
    const result = ask(followUp.query, createSnapshot())

    assert.equal(result.confidence, 'high', followUp.query)
    assert.notEqual(result.source, undefined, followUp.query)
    assert.equal(result.suggestions.every((item) => item.id !== followUp.id), true, followUp.query)
  }
})

test('as respostas ao vivo oferecem um próximo passo em vez de terminar em silêncio', () => {
  const cases = [
    ['¿Cuál es la probabilidad de que yo gane?', createSnapshot()],
    ['¿Cuál es la probabilidad de que yo gane?', withPosition('up')],
    ['¿Cuánto cuesta UP ahora?', createSnapshot()],
    ['¿Cuánto gano si pongo $10 en UP?', createSnapshot()],
    ['¿Cómo va mi entrada?', withPosition('up')],
    ['¿Cómo va mi entrada?', createSnapshot()],
    ['¿Cuántas rondas terminaron arriba?', createSnapshot()],
    ['¿Cuánto tiempo queda?', createSnapshot()],
    ['¿Cuánto está Bitcoin?', createSnapshot()],
    ['¿Me conviene UP?', createSnapshot()],
  ] as const

  for (const [query, snapshot] of cases) {
    const result = ask(query, snapshot)

    assert.ok(result.suggestions.length > 0, query)
    assert.ok(result.suggestions.length <= 2, query)
  }
})

test('depois de mostrar una ganancia estimada, ofrece la pregunta sobre la pérdida', () => {
  const result = ask('¿Cuánto gano si pongo $10 en UP?', createSnapshot())

  assert.ok(result.suggestions.some(({ id }) => id === FOLLOW_UPS.canLose.id))
})

test('o histórico oferece o dado del momento en vez de dejar la racha sola', () => {
  const result = ask('¿Cuántas rondas terminaron arriba?', createSnapshot())

  assert.ok(result.suggestions.some(({ id }) => id === FOLLOW_UPS.liveProbability.id))
})

const settled = (
  overrides: Partial<HelpAssistantLiveSnapshot['settledEntries'][number]> = {},
) => ({
  amountCents: 1_000,
  outcome: 'won' as const,
  participations: 16,
  payoutCents: 1_600,
  roundEnd: new Date(2026, 8, 4, 13, 15, 0).getTime(),
  side: 'up' as const,
  ...overrides,
})

test('cotiza la venta con el mismo quoteSell de la posición real', () => {
  const result = ask('¿Cuánto me dan si vendo ahora?', withPosition('up'))

  assert.equal(result.source?.id, 'sale-value')
  assert.equal(result.action?.id, 'entries')
  assert.match(result.answer, /16 participaciones de UP, recibes \$9\.76/)
  assert.ok(result.details?.some((line) => /\$0\.61 por participación/.test(line)))
  assert.ok(result.details?.some((line) => /esperas al cierre y UP gana, recibes \$16\.00/.test(line)))
})

test('no inventa un monto de venta cuando no hay posición o no hay precio', () => {
  const withoutPosition = ask('¿Cuánto me dan si vendo ahora?', createSnapshot())
  assert.match(withoutPosition.answer, /no tienes participaciones para vender/)

  const withoutQuote = ask('¿Cuánto me dan si vendo ahora?', {
    ...withPosition('up'),
    quoteSell: () => null,
  })
  assert.match(withoutQuote.answer, /no hay precio de venta disponible/)
  assert.ok(!/\$9\.76/.test(withoutQuote.answer))
})

test('recusa conselho de venda mas entrega os dois montos', () => {
  const result = ask('¿Me conviene vender?', withPosition('up'))

  assert.equal(result.source?.type, 'policy')
  assert.match(result.answer, /no puedo recomendarte vender/)
  assert.match(result.answer, /si vendes ahora recibes \$9\.76/)
  assert.match(result.answer, /esperas al cierre y aciertas recibes \$16\.00/)
})

test('cuenta el resultado de la ronda que se liquidó', () => {
  const cases = [
    ['won', /ganaste/, /Recibiste \$16\.00/],
    ['lost', /no acertaste/, /No recibiste pago/],
    ['sold', /vendiste antes del cierre/, /por la venta/],
    ['canceled', /se canceló/, /Se te devolvieron/],
  ] as const

  for (const [outcome, headline, detail] of cases) {
    const result = ask('¿Gané la ronda anterior?', createSnapshot({
      settledEntries: [settled({ outcome })],
    }))

    assert.equal(result.source?.id, 'last-result', outcome)
    assert.match(result.answer, /cerró a las 13:15/, outcome)
    assert.match(result.answer, headline, outcome)
    assert.ok(result.details?.some((line) => detail.test(line)), outcome)
  }
})

test('usa la ronda más reciente aunque lleguen desordenadas', () => {
  const older = settled({ outcome: 'lost', roundEnd: new Date(2026, 8, 4, 12, 45, 0).getTime() })
  const newer = settled({ outcome: 'won', roundEnd: new Date(2026, 8, 4, 13, 30, 0).getTime() })
  const result = ask('¿Gané la ronda anterior?', createSnapshot({
    settledEntries: [older, newer],
  }))

  assert.match(result.answer, /13:30/)
  assert.match(result.answer, /ganaste/)
})

test('sin rondas liquidadas no inventa un resultado', () => {
  const result = ask('¿Gané la ronda anterior?', createSnapshot())

  assert.match(result.answer, /Todavía no tienes ninguna ronda liquidada/)
})

test('una pregunta de total responde el acumulado, no la última ronda', () => {
  for (const query of ['¿Cuánto gané hoy?', '¿Cuánto llevo perdido?']) {
    const result = ask(query, createSnapshot({ settledEntries: [settled()] }))

    assert.equal(result.source?.id, 'accumulated-result', query)
    assert.match(result.answer, /resultado acumulado es -\$83\.82/, query)
    assert.ok(
      result.details?.some((line) => /No puedo separarlo por día/.test(line)),
      query,
    )
  }
})

test('`de que yo gane` não é lido como pretérito', () => {
  const result = ask('¿Cuál es la probabilidad de que yo gane?', createSnapshot({
    settledEntries: [settled()],
  }))

  assert.equal(result.source?.id, 'implied-probability')
})

test('`cuántas rondas hay al día` não vira contagem de resultados', () => {
  const result = ask('¿Cuántas rondas hay al día?', createSnapshot())

  assert.notEqual(result.source?.id, 'previous-rounds-count')
  assert.equal(result.source?.id, 'rounds-per-day')
  assert.match(result.answer, /96 rondas por día/)
})

test('`puedo cambiar de UP a DOWN` não vira explicação de preço', () => {
  const result = ask('¿Puedo cambiar de UP a DOWN?', createSnapshot())

  assert.notEqual(result.source?.id, 'why-price-moves')
  assert.equal(result.source?.id, 'change-side')
})

test('responde a qué hora empieza la próxima ronda', () => {
  const result = ask('¿A qué hora empieza la próxima ronda?', createSnapshot())

  assert.equal(result.source?.id, 'round-state')
  assert.match(result.answer, /La próxima ronda empieza a las 14:45/)
})

test('erros de digitação chegam às respostas com dados ao vivo', () => {
  const cases = [
    ['¿Cuanto tienpo qeda?', 'round-state'],
    ['cual es la probabilidd de ganar', 'implied-probability'],
    ['cuanto me dan si vemdo ahora', 'sale-value'],
  ] as const

  for (const [query, expectedId] of cases) {
    const result = ask(query, withPosition('up'))

    assert.equal(result.confidence, 'high', query)
    assert.equal(result.source?.id, expectedId, query)
  }
})

test('a correção de digitação não inventa assunto para texto externo', () => {
  const result = ask('¿Cómo preparo una pizza?', createSnapshot())

  assert.equal(result.confidence, 'low')
  assert.equal(result.source, undefined)
})
