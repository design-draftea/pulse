import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  ExecutionQuote,
  OutcomeMarketState,
  OutcomeSide,
} from '../services/outcomeMarket'
import {
  getPresentedQuoteAvailabilityKey,
  getPresentedQuoteIdentity,
  QUOTE_PRESENTATION_CHECK_INTERVAL_MS,
  shouldPublishOutcomePrices,
  shouldPublishPresentedQuote,
  type PresentedOutcomePricesSnapshot,
  type PresentedQuoteSnapshot,
} from '../services/quotePresentation'

const createOutcomePricesSnapshot = (
  roundSlug: string,
  prices: Record<OutcomeSide, number | null>,
  presentedAt = Date.now(),
): PresentedOutcomePricesSnapshot => ({
  roundSlug,
  prices,
  presentedAt,
})

export const usePresentedOutcomePrices = (
  roundSlug: string,
  prices: Record<OutcomeSide, number | null>,
) => {
  const candidate = useMemo(
    () => createOutcomePricesSnapshot(roundSlug, prices),
    [prices, roundSlug],
  )
  const latestCandidateRef = useRef(candidate)
  const [snapshot, setSnapshot] = useState(candidate)
  const availabilityKey = `${prices.up === null ? 0 : 1}:${prices.down === null ? 0 : 1}`

  useLayoutEffect(() => {
    latestCandidateRef.current = candidate
  }, [candidate])

  useLayoutEffect(() => {
    const next = {
      ...latestCandidateRef.current,
      presentedAt: Date.now(),
    }

    setSnapshot((current) => (
      current.roundSlug !== next.roundSlug
      || `${current.prices.up === null ? 0 : 1}:${current.prices.down === null ? 0 : 1}`
        !== availabilityKey
        ? next
        : current
    ))
  }, [availabilityKey, roundSlug])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      const next = {
        ...latestCandidateRef.current,
        presentedAt: now,
      }

      setSnapshot((current) => (
        shouldPublishOutcomePrices(current, next, now) ? next : current
      ))
    }, QUOTE_PRESENTATION_CHECK_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  return snapshot.prices
}

interface PresentedQuoteOverride {
  quote?: ExecutionQuote | null
  quickQuote?: {
    index: number
    quote: ExecutionQuote | null
  }
}

interface UsePresentedQuoteSnapshotOptions {
  market: OutcomeMarketState
  operation: 'buy' | 'sell'
  quickAmounts: number[]
  requestedValue: number
  side: OutcomeSide
}

const createQuoteSnapshot = ({
  market,
  operation,
  quickAmounts,
  requestedValue,
  side,
}: UsePresentedQuoteSnapshotOptions): PresentedQuoteSnapshot => ({
  roundSlug: market.roundSlug,
  side,
  operation,
  requestedValue,
  percentages: market.displayPrices,
  quote: operation === 'buy'
    ? market.quoteBuy(side, requestedValue)
    : market.quoteSell(side, requestedValue),
  quickQuotes: operation === 'buy'
    ? quickAmounts.map((amount) => market.quoteBuy(side, amount))
    : [],
  presentedAt: Date.now(),
})

export const usePresentedQuoteSnapshot = (
  options: UsePresentedQuoteSnapshotOptions,
) => {
  const {
    market,
    operation,
    quickAmounts,
    requestedValue,
    side,
  } = options
  const candidate = useMemo(
    () => createQuoteSnapshot({
      market,
      operation,
      quickAmounts,
      requestedValue,
      side,
    }),
    [
      market,
      operation,
      quickAmounts,
      requestedValue,
      side,
    ],
  )
  const latestCandidateRef = useRef(candidate)
  const [snapshot, setSnapshot] = useState(candidate)
  const identity = getPresentedQuoteIdentity(candidate)
  const availabilityKey = getPresentedQuoteAvailabilityKey(candidate)

  useLayoutEffect(() => {
    latestCandidateRef.current = candidate
  }, [candidate])

  useLayoutEffect(() => {
    const next = {
      ...latestCandidateRef.current,
      presentedAt: Date.now(),
    }

    setSnapshot((current) => (
      getPresentedQuoteIdentity(current) !== identity
      || getPresentedQuoteAvailabilityKey(current) !== availabilityKey
        ? next
        : current
    ))
  }, [availabilityKey, identity])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      const next = {
        ...latestCandidateRef.current,
        presentedAt: now,
      }

      setSnapshot((current) => (
        shouldPublishPresentedQuote(current, next, now) ? next : current
      ))
    }, QUOTE_PRESENTATION_CHECK_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  const publishNow = useCallback((override: PresentedQuoteOverride = {}) => {
    const now = Date.now()
    const latest = latestCandidateRef.current
    const quickQuotes = override.quickQuote
      ? latest.quickQuotes.map((quote, index) => (
          index === override.quickQuote?.index
            ? override.quickQuote.quote
            : quote
        ))
      : latest.quickQuotes
    const next = {
      ...latest,
      ...('quote' in override ? { quote: override.quote ?? null } : {}),
      quickQuotes,
      presentedAt: now,
    }

    latestCandidateRef.current = next
    setSnapshot(next)
    return next
  }, [])

  return { publishNow, snapshot }
}
