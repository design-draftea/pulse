import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendRoundPricePoint,
  countPricePointGaps,
  DOMAIN_CONTRACTION_DELAY_MS,
  DOMAIN_SHIFT_CONFIRMATION_MS,
  getContinuousVisiblePricePoints,
  interpolatePriceChartDomain,
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
