export type PricePoint = {
  timestamp: number
  value: number
}

export type PriceChartDomain = {
  bottom: number
  top: number
  step: number
  trendShiftIntervals?: -2 | 0 | 2
}

export type ProjectedPricePoint = PricePoint & {
  x: number
}

export type StablePriceChartDomainState = {
  domain: PriceChartDomain
  contractionCandidateKey: string | null
  contractionStartedAt: number | null
  shiftCandidateKey: string | null
  shiftStartedAt: number | null
}

export type VisiblePriceChartPoints = {
  points: ProjectedPricePoint[]
  continuityApplied: boolean
}

const GRID_INTERVALS = 6
const MINIMUM_GRID_STEP = 2.5
const RECENT_DOMAIN_POINT_COUNT = 20
const TREND_LOOKBACK_POINT_COUNT = 6
const TREND_TRIGGER_INTERVALS = 2
const TREND_SHIFT_INTERVALS = 2
const TREND_MINIMUM_STEP_FRACTION = 0.1
export const DOMAIN_CONTRACTION_DELAY_MS = 5_000
export const DOMAIN_SHIFT_CONFIRMATION_MS = 750

const getNiceStep = (minimumStep: number) => {
  const exponent = 10 ** Math.floor(Math.log10(minimumStep))
  const normalizedStep = minimumStep / exponent
  const multiplier = normalizedStep <= 1
    ? 1
    : normalizedStep <= 2
      ? 2
      : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10

  return multiplier * exponent
}

const getDomainValues = (points: PricePoint[], targetPrice: number | null) => {
  const values = points
    .slice(-RECENT_DOMAIN_POINT_COUNT)
    .map(({ value }) => value)
    .filter((value) => Number.isFinite(value))

  if (values.length === 0 && targetPrice !== null) values.push(targetPrice)
  return values
}

export const appendRoundPricePoint = (
  current: PricePoint[],
  nextPoint: PricePoint,
  roundStart: number,
  maximumPoints: number,
) => {
  if (
    !Number.isFinite(nextPoint.timestamp)
    || !Number.isFinite(nextPoint.value)
    || nextPoint.value <= 0
  ) return current

  const normalizedPoint = {
    ...nextPoint,
    timestamp: Math.max(roundStart, nextPoint.timestamp),
  }
  const normalizedSecond = Math.floor(normalizedPoint.timestamp / 1000)
  const sameSecond = current.find(
    ({ timestamp }) => Math.floor(timestamp / 1000) === normalizedSecond,
  )
  const shouldPreserveRoundSeed = sameSecond?.timestamp === roundStart
  const pointForSecond = shouldPreserveRoundSeed
    ? sameSecond
    : sameSecond && sameSecond.timestamp > normalizedPoint.timestamp
      ? sameSecond
      : normalizedPoint
  const next = [
    ...current.filter(({ timestamp }) => (
      timestamp >= roundStart
      && Math.floor(timestamp / 1000) !== normalizedSecond
    )),
    pointForSecond,
  ].sort((left, right) => left.timestamp - right.timestamp)

  return next.slice(-Math.max(1, maximumPoints))
}

export const countPricePointGaps = (
  points: PricePoint[],
  gapThresholdMs = 2_500,
) => points.reduce((count, point, index) => {
  if (index === 0) return count
  return count + (point.timestamp - points[index - 1].timestamp > gapThresholdMs ? 1 : 0)
}, 0)

export const calculatePriceChartDomain = (
  points: PricePoint[],
  targetPrice: number | null,
): PriceChartDomain => {
  const values = getDomainValues(points, targetPrice)

  if (values.length === 0) {
    return {
      bottom: 0,
      top: 6,
      step: 1,
      trendShiftIntervals: 0,
    }
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const step = getNiceStep(Math.max(
    MINIMUM_GRID_STEP,
    (maximum - minimum) / GRID_INTERVALS,
  ))
  const domainSpan = step * GRID_INTERVALS
  let bottom = Math.floor(((minimum + maximum - domainSpan) / 2) / step) * step
  let top = bottom + domainSpan

  if (minimum < bottom) {
    bottom = Math.floor(minimum / step) * step
    top = bottom + domainSpan
  }
  if (maximum > top) {
    top = Math.ceil(maximum / step) * step
    bottom = top - domainSpan
  }

  const latestValue = values.at(-1) ?? maximum
  const trendValues = values.slice(-TREND_LOOKBACK_POINT_COUNT)
  const trendDelta = trendValues.length > 1
    ? latestValue - trendValues[0]
    : 0
  const trendThreshold = step * TREND_MINIMUM_STEP_FRACTION
  const domainShift = step * TREND_SHIFT_INTERVALS
  let trendShiftIntervals: -2 | 0 | 2 = 0

  if (
    trendDelta >= trendThreshold
    && latestValue >= top - step * TREND_TRIGGER_INTERVALS
  ) {
    bottom += domainShift
    top += domainShift
    trendShiftIntervals = 2
  } else if (
    trendDelta <= -trendThreshold
    && latestValue <= bottom + step * TREND_TRIGGER_INTERVALS
  ) {
    bottom -= domainShift
    top -= domainShift
    trendShiftIntervals = -2
  }

  return { bottom, top, step, trendShiftIntervals }
}

const getDomainKey = ({ bottom, top, step }: PriceChartDomain) => (
  `${bottom}:${top}:${step}`
)

export const stabilizePriceChartDomain = (
  previous: StablePriceChartDomainState | null,
  candidate: PriceChartDomain,
  points: PricePoint[],
  now: number,
): StablePriceChartDomainState => {
  if (previous === null) {
    return {
      domain: candidate,
      contractionCandidateKey: null,
      contractionStartedAt: null,
      shiftCandidateKey: null,
      shiftStartedAt: null,
    }
  }

  const current = previous.domain
  const values = points.slice(-RECENT_DOMAIN_POINT_COUNT).map(({ value }) => value)
  const minimum = values.length > 0 ? Math.min(...values) : candidate.bottom
  const maximum = values.length > 0 ? Math.max(...values) : candidate.top
  const latest = values.at(-1) ?? (candidate.bottom + candidate.top) / 2
  const exceedsCurrentDomain = minimum < current.bottom || maximum > current.top

  if (candidate.step > current.step || exceedsCurrentDomain) {
    return {
      domain: candidate,
      contractionCandidateKey: null,
      contractionStartedAt: null,
      shiftCandidateKey: null,
      shiftStartedAt: null,
    }
  }

  if (candidate.step < current.step) {
    const candidateKey = getDomainKey(candidate)
    const contractionStartedAt = previous.contractionCandidateKey === candidateKey
      ? previous.contractionStartedAt ?? now
      : now

    if (now - contractionStartedAt >= DOMAIN_CONTRACTION_DELAY_MS) {
      return {
        domain: candidate,
        contractionCandidateKey: null,
        contractionStartedAt: null,
        shiftCandidateKey: null,
        shiftStartedAt: null,
      }
    }

    return {
      domain: current,
      contractionCandidateKey: candidateKey,
      contractionStartedAt,
      shiftCandidateKey: null,
      shiftStartedAt: null,
    }
  }

  const movesUp = candidate.bottom > current.bottom
    && latest >= current.top - current.step * TREND_TRIGGER_INTERVALS
  const movesDown = candidate.bottom < current.bottom
    && latest <= current.bottom + current.step * TREND_TRIGGER_INTERVALS

  if (movesUp || movesDown) {
    const candidateKey = getDomainKey(candidate)
    const shiftStartedAt = previous.shiftCandidateKey === candidateKey
      ? previous.shiftStartedAt ?? now
      : now

    if (now - shiftStartedAt < DOMAIN_SHIFT_CONFIRMATION_MS) {
      return {
        domain: current,
        contractionCandidateKey: null,
        contractionStartedAt: null,
        shiftCandidateKey: candidateKey,
        shiftStartedAt,
      }
    }

    return {
      domain: candidate,
      contractionCandidateKey: null,
      contractionStartedAt: null,
      shiftCandidateKey: null,
      shiftStartedAt: null,
    }
  }

  return {
    domain: current,
    contractionCandidateKey: null,
    contractionStartedAt: null,
    shiftCandidateKey: null,
    shiftStartedAt: null,
  }
}

export const interpolatePriceChartDomain = (
  from: PriceChartDomain,
  to: PriceChartDomain,
  progress: number,
): PriceChartDomain => {
  const boundedProgress = Math.min(1, Math.max(0, progress))
  if (boundedProgress === 0) return from
  if (boundedProgress === 1) return to
  const interpolate = (start: number, end: number) => (
    start + (end - start) * boundedProgress
  )

  return {
    bottom: interpolate(from.bottom, to.bottom),
    top: interpolate(from.top, to.top),
    step: interpolate(from.step, to.step),
    trendShiftIntervals: from.trendShiftIntervals,
  }
}

export const getContinuousVisiblePricePoints = (
  points: PricePoint[],
  displayTime: number,
  seriesRight: number,
  leftBoundary: number,
  pixelsPerSecond: number,
): VisiblePriceChartPoints => {
  const projected = points
    .map((point) => ({
      ...point,
      x: seriesRight - ((displayTime - point.timestamp) / 1000) * pixelsPerSecond,
    }))
    .filter(({ x }) => x <= seriesRight + 1)
  const firstInsideIndex = projected.findIndex(({ x }) => x >= leftBoundary)

  if (firstInsideIndex <= 0) {
    return {
      points: firstInsideIndex === 0 ? projected : [],
      continuityApplied: false,
    }
  }

  const guard = projected[firstInsideIndex - 1]
  const firstInside = projected[firstInsideIndex]
  const distance = firstInside.x - guard.x
  const progress = distance <= 0
    ? 1
    : (leftBoundary - guard.x) / distance
  const boundaryPoint: ProjectedPricePoint = {
    timestamp: guard.timestamp
      + (firstInside.timestamp - guard.timestamp) * progress,
    value: guard.value + (firstInside.value - guard.value) * progress,
    x: leftBoundary,
  }

  return {
    points: [boundaryPoint, ...projected.slice(firstInsideIndex)],
    continuityApplied: true,
  }
}
