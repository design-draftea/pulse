import type {
  ExecutionQuote,
  OutcomeSide,
} from './outcomeMarket'

export const QUOTE_PRESENTATION_INTERVAL_MS = 1_000
export const QUOTE_PRESENTATION_CHECK_INTERVAL_MS = 250
export const QUOTE_PROTECTION_TOLERANCE = 0.01

const QUOTE_EPSILON = 1e-9

export interface PresentedOutcomePricesSnapshot {
  roundSlug: string
  prices: Record<OutcomeSide, number | null>
  presentedAt: number
}

export interface PresentedQuoteSnapshot {
  roundSlug: string
  side: OutcomeSide
  operation: 'buy' | 'sell'
  requestedValue: number
  percentages: Record<OutcomeSide, number | null>
  quote: ExecutionQuote | null
  quickQuotes: Array<ExecutionQuote | null>
  presentedAt: number
}

export type QuoteProtectionResult =
  | {
      status: 'accepted' | 'requote'
      quote: ExecutionQuote
      adverseMove: number
    }
  | {
      status: 'unavailable'
      quote: null
      adverseMove: null
    }

const roundedCents = (value: number | null) => (
  value === null || !Number.isFinite(value)
    ? null
    : Math.round(value * 100)
)

const quoteAverageChanged = (
  current: ExecutionQuote | null,
  next: ExecutionQuote | null,
) => (
  current?.complete === true
  && next?.complete === true
  && Math.abs(current.averagePrice - next.averagePrice)
    >= QUOTE_PROTECTION_TOLERANCE - QUOTE_EPSILON
)

const quoteAvailability = (quote: ExecutionQuote | null) => (
  quote?.complete === true
)

const isProtectableQuote = (
  quote: ExecutionQuote | null,
): quote is ExecutionQuote => (
  quote?.complete === true
  && Number.isFinite(quote.averagePrice)
  && quote.averagePrice > 0
  && quote.averagePrice < 1
  && Number.isFinite(quote.requestedValue)
  && quote.requestedValue > 0
  && Number.isFinite(quote.participations)
  && quote.participations > 0
  && Number.isFinite(quote.grossValue)
  && quote.grossValue > 0
  && Number.isFinite(quote.quotedAt)
)

const pricesAvailabilityKey = (
  prices: Record<OutcomeSide, number | null>,
) => `${prices.up === null ? 0 : 1}:${prices.down === null ? 0 : 1}`

export const getPresentedQuoteIdentity = (
  snapshot: PresentedQuoteSnapshot,
) => [
  snapshot.roundSlug,
  snapshot.side,
  snapshot.operation,
  snapshot.requestedValue,
  snapshot.quickQuotes.map((quote) => quote?.requestedValue ?? '').join(','),
].join('|')

export const getPresentedQuoteAvailabilityKey = (
  snapshot: PresentedQuoteSnapshot,
) => [
  pricesAvailabilityKey(snapshot.percentages),
  quoteAvailability(snapshot.quote) ? 1 : 0,
  snapshot.quickQuotes.map((quote) => quoteAvailability(quote) ? 1 : 0).join(','),
].join('|')

export const shouldPublishOutcomePrices = (
  current: PresentedOutcomePricesSnapshot,
  next: PresentedOutcomePricesSnapshot,
  now = next.presentedAt,
) => {
  if (current.roundSlug !== next.roundSlug) return true
  if (pricesAvailabilityKey(current.prices) !== pricesAvailabilityKey(next.prices)) {
    return true
  }
  if (now - current.presentedAt < QUOTE_PRESENTATION_INTERVAL_MS) return false

  return (['up', 'down'] as const).some((side) => (
    roundedCents(current.prices[side]) !== roundedCents(next.prices[side])
  ))
}

export const shouldPublishPresentedQuote = (
  current: PresentedQuoteSnapshot,
  next: PresentedQuoteSnapshot,
  now = next.presentedAt,
) => {
  if (getPresentedQuoteIdentity(current) !== getPresentedQuoteIdentity(next)) {
    return true
  }
  if (
    getPresentedQuoteAvailabilityKey(current)
    !== getPresentedQuoteAvailabilityKey(next)
  ) {
    return true
  }
  if (now - current.presentedAt < QUOTE_PRESENTATION_INTERVAL_MS) return false

  const percentageChanged = (['up', 'down'] as const).some((side) => (
    roundedCents(current.percentages[side])
    !== roundedCents(next.percentages[side])
  ))
  const quoteChanged = quoteAverageChanged(current.quote, next.quote)
  const quickQuoteChanged = current.quickQuotes.length !== next.quickQuotes.length
    || current.quickQuotes.some((quote, index) => (
      quoteAverageChanged(quote, next.quickQuotes[index] ?? null)
    ))

  return percentageChanged || quoteChanged || quickQuoteChanged
}

export const getProtectedAveragePrice = (
  quote: ExecutionQuote | null,
  tolerance = QUOTE_PROTECTION_TOLERANCE,
) => {
  if (!quote?.complete || !Number.isFinite(tolerance) || tolerance < 0) {
    return null
  }

  return quote.operation === 'buy'
    ? Math.min(0.99, quote.averagePrice + tolerance)
    : Math.max(0.01, quote.averagePrice - tolerance)
}

export const validateQuoteProtection = ({
  currentQuote,
  currentRoundSlug,
  presentedQuote,
  presentedRoundSlug,
  tolerance = QUOTE_PROTECTION_TOLERANCE,
}: {
  currentQuote: ExecutionQuote | null
  currentRoundSlug: string
  presentedQuote: ExecutionQuote | null
  presentedRoundSlug: string
  tolerance?: number
}): QuoteProtectionResult => {
  if (
    currentRoundSlug !== presentedRoundSlug
    || !currentRoundSlug
    || !presentedRoundSlug
    || !isProtectableQuote(presentedQuote)
    || !isProtectableQuote(currentQuote)
    || currentQuote.side !== presentedQuote.side
    || currentQuote.operation !== presentedQuote.operation
    || Math.abs(currentQuote.requestedValue - presentedQuote.requestedValue)
      > QUOTE_EPSILON
    || !Number.isFinite(tolerance)
    || tolerance < 0
  ) {
    return { status: 'unavailable', quote: null, adverseMove: null }
  }

  const adverseMove = currentQuote.operation === 'buy'
    ? currentQuote.averagePrice - presentedQuote.averagePrice
    : presentedQuote.averagePrice - currentQuote.averagePrice

  return adverseMove <= tolerance + QUOTE_EPSILON
    ? { status: 'accepted', quote: currentQuote, adverseMove }
    : { status: 'requote', quote: currentQuote, adverseMove }
}
