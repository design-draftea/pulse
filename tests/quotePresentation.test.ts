import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getProtectedAveragePrice,
  shouldPublishOutcomePrices,
  shouldPublishPresentedQuote,
  validateQuoteProtection,
  type PresentedQuoteSnapshot,
} from '../src/services/quotePresentation.ts'
import type { ExecutionQuote } from '../src/services/outcomeMarket.ts'

const quote = (
  operation: 'buy' | 'sell',
  averagePrice: number,
  requestedValue = 10,
  complete = true,
): ExecutionQuote => ({
  side: 'up',
  operation,
  requestedValue,
  participations: operation === 'buy'
    ? requestedValue / averagePrice
    : requestedValue,
  grossValue: operation === 'buy'
    ? requestedValue
    : requestedValue * averagePrice,
  averagePrice,
  complete,
  quotedAt: 100,
})

const presentedSnapshot = (
  overrides: Partial<PresentedQuoteSnapshot> = {},
): PresentedQuoteSnapshot => ({
  roundSlug: 'btc-updown-15m-1',
  side: 'up',
  operation: 'buy',
  requestedValue: 10,
  percentages: { up: 0.5, down: 0.5 },
  quote: quote('buy', 0.5),
  quickQuotes: [
    quote('buy', 0.5, 10),
    quote('buy', 0.51, 25),
    quote('buy', 0.52, 50),
  ],
  presentedAt: 1_000,
  ...overrides,
})

const protect = (
  presentedQuote: ExecutionQuote | null,
  currentQuote: ExecutionQuote | null,
  currentRoundSlug = 'btc-updown-15m-1',
  presentedRoundSlug = 'btc-updown-15m-1',
) => validateQuoteProtection({
  currentQuote,
  currentRoundSlug,
  presentedQuote,
  presentedRoundSlug,
})

test('compra aceita melhora, igualdade e piora de até 1 centavo', () => {
  const shown = quote('buy', 0.5)

  assert.equal(protect(shown, quote('buy', 0.48)).status, 'accepted')
  assert.equal(protect(shown, quote('buy', 0.5)).status, 'accepted')
  assert.equal(protect(shown, quote('buy', 0.51)).status, 'accepted')
  assert.equal(protect(shown, quote('buy', 0.511)).status, 'requote')
})

test('venda aceita melhora, igualdade e piora de até 1 centavo', () => {
  const shown = quote('sell', 0.5)

  assert.equal(protect(shown, quote('sell', 0.52)).status, 'accepted')
  assert.equal(protect(shown, quote('sell', 0.5)).status, 'accepted')
  assert.equal(protect(shown, quote('sell', 0.49)).status, 'accepted')
  assert.equal(protect(shown, quote('sell', 0.489)).status, 'requote')
})

test('rejeita cotação incompleta, rodada ou pedido divergente e tolerância inválida', () => {
  const shown = quote('buy', 0.5)
  const invalidAverage = { ...quote('buy', 0.5), averagePrice: Number.NaN }
  const invalidRequest = { ...quote('buy', 0.5), requestedValue: 0 }

  assert.equal(protect(shown, quote('buy', 0.5, 10, false)).status, 'unavailable')
  assert.equal(protect(shown, quote('buy', 0.5), 'round-2').status, 'unavailable')
  assert.equal(protect(shown, quote('buy', 0.5, 25)).status, 'unavailable')
  assert.equal(protect(shown, quote('sell', 0.5)).status, 'unavailable')
  assert.equal(protect(shown, invalidAverage).status, 'unavailable')
  assert.equal(protect(shown, invalidRequest).status, 'unavailable')
  assert.equal(validateQuoteProtection({
    currentQuote: quote('buy', 0.5),
    currentRoundSlug: 'btc-updown-15m-1',
    presentedQuote: shown,
    presentedRoundSlug: 'btc-updown-15m-1',
    tolerance: Number.NaN,
  }).status, 'unavailable')
})

test('calcula o limite protegido na direção correta', () => {
  assert.ok(Math.abs(
    (getProtectedAveragePrice(quote('buy', 0.34)) ?? 0) - 0.35,
  ) < 1e-9)
  assert.ok(Math.abs(
    (getProtectedAveragePrice(quote('sell', 0.32)) ?? 0) - 0.31,
  ) < 1e-9)
  assert.equal(getProtectedAveragePrice(quote('buy', 0.5, 10, false)), null)
})

test('preços UP e DOWN respeitam 1 segundo e mudam pelo percentual inteiro', () => {
  const current = {
    roundSlug: 'round-1',
    prices: { up: 0.501, down: 0.499 },
    presentedAt: 1_000,
  }

  assert.equal(shouldPublishOutcomePrices(current, {
    ...current,
    prices: { up: 0.52, down: 0.48 },
    presentedAt: 1_500,
  }, 1_500), false)
  assert.equal(shouldPublishOutcomePrices(current, {
    ...current,
    prices: { up: 0.502, down: 0.498 },
    presentedAt: 2_000,
  }, 2_000), false)
  assert.equal(shouldPublishOutcomePrices(current, {
    ...current,
    prices: { up: 0.511, down: 0.489 },
    presentedAt: 2_000,
  }, 2_000), true)
})

test('mudança de rodada e disponibilidade publica imediatamente', () => {
  const current = {
    roundSlug: 'round-1',
    prices: { up: 0.5, down: 0.5 },
    presentedAt: 1_000,
  }

  assert.equal(shouldPublishOutcomePrices(current, {
    ...current,
    roundSlug: 'round-2',
    presentedAt: 1_100,
  }, 1_100), true)
  assert.equal(shouldPublishOutcomePrices(current, {
    ...current,
    prices: { up: null, down: null },
    presentedAt: 1_100,
  }, 1_100), true)
})

test('snapshot do betslip publica mudanças do usuário imediatamente', () => {
  const current = presentedSnapshot()
  const next = presentedSnapshot({
    requestedValue: 25,
    quote: quote('buy', 0.5, 25),
    presentedAt: 1_100,
  })

  assert.equal(shouldPublishPresentedQuote(current, next, 1_100), true)
})

test('snapshot do mercado publica o grupo somente após 1 segundo', () => {
  const current = presentedSnapshot()
  const changed = presentedSnapshot({
    percentages: { up: 0.52, down: 0.48 },
    quote: quote('buy', 0.52),
    presentedAt: 1_500,
  })

  assert.equal(shouldPublishPresentedQuote(current, changed, 1_500), false)
  assert.equal(shouldPublishPresentedQuote(current, {
    ...changed,
    presentedAt: 2_000,
  }, 2_000), true)
})

test('variação inferior a 1 centavo não move a cotação apresentada', () => {
  const current = presentedSnapshot({
    percentages: { up: 0.5, down: 0.5 },
    quote: quote('buy', 0.5),
  })

  assert.equal(shouldPublishPresentedQuote(current, presentedSnapshot({
    percentages: { up: 0.5, down: 0.5 },
    quote: quote('buy', 0.509),
    presentedAt: 2_000,
  }), 2_000), false)
  assert.equal(shouldPublishPresentedQuote(current, presentedSnapshot({
    percentages: { up: 0.5, down: 0.5 },
    quote: quote('buy', 0.51),
    presentedAt: 2_000,
  }), 2_000), true)
})

test('cada opção de Un toque mantém sua própria cotação e proteção', () => {
  const current = presentedSnapshot()
  const nextQuickQuotes = [...current.quickQuotes]
  nextQuickQuotes[1] = quote('buy', 0.52, 25)

  assert.equal(shouldPublishPresentedQuote(current, presentedSnapshot({
    quickQuotes: nextQuickQuotes,
    presentedAt: 2_000,
  }), 2_000), true)
  assert.equal(
    protect(current.quickQuotes[1], quote('buy', 0.52, 25)).status,
    'accepted',
  )
  assert.equal(
    protect(current.quickQuotes[1], quote('buy', 0.531, 25)).status,
    'requote',
  )
})

test('disponibilidade do betslip muda sem esperar o intervalo', () => {
  const current = presentedSnapshot()
  const unavailable = presentedSnapshot({
    quote: null,
    presentedAt: 1_100,
  })

  assert.equal(shouldPublishPresentedQuote(current, unavailable, 1_100), true)
})
