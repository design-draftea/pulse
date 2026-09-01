export type MarketPriceDirection = 'up' | 'down'

export type MarketPriceTrendSample = {
  timestamp: number
  value: number
}

export type MarketPriceTrendState = {
  samples: MarketPriceTrendSample[]
  desiredDirection: MarketPriceDirection | null
  candidateDirection: MarketPriceDirection | null
  candidateCount: number
  lastRelevantMovementAt: number | null
}

export const PRICE_TREND_WINDOW_MS = 1_500
export const PRICE_TREND_IDLE_MS = 2_000
export const PRICE_TREND_CONFIRMATION_COUNT = 2
export const PRICE_TREND_MIN_DELTA = 0.01

export const createMarketPriceTrendState = (): MarketPriceTrendState => ({
  samples: [],
  desiredDirection: null,
  candidateDirection: null,
  candidateCount: 0,
  lastRelevantMovementAt: null,
})

export const updateMarketPriceTrend = (
  state: MarketPriceTrendState,
  value: number,
  timestamp: number,
): MarketPriceTrendState => {
  if (!Number.isFinite(value) || !Number.isFinite(timestamp)) return state

  const previousSample = state.samples.at(-1) ?? null
  const samples = [
    ...state.samples.filter(
      (sample) => sample.timestamp >= timestamp - PRICE_TREND_WINDOW_MS,
    ),
    { timestamp, value },
  ]

  if (previousSample === null) return { ...state, samples }

  const baseline = samples.length > 1 ? samples[0] : previousSample
  const delta = value - baseline.value

  if (Math.abs(delta) < PRICE_TREND_MIN_DELTA) {
    return {
      ...state,
      samples,
      candidateDirection: null,
      candidateCount: 0,
    }
  }

  const direction: MarketPriceDirection = delta > 0 ? 'up' : 'down'
  if (state.desiredDirection === direction) {
    return {
      ...state,
      samples,
      candidateDirection: null,
      candidateCount: 0,
      lastRelevantMovementAt: timestamp,
    }
  }

  const candidateCount = state.candidateDirection === direction
    ? state.candidateCount + 1
    : 1

  return {
    ...state,
    samples,
    desiredDirection:
      candidateCount >= PRICE_TREND_CONFIRMATION_COUNT
        ? direction
        : state.desiredDirection,
    candidateDirection:
      candidateCount >= PRICE_TREND_CONFIRMATION_COUNT ? null : direction,
    candidateCount:
      candidateCount >= PRICE_TREND_CONFIRMATION_COUNT ? 0 : candidateCount,
    lastRelevantMovementAt: timestamp,
  }
}

export const getActiveMarketPriceDirection = (
  state: MarketPriceTrendState,
  timestamp: number,
): MarketPriceDirection | null => {
  if (
    state.desiredDirection === null
    || state.lastRelevantMovementAt === null
    || timestamp - state.lastRelevantMovementAt > PRICE_TREND_IDLE_MS
  ) {
    return null
  }

  return state.desiredDirection
}
