import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BTC_DISPLAY_TIME_ZONE } from '../../services/marketData'
import {
  PriceChart,
  type PriceChartDomain,
  type PriceChartEntry,
  type PriceDirection,
  type PricePoint,
  type PriceChartRange,
} from '../PriceChart'
import {
  calculatePriceChartDomain,
  getPriceChartRangeConfig,
  getPriceChartWindowPoints,
  interpolatePriceChartDomain,
  stabilizePriceChartDomain,
  type StablePriceChartDomainState,
} from '../priceChartModel'

interface MarketPriceChartProps {
  now: number
  points: PricePoint[]
  historyPoints: PricePoint[]
  targetPrice: number | null
  currentPrice: number | null
  priceDirection: PriceDirection | null
  directionAnimationSequence: number
  entries: PriceChartEntry[]
  roundStart: number
  currentSource: string | null
  currentStatus: string
  currentUpdatedAt: number | null
}

const DOMAIN_ANIMATION_DURATION_MS = 280
const DEFAULT_WINDOW_SPAN_MS = 9_833

const domainsAreEqual = (
  first: PriceChartDomain,
  second: PriceChartDomain,
) => first.bottom === second.bottom
  && first.top === second.top
  && first.step === second.step

const useAnimatedPriceChartDomain = (
  targetDomain: PriceChartDomain,
) => {
  const currentDomainRef = useRef(targetDomain)
  const [renderDomain, setRenderDomain] = useState(targetDomain)

  useEffect(() => {
    const fromDomain = currentDomainRef.current
    if (domainsAreEqual(fromDomain, targetDomain)) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedMotionFrame = window.requestAnimationFrame(() => {
        currentDomainRef.current = targetDomain
        setRenderDomain(targetDomain)
      })
      return () => window.cancelAnimationFrame(reducedMotionFrame)
    }

    let frameId = 0
    const startedAt = window.performance.now()
    const animate = (frameTime: number) => {
      const progress = Math.min(
        1,
        (frameTime - startedAt) / DOMAIN_ANIMATION_DURATION_MS,
      )
      const easedProgress = 1 - (1 - progress) ** 3
      const nextDomain = interpolatePriceChartDomain(
        fromDomain,
        targetDomain,
        easedProgress,
      )

      currentDomainRef.current = nextDomain
      setRenderDomain(nextDomain)
      if (progress < 1) frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [targetDomain])

  return renderDomain
}

export function MarketPriceChart({
  now,
  points,
  historyPoints,
  targetPrice,
  currentPrice,
  priceDirection,
  directionAnimationSequence,
  entries,
  roundStart,
  currentSource,
  currentStatus,
  currentUpdatedAt,
}: MarketPriceChartProps) {
  const [range, setRange] = useState<PriceChartRange>('live')
  const [panState, setPanState] = useState<{
    roundStart: number
    anchor: number | null
  }>(() => ({ roundStart, anchor: null }))
  const [windowSpanMs, setWindowSpanMs] = useState(DEFAULT_WINDOW_SPAN_MS)
  const viewAnchorTimestamp = panState.roundStart === roundStart
    ? panState.anchor
    : null
  const setViewAnchorTimestamp = useCallback(
    (anchor: number | null) => setPanState({ roundStart, anchor }),
    [roundStart],
  )
  const displayedPoints = range === 'live' ? points : historyPoints

  const candidateDomain = useMemo(
    () => calculatePriceChartDomain(points, targetPrice),
    [points, targetPrice],
  )
  const pannedDomain = useMemo(() => {
    if (range !== 'live' || viewAnchorTimestamp === null) return null

    const windowPoints = getPriceChartWindowPoints(
      points,
      viewAnchorTimestamp - windowSpanMs,
      viewAnchorTimestamp,
    )

    return windowPoints.length === 0
      ? null
      : calculatePriceChartDomain(windowPoints, null, { applyTrendShift: false })
  }, [points, range, viewAnchorTimestamp, windowSpanMs])
  const fixedRangeDomain = useMemo(() => {
    const durationMs = getPriceChartRangeConfig(range, 1).durationMs
    if (durationMs === null) return null

    const rangeEnd = Math.max(
      now,
      historyPoints.at(-1)?.timestamp ?? 0,
    )
    const windowPoints = getPriceChartWindowPoints(
      historyPoints,
      rangeEnd - durationMs,
      rangeEnd,
    )

    return calculatePriceChartDomain(windowPoints, targetPrice, {
      applyTrendShift: false,
      includeAllPoints: true,
    })
  }, [historyPoints, now, range, targetPrice])
  const [stableDomainState, setStableDomainState] = useState<{
    roundStart: number
    inputKey: string
    state: StablePriceChartDomainState
  }>(() => ({
    roundStart,
    inputKey: '',
    state: stabilizePriceChartDomain(
      null,
      candidateDomain,
      points,
      points.at(-1)?.timestamp ?? Date.now(),
    ),
  }))
  const [initialRoundStart] = useState(roundStart)
  const domainTimestamp = points.at(-1)?.timestamp ?? roundStart
  const domainInputKey = [
    roundStart,
    candidateDomain.bottom,
    candidateDomain.top,
    candidateDomain.step,
    domainTimestamp,
  ].join(':')
  let resolvedDomainState = stableDomainState

  if (stableDomainState.inputKey !== domainInputKey) {
    resolvedDomainState = {
      roundStart,
      inputKey: domainInputKey,
      state: stabilizePriceChartDomain(
        stableDomainState.roundStart === roundStart
          ? stableDomainState.state
          : null,
        candidateDomain,
        points,
        domainTimestamp,
      ),
    }
    setStableDomainState(resolvedDomainState)
  }

  const liveDomain = resolvedDomainState.roundStart === roundStart
    ? resolvedDomainState.state.domain
    : candidateDomain
  const domain = fixedRangeDomain ?? pannedDomain ?? liveDomain
  const renderDomain = useAnimatedPriceChartDomain(domain)

  return (
    <PriceChart
      points={displayedPoints}
      domain={domain}
      renderDomain={renderDomain}
      currentPrice={currentPrice}
      targetPrice={targetPrice}
      priceDirection={priceDirection}
      directionAnimationSequence={directionAnimationSequence}
      entries={entries}
      locale="es-MX"
      timeZone={BTC_DISPLAY_TIME_ZONE}
      seriesKey={roundStart}
      viewAnchorTimestamp={viewAnchorTimestamp}
      onViewAnchorChange={setViewAnchorTimestamp}
      onWindowSpanChange={setWindowSpanMs}
      resetReason={roundStart === initialRoundStart
        ? 'initial-load'
        : 'round-change'}
      source={currentSource}
      status={currentStatus}
      updatedAt={currentUpdatedAt}
      range={range}
      onRangeChange={setRange}
    />
  )
}
