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

export type PriceChartTargetClamp = 'none' | 'above' | 'below'

export type PriceChartTargetPlacement = {
  y: number
  clamp: PriceChartTargetClamp
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

export const projectPriceToY = (
  value: number,
  { bottom, top }: Pick<PriceChartDomain, 'bottom' | 'top'>,
  plotTop: number,
  plotBottom: number,
) => plotTop + ((top - value) / (top - bottom)) * (plotBottom - plotTop)

// O veredito de travamento vem do domínio já estabilizado e a posição vem do
// domínio interpolado. Decidir os dois pelo interpolado faria a seta e a
// largura da pílula piscarem durante os 280ms de animação sempre que o
// objetivo estivesse parado exatamente na borda da faixa.
//
// Travado, o objetivo pousa na própria borda da faixa, sem respiro. Um objetivo
// exatamente no topo do domínio e um objetivo travado acima caem no mesmo `y`,
// então quem distingue os dois é a opacidade da linha e a presença da seta.
export const resolvePriceChartTarget = (
  targetPrice: number | null,
  domain: Pick<PriceChartDomain, 'bottom' | 'top'>,
  renderDomain: Pick<PriceChartDomain, 'bottom' | 'top'>,
  plotTop: number,
  plotBottom: number,
): PriceChartTargetPlacement | null => {
  if (targetPrice === null || !Number.isFinite(targetPrice)) return null
  if (!Number.isFinite(domain.top - domain.bottom)) return null
  if (domain.top <= domain.bottom) return null

  if (targetPrice > domain.top) return { y: plotTop, clamp: 'above' }
  if (targetPrice < domain.bottom) return { y: plotBottom, clamp: 'below' }

  const y = projectPriceToY(targetPrice, renderDomain, plotTop, plotBottom)

  return {
    y: Math.min(plotBottom, Math.max(plotTop, y)),
    clamp: 'none',
  }
}

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
  { applyTrendShift = true }: { applyTrendShift?: boolean } = {},
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

  if (!applyTrendShift) return { bottom, top, step, trendShiftIntervals }

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

export const interpolatePriceAt = (
  points: PricePoint[],
  timestamp: number,
): number | null => {
  if (points.length === 0) return null

  const first = points[0]
  const last = points[points.length - 1]
  if (timestamp <= first.timestamp) return first.value
  if (timestamp >= last.timestamp) return last.value

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const next = points[index]
    if (next.timestamp < timestamp) continue

    const span = next.timestamp - previous.timestamp
    const progress = span <= 0 ? 1 : (timestamp - previous.timestamp) / span

    return previous.value + (next.value - previous.value) * progress
  }

  return last.value
}

export const getPriceChartWindowPoints = (
  points: PricePoint[],
  fromTimestamp: number,
  toTimestamp: number,
): PricePoint[] => {
  if (points.length === 0) return []

  const inside = points.filter(({ timestamp }) => (
    timestamp >= fromTimestamp && timestamp <= toTimestamp
  ))
  const startValue = interpolatePriceAt(points, fromTimestamp)
  const endValue = interpolatePriceAt(points, toTimestamp)
  const window: PricePoint[] = []

  if (startValue !== null && inside[0]?.timestamp !== fromTimestamp) {
    window.push({ timestamp: fromTimestamp, value: startValue })
  }
  window.push(...inside)
  if (
    endValue !== null
    && inside[inside.length - 1]?.timestamp !== toTimestamp
  ) {
    window.push({ timestamp: toTimestamp, value: endValue })
  }

  return window
}

export const clampPriceChartAnchor = (
  anchorTimestamp: number,
  points: PricePoint[],
  windowSpanMs: number,
  latestTimestamp: number,
) => {
  const oldest = points[0]?.timestamp ?? latestTimestamp
  const earliestAnchor = Math.min(latestTimestamp, oldest + windowSpanMs)

  return Math.min(latestTimestamp, Math.max(earliestAnchor, anchorTimestamp))
}

export const getContinuousVisiblePricePoints = (
  points: PricePoint[],
  displayTime: number,
  seriesRight: number,
  leftBoundary: number,
  pixelsPerSecond: number,
): VisiblePriceChartPoints => {
  const project = (point: PricePoint): ProjectedPricePoint => ({
    ...point,
    x: seriesRight - ((displayTime - point.timestamp) / 1000) * pixelsPerSecond,
  })
  const latestTimestamp = displayTime + 1000 / pixelsPerSecond
  const earliestTimestamp =
    displayTime - ((seriesRight - leftBoundary) / pixelsPerSecond) * 1000

  let lastIndex = -1
  for (let index = 0; index < points.length; index += 1) {
    if (points[index].timestamp > latestTimestamp) break
    lastIndex = index
  }

  if (lastIndex < 0) return { points: [], continuityApplied: false }

  let firstInsideIndex = -1
  for (let index = 0; index <= lastIndex; index += 1) {
    if (points[index].timestamp >= earliestTimestamp) {
      firstInsideIndex = index
      break
    }
  }

  const guard = firstInsideIndex === 0 ? null : points[lastIndex]
  const inside = firstInsideIndex < 0
    ? []
    : points.slice(firstInsideIndex, lastIndex + 1).map(project)
  const visible: ProjectedPricePoint[] = [...inside]

  if (firstInsideIndex !== 0 && guard !== null) {
    const previous = project(
      firstInsideIndex < 0 ? guard : points[firstInsideIndex - 1],
    )
    const next = inside[0] ?? null

    if (next !== null) {
      const distance = next.x - previous.x
      const progress = distance <= 0 ? 1 : (leftBoundary - previous.x) / distance

      visible.unshift({
        timestamp: previous.timestamp
          + (next.timestamp - previous.timestamp) * progress,
        value: previous.value + (next.value - previous.value) * progress,
        x: leftBoundary,
      })
    }
  }

  // Guarda da borda direita: enquanto o gráfico está arrastado, o trecho entre
  // o último ponto visível e o próximo ponto real precisa continuar desenhado.
  const nextOutsideIndex = lastIndex + 1
  if (nextOutsideIndex < points.length) {
    const previous = project(points[lastIndex])
    const next = project(points[nextOutsideIndex])
    const distance = next.x - previous.x
    const progress = distance <= 0 ? 1 : (seriesRight - previous.x) / distance
    const rightEdge: ProjectedPricePoint = {
      timestamp: previous.timestamp
        + (next.timestamp - previous.timestamp) * progress,
      value: previous.value + (next.value - previous.value) * progress,
      x: seriesRight,
    }

    if (visible.length === 0) {
      const leftValue = interpolatePriceAt(points, earliestTimestamp)

      if (leftValue !== null) {
        visible.push({
          timestamp: earliestTimestamp,
          value: leftValue,
          x: leftBoundary,
        })
      }
    }

    visible.push(rightEdge)
  }

  return {
    points: visible,
    continuityApplied: firstInsideIndex !== 0 && visible.length > 0,
  }
}
