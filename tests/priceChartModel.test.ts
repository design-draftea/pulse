import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendRollingPricePoint,
  appendRoundPricePoint,
  calculatePriceChartDomain,
  clampPriceChartAnchor,
  countPricePointGaps,
  DOMAIN_CONTRACTION_DELAY_MS,
  DOMAIN_SHIFT_CONFIRMATION_MS,
  getContinuousVisiblePricePoints,
  getPriceChartRangeConfig,
  getPriceChartTimeTicks,
  getPriceChartWindowPoints,
  interpolatePriceAt,
  interpolatePriceChartDomain,
  mergePricePointSeries,
  projectPriceToY,
  resolvePriceChartTarget,
  stabilizePriceChartDomain,
  type PriceChartDomain,
} from '../src/components/priceChartModel.ts'

test('organiza pontos por rodada, deduplica por segundo e respeita o limite', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  let points = [{ timestamp: roundStart, value: 100 }]

  points = appendRoundPricePoint(
    points,
    { timestamp: roundStart + 1_800, value: 102 },
    roundStart,
    3,
  )
  points = appendRoundPricePoint(
    points,
    { timestamp: roundStart + 1_200, value: 101 },
    roundStart,
    3,
  )
  points = appendRoundPricePoint(
    points,
    { timestamp: roundStart + 2_000, value: 103 },
    roundStart,
    3,
  )
  points = appendRoundPricePoint(
    points,
    { timestamp: roundStart + 3_000, value: 104 },
    roundStart,
    3,
  )

  assert.deepEqual(points, [
    { timestamp: roundStart + 1_800, value: 102 },
    { timestamp: roundStart + 2_000, value: 103 },
    { timestamp: roundStart + 3_000, value: 104 },
  ])
})

test('preserva o ponto inicial exato da rodada no primeiro segundo', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = appendRoundPricePoint(
    [{ timestamp: roundStart, value: 100 }],
    { timestamp: roundStart + 500, value: 101 },
    roundStart,
    120,
  )

  assert.deepEqual(points, [{ timestamp: roundStart, value: 100 }])
})

test('remove pontos de outra rodada ao receber o primeiro preço novo', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = appendRoundPricePoint(
    [{ timestamp: roundStart - 1_000, value: 99 }],
    { timestamp: roundStart, value: 100 },
    roundStart,
    120,
  )

  assert.deepEqual(points, [{ timestamp: roundStart, value: 100 }])
})

test('mantém uma série móvel, deduplicada por segundo, por até uma hora', () => {
  const now = Date.UTC(2026, 8, 1, 11, 0, 0)
  const earliest = now - 60 * 60_000
  const points = appendRollingPricePoint(
    [
      { timestamp: earliest - 1_000, value: 90 },
      { timestamp: now - 500, value: 100 },
    ],
    { timestamp: now - 100, value: 101 },
    earliest,
    3_601,
  )

  assert.deepEqual(points, [{ timestamp: now - 100, value: 101 }])
})

test('mescla candles e observações priorizando o ponto observado no mesmo segundo', () => {
  const start = Date.UTC(2026, 8, 1, 10, 0, 0)
  const points = mergePricePointSeries(
    [
      { timestamp: start - 1_000, value: 99 },
      { timestamp: start, value: 100 },
      { timestamp: start + 60_000, value: 101 },
    ],
    [
      { timestamp: start + 60_500, value: 105 },
      { timestamp: start + 61_000, value: 106 },
    ],
    start,
  )

  assert.deepEqual(points, [
    { timestamp: start, value: 100 },
    { timestamp: start + 60_500, value: 105 },
    { timestamp: start + 61_000, value: 106 },
  ])
})

test('configura escala e marcações para cada range do gráfico', () => {
  const seriesRight = 240

  assert.deepEqual(getPriceChartRangeConfig('live', seriesRight), {
    durationMs: null,
    pixelsPerSecond: 24,
    timeTickIntervalMs: 5_000,
  })
  assert.deepEqual(getPriceChartRangeConfig('5m', seriesRight), {
    durationMs: 5 * 60_000,
    pixelsPerSecond: 0.8,
    timeTickIntervalMs: 2 * 60_000,
  })
  assert.equal(getPriceChartRangeConfig('15m', seriesRight).durationMs, 15 * 60_000)
  assert.equal(getPriceChartRangeConfig('15m', seriesRight).timeTickIntervalMs, 5 * 60_000)
  assert.equal(getPriceChartRangeConfig('1h', seriesRight).pixelsPerSecond, 1 / 15)
  assert.equal(getPriceChartRangeConfig('1h', seriesRight).timeTickIntervalMs, 20 * 60_000)
})

test('mantém exatamente três horários em posições fixas e distribuídas', () => {
  const anchorTime = Date.UTC(2026, 8, 4, 10, 54, 48)

  assert.deepEqual(
    getPriceChartTimeTicks(anchorTime, 2 * 60_000, 16, 236, 24),
    [
      { timestamp: Date.UTC(2026, 8, 4, 10, 50, 0), x: 40 },
      { timestamp: Date.UTC(2026, 8, 4, 10, 52, 0), x: 126 },
      { timestamp: Date.UTC(2026, 8, 4, 10, 54, 0), x: 212 },
    ],
  )

  assert.deepEqual(
    getPriceChartTimeTicks(anchorTime, 20 * 60_000, 16, 236, 24),
    [
      { timestamp: Date.UTC(2026, 8, 4, 10, 0, 0), x: 40 },
      { timestamp: Date.UTC(2026, 8, 4, 10, 20, 0), x: 126 },
      { timestamp: Date.UTC(2026, 8, 4, 10, 40, 0), x: 212 },
    ],
  )
})

test('redistribui os três horários sem cortar os rótulos em telas estreitas', () => {
  const ticks = getPriceChartTimeTicks(20_000, 5_000, 16, 181, 24)

  assert.equal(ticks.length, 3)
  assert.deepEqual(ticks.map(({ x }) => x), [40, 98.5, 157])
})

test('o domínio de um range considera todos os pontos visíveis', () => {
  const points = [
    { timestamp: 0, value: 50 },
    ...Array.from({ length: 20 }, (_, index) => ({
      timestamp: (index + 1) * 1_000,
      value: 100 + index / 10,
    })),
  ]
  const liveDomain = calculatePriceChartDomain(points, null)
  const rangeDomain = calculatePriceChartDomain(points, null, {
    applyTrendShift: false,
    includeAllPoints: true,
  })

  assert.ok(liveDomain.bottom > 50)
  assert.ok(rangeDomain.bottom <= 50)
})

test('interpola a passagem pela borda esquerda usando os pontos reais vizinhos', () => {
  const displayTime = 10_000
  const visible = getContinuousVisiblePricePoints(
    [
      { timestamp: 4_000, value: 100 },
      { timestamp: 8_000, value: 104 },
      { timestamp: 10_000, value: 105 },
    ],
    displayTime,
    100,
    0,
    24,
  )

  assert.equal(visible.continuityApplied, true)
  assert.equal(visible.points[0].x, 0)
  assert.ok(visible.points[0].value > 100)
  assert.ok(visible.points[0].value < 104)
  assert.equal(visible.points.at(-1)?.x, 100)
})

test('mantém a série original quando todos os pontos já estão visíveis', () => {
  const visible = getContinuousVisiblePricePoints(
    [
      { timestamp: 9_000, value: 100 },
      { timestamp: 10_000, value: 101 },
    ],
    10_000,
    100,
    0,
    24,
  )

  assert.equal(visible.continuityApplied, false)
  assert.equal(visible.points.length, 2)
})

test('amplia o domínio imediatamente e atrasa a contração por cinco segundos', () => {
  const wideDomain: PriceChartDomain = { bottom: 90, top: 150, step: 10 }
  const narrowDomain: PriceChartDomain = { bottom: 100, top: 115, step: 2.5 }
  const expandedDomain: PriceChartDomain = { bottom: 80, top: 200, step: 20 }
  const points = [
    { timestamp: 1_000, value: 104 },
    { timestamp: 2_000, value: 106 },
  ]
  const initial = {
    domain: wideDomain,
    contractionCandidateKey: null,
    contractionStartedAt: null,
    shiftCandidateKey: null,
    shiftStartedAt: null,
  }
  const pending = stabilizePriceChartDomain(initial, narrowDomain, points, 10_000)
  const stillPending = stabilizePriceChartDomain(
    pending,
    narrowDomain,
    points,
    10_000 + DOMAIN_CONTRACTION_DELAY_MS - 1,
  )
  const contracted = stabilizePriceChartDomain(
    stillPending,
    narrowDomain,
    points,
    10_000 + DOMAIN_CONTRACTION_DELAY_MS,
  )
  const expanded = stabilizePriceChartDomain(
    contracted,
    expandedDomain,
    [{ timestamp: 3_000, value: 180 }],
    20_000,
  )

  assert.equal(pending.domain, wideDomain)
  assert.equal(stillPending.domain, wideDomain)
  assert.equal(contracted.domain, narrowDomain)
  assert.equal(expanded.domain, expandedDomain)
})

test('confirma a tendência antes de deslocar o domínio no mesmo passo', () => {
  const currentDomain: PriceChartDomain = { bottom: 100, top: 115, step: 2.5 }
  const shiftedDomain: PriceChartDomain = { bottom: 105, top: 120, step: 2.5 }
  const points = [
    { timestamp: 1_000, value: 109 },
    { timestamp: 2_000, value: 112 },
  ]
  const initial = {
    domain: currentDomain,
    contractionCandidateKey: null,
    contractionStartedAt: null,
    shiftCandidateKey: null,
    shiftStartedAt: null,
  }
  const pending = stabilizePriceChartDomain(initial, shiftedDomain, points, 10_000)
  const shifted = stabilizePriceChartDomain(
    pending,
    shiftedDomain,
    points,
    10_000 + DOMAIN_SHIFT_CONFIRMATION_MS,
  )

  assert.equal(pending.domain, currentDomain)
  assert.equal(shifted.domain, shiftedDomain)
})

test('interpola o domínio em valores intermediários durante a transição', () => {
  const from: PriceChartDomain = { bottom: 100, top: 115, step: 2.5 }
  const to: PriceChartDomain = { bottom: 110, top: 140, step: 5 }
  const halfway = interpolatePriceChartDomain(from, to, 0.5)

  assert.deepEqual(halfway, {
    bottom: 105,
    top: 127.5,
    step: 3.75,
    trendShiftIntervals: undefined,
  })
  assert.deepEqual(interpolatePriceChartDomain(from, to, 1), to)
})

test('conta apenas lacunas maiores que o limite de atualização', () => {
  assert.equal(countPricePointGaps([
    { timestamp: 0, value: 100 },
    { timestamp: 1_000, value: 101 },
    { timestamp: 4_000, value: 102 },
  ]), 1)
})

test('interpola o preço entre dois pontos e fixa os extremos da série', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = [
    { timestamp: roundStart, value: 100 },
    { timestamp: roundStart + 60_000, value: 130 },
  ]

  assert.equal(interpolatePriceAt(points, roundStart + 30_000), 115)
  assert.equal(interpolatePriceAt(points, roundStart - 5_000), 100)
  assert.equal(interpolatePriceAt(points, roundStart + 90_000), 130)
  assert.equal(interpolatePriceAt([], roundStart), null)
})

test('a janela arrastada inclui as bordas interpoladas de um trecho sem pontos', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = [
    { timestamp: roundStart, value: 100 },
    { timestamp: roundStart + 60_000, value: 160 },
    { timestamp: roundStart + 120_000, value: 100 },
  ]
  const window = getPriceChartWindowPoints(
    points,
    roundStart + 20_000,
    roundStart + 30_000,
  )

  assert.deepEqual(window, [
    { timestamp: roundStart + 20_000, value: 120 },
    { timestamp: roundStart + 30_000, value: 130 },
  ])

  const crossing = getPriceChartWindowPoints(
    points,
    roundStart + 30_000,
    roundStart + 90_000,
  )

  assert.deepEqual(crossing.map(({ value }) => value), [130, 160, 130])
})

test('o arrasto para no ponto mais antigo e não avança além do último', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = [
    { timestamp: roundStart, value: 100 },
    { timestamp: roundStart + 120_000, value: 110 },
  ]
  const latest = roundStart + 120_000
  const windowSpan = 10_000

  assert.equal(
    clampPriceChartAnchor(roundStart - 60_000, points, windowSpan, latest),
    roundStart + windowSpan,
  )
  assert.equal(
    clampPriceChartAnchor(latest + 60_000, points, windowSpan, latest),
    latest,
  )
  assert.equal(
    clampPriceChartAnchor(roundStart + 40_000, points, windowSpan, latest),
    roundStart + 40_000,
  )
  assert.equal(
    clampPriceChartAnchor(roundStart, [], windowSpan, latest),
    latest,
  )
})

test('o domínio da janela arrastada não desloca pela tendência', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const climbing = Array.from({ length: 8 }, (_, index) => ({
    timestamp: roundStart + index * 1_000,
    value: 100 + index * 2,
  }))
  const live = calculatePriceChartDomain(climbing, null)
  const panned = calculatePriceChartDomain(climbing, null, {
    applyTrendShift: false,
  })

  assert.equal(live.trendShiftIntervals, 2)
  assert.equal(panned.trendShiftIntervals, 0)
  assert.equal(live.step, panned.step)
  assert.equal(live.bottom - panned.bottom, panned.step * 2)
})

test('mantém a linha desenhada quando a janela cai entre dois pontos distantes', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = [
    { timestamp: roundStart, value: 100 },
    { timestamp: roundStart + 60_000, value: 160 },
  ]
  const seriesRight = 236
  const pixelsPerSecond = 24
  const visible = getContinuousVisiblePricePoints(
    points,
    roundStart + 10_000,
    seriesRight,
    0,
    pixelsPerSecond,
  )

  assert.equal(visible.points.length, 2)
  assert.equal(visible.points[0].x, 0)
  assert.equal(visible.points[1].x, seriesRight)
  assert.ok(Math.abs(visible.points[0].value - 100.17) < 0.02)
  assert.ok(Math.abs(visible.points[1].value - 110) < 0.02)
  assert.equal(visible.continuityApplied, true)
})

test('a série ao vivo termina no ponto atual e não cria guarda à direita', () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 30, 0)
  const points = Array.from({ length: 6 }, (_, index) => ({
    timestamp: roundStart + index * 1_000,
    value: 100 + index,
  }))
  const visible = getContinuousVisiblePricePoints(
    points,
    roundStart + 5_000,
    236,
    0,
    24,
  )

  assert.equal(visible.points.length, points.length)
  assert.equal(visible.points[5].x, 236)
  assert.equal(visible.continuityApplied, false)
})

// A faixa da grade do PriceChart: sete linhas de 16 a 220, passo de 34.
const PLOT_TOP = 16
const PLOT_BOTTOM = 220
const TARGET_DOMAIN = { bottom: 80_190, top: 80_220 }

test('preço objetivo dentro do domínio não trava e segue a projeção da faixa', () => {
  const placement = resolvePriceChartTarget(
    80_205,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.equal(placement?.clamp, 'none')
  assert.equal(
    placement?.y,
    projectPriceToY(80_205, TARGET_DOMAIN, PLOT_TOP, PLOT_BOTTOM),
  )
  // Meio exato do domínio cai no meio exato da faixa.
  assert.equal(placement?.y, 118)
})

test('preço objetivo acima do domínio trava no topo e abaixo trava na base', () => {
  const above = resolvePriceChartTarget(
    80_400,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )
  const below = resolvePriceChartTarget(
    80_000,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.deepEqual(above, { y: 16, clamp: 'above' })
  assert.deepEqual(below, { y: 220, clamp: 'below' })
})

test('as bordas do domínio ainda contam como dentro da faixa', () => {
  const atTop = resolvePriceChartTarget(
    TARGET_DOMAIN.top,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )
  const atBottom = resolvePriceChartTarget(
    TARGET_DOMAIN.bottom,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.deepEqual(atTop, { y: 16, clamp: 'none' })
  assert.deepEqual(atBottom, { y: 220, clamp: 'none' })
})

test('o travamento vem do domínio estabilizado e a posição do interpolado', () => {
  // O domínio estabilizado exclui o objetivo, então ele continua travado
  // mesmo que o domínio interpolado já o tenha alcançado no meio da animação.
  const placement = resolvePriceChartTarget(
    80_230,
    TARGET_DOMAIN,
    { bottom: 80_200, top: 80_240 },
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.deepEqual(placement, { y: 16, clamp: 'above' })
})

test('objetivo dentro do domínio estabilizado nunca escapa da faixa', () => {
  // Durante a interpolação o domínio de render pode ser mais estreito que o
  // estabilizado; a posição é contida na faixa em vez de vazar para fora dela.
  const placement = resolvePriceChartTarget(
    80_219,
    TARGET_DOMAIN,
    { bottom: 80_205, top: 80_215 },
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.equal(placement?.clamp, 'none')
  assert.equal(placement?.y, PLOT_TOP)
})

test('sem preço objetivo ou com domínio degenerado não há linha', () => {
  assert.equal(
    resolvePriceChartTarget(
      null,
      TARGET_DOMAIN,
      TARGET_DOMAIN,
      PLOT_TOP,
      PLOT_BOTTOM,
    ),
    null,
  )
  assert.equal(
    resolvePriceChartTarget(
      Number.NaN,
      TARGET_DOMAIN,
      TARGET_DOMAIN,
      PLOT_TOP,
      PLOT_BOTTOM,
    ),
    null,
  )
  assert.equal(
    resolvePriceChartTarget(
      80_205,
      { bottom: 80_205, top: 80_205 },
      { bottom: 80_205, top: 80_205 },
      PLOT_TOP,
      PLOT_BOTTOM,
    ),
    null,
  )
})

test('travado e no topo do domínio caem no mesmo y, e só o clamp os separa', () => {
  const atTop = resolvePriceChartTarget(
    TARGET_DOMAIN.top,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )
  const above = resolvePriceChartTarget(
    TARGET_DOMAIN.top + 1,
    TARGET_DOMAIN,
    TARGET_DOMAIN,
    PLOT_TOP,
    PLOT_BOTTOM,
  )

  assert.equal(atTop?.y, above?.y)
  assert.notEqual(atTop?.clamp, above?.clamp)
})
