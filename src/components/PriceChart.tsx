import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import {
  layoutPriceChartEntries,
  type PriceChartEntry,
} from './priceChartLayout'
import {
  BASE_PRICE_CHART_WIDTH,
  getPriceChartGeometry,
  getTimeTickOpacity,
  PRICE_CHART_HEIGHT,
} from './priceChartGeometry'
import {
  countPricePointGaps,
  getContinuousVisiblePricePoints,
  interpolatePriceAt,
  type PriceChartDomain,
  type PricePoint,
} from './priceChartModel'
import { usePriceChartPan } from '../hooks/usePriceChartPan'
import { LiveIndicator } from './LiveIndicator/LiveIndicator'
import './PriceChart.css'

export type { PriceChartEntry } from './priceChartLayout'
export type { PriceChartDomain, PricePoint } from './priceChartModel'

export type PriceDirection = 'up' | 'down'

type PriceChartProps = {
  points: PricePoint[]
  domain: PriceChartDomain
  renderDomain?: PriceChartDomain
  currentPrice: number | null
  priceDirection: PriceDirection | null
  directionAnimationSequence: number
  entries?: PriceChartEntry[]
  currency?: string
  locale?: string
  timeZone?: string
  className?: string
  seriesKey: number
  viewAnchorTimestamp: number | null
  onViewAnchorChange: (next: number | null) => void
  onWindowSpanChange?: (spanMs: number) => void
  resetReason: 'initial-load' | 'round-change'
  source: string | null
  status: string
  updatedAt: number | null
}

type ChartPoint = PricePoint & {
  x: number
  y: number
}

const PLOT_LEFT = 16
const PLOT_TOP = 16
const PLOT_BOTTOM = 220
const CURRENT_LABEL_WIDTH = 85
const GRID_LINE_COUNT = 7
const PIXELS_PER_SECOND = 24
const TIME_TICK_INTERVAL = 5000
const TIME_TICK_SPACING = (TIME_TICK_INTERVAL / 1000) * PIXELS_PER_SECOND
const TIME_TICK_FADE_DISTANCE = 48
const PLOT_FADE_WIDTH = 96
const DIRECTION_CLEAR_SIZE = 30
const DIRECTION_ANIMATION_FALLBACK_MS = 800
const RENDER_FRAME_INTERVAL = 1000 / 30

const getSmoothPath = (points: ChartPoint[]) => {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const handle = Math.max(0, next.x - current.x) * 0.45
    const controlOneX = current.x + handle
    const controlTwoX = next.x - handle

    path += ` C ${controlOneX.toFixed(2)} ${current.y.toFixed(2)}, ${controlTwoX.toFixed(2)} ${next.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`
  }

  return path
}

const useRenderTime = () => {
  const [renderTime, setRenderTime] = useState(() => Date.now())

  useEffect(() => {
    let frameId = 0
    let previousFrame = 0

    const renderFrame = (frameTime: number) => {
      if (frameTime - previousFrame >= RENDER_FRAME_INTERVAL) {
        previousFrame = frameTime
        setRenderTime(Date.now())
      }

      frameId = window.requestAnimationFrame(renderFrame)
    }

    frameId = window.requestAnimationFrame(renderFrame)

    return () => window.cancelAnimationFrame(frameId)
  }, [])

  return renderTime
}

const usePriceChartWidth = () => {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState(BASE_PRICE_CHART_WIDTH)
  const containerRef = useCallback((node: HTMLElement | null) => {
    setContainer(node)
  }, [])

  useLayoutEffect(() => {
    if (!container) return

    const updateWidth = (nextWidth: number) => {
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return

      setWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) < 0.5 ? currentWidth : nextWidth,
      )
    }
    const measure = () => updateWidth(container.getBoundingClientRect().width)

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry.contentRect.width)
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [container])

  return { containerRef, width }
}

const DirectionChevrons = ({
  onComplete,
}: {
  onComplete?: () => void
}) => (
  <g className="price-chart__direction-glyph" aria-hidden="true">
    <path
      className="price-chart__direction-chevron price-chart__direction-chevron--second"
      d="M7 11L12 6L17 11"
      onAnimationEnd={() => onComplete?.()}
    />
    <path
      className="price-chart__direction-chevron price-chart__direction-chevron--first"
      d="M7 17L12 12L17 17"
    />
  </g>
)

export function PriceChart({
  points,
  domain,
  renderDomain = domain,
  currentPrice,
  priceDirection,
  directionAnimationSequence,
  entries = [],
  currency = 'USD',
  locale = 'en-US',
  timeZone,
  className = '',
  seriesKey,
  viewAnchorTimestamp,
  onViewAnchorChange,
  onWindowSpanChange,
  resetReason,
  source,
  status,
  updatedAt,
}: PriceChartProps) {
  const id = useId().replace(/:/g, '')
  const [completedDirectionSequence, setCompletedDirectionSequence] = useState(0)
  const safePoints = useMemo(
    () =>
      points
        .filter(
          ({ timestamp, value }) =>
            Number.isFinite(timestamp) && Number.isFinite(value),
        )
        .slice()
        .sort((first, second) => first.timestamp - second.timestamp),
    [points],
  )
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currency, locale],
  )
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone,
      }),
    [locale, timeZone],
  )
  const entryAmountFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [currency, locale],
  )
  const { containerRef, width: containerWidth } = usePriceChartWidth()
  const {
    width: chartWidth,
    plotRight,
    seriesRight,
    currentLabelX,
    priceLabelX,
    directionIconX,
  } = getPriceChartGeometry(containerWidth)
  const latestPoint = safePoints.at(-1)
  const latestPrice = currentPrice ?? latestPoint?.value ?? 0
  const isDirectionVisible = priceDirection !== null
    && directionAnimationSequence > completedDirectionSequence

  useEffect(() => {
    if (directionAnimationSequence === 0) return

    const timer = window.setTimeout(() => {
      setCompletedDirectionSequence((currentSequence) =>
        Math.max(currentSequence, directionAnimationSequence),
      )
    }, DIRECTION_ANIMATION_FALLBACK_MS)

    return () => window.clearTimeout(timer)
  }, [directionAnimationSequence])
  const priceLabelSample = priceFormatter.format(renderDomain.top)
  const priceLabelRef = useRef<SVGTextElement | null>(null)
  const [priceLabelWidth, setPriceLabelWidth] = useState(0)

  useLayoutEffect(() => {
    const node = priceLabelRef.current
    if (node === null) return

    const measuredWidth = node.getBBox().width
    if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) return

    setPriceLabelWidth((currentWidth) =>
      Math.abs(currentWidth - measuredWidth) < 0.5 ? currentWidth : measuredWidth,
    )
  }, [priceLabelSample.length, chartWidth])

  const renderTime = useRenderTime()
  const displayTime = Math.max(renderTime, latestPoint?.timestamp ?? renderTime)
  const windowSpanMs = (seriesRight / PIXELS_PER_SECOND) * 1000
  const isPanned = viewAnchorTimestamp !== null
  const anchorTime = viewAnchorTimestamp ?? displayTime
  const anchorPrice = isPanned
    ? interpolatePriceAt(safePoints, anchorTime) ?? latestPrice
    : latestPrice
  const { isPanning, panHandlers, returnToLive } = usePriceChartPan({
    points: safePoints,
    latestTimestamp: displayTime,
    windowSpanMs,
    pixelsPerSecond: PIXELS_PER_SECOND,
    viewAnchorTimestamp,
    onViewAnchorChange,
  })

  useEffect(() => {
    onWindowSpanChange?.(windowSpanMs)
  }, [onWindowSpanChange, windowSpanMs])

  const visibleEntries = useMemo(
    () => (isPanned ? [] : layoutPriceChartEntries(entries, displayTime)),
    [displayTime, entries, isPanned],
  )

  if (safePoints.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`price-chart price-chart--empty ${className}`}
        role="status"
      >
        Esperando datos del mercado
      </div>
    )
  }

  const { bottom, top } = renderDomain
  const { step } = domain
  const priceToY = (value: number) =>
    PLOT_TOP + ((top - value) / (top - bottom)) * (PLOT_BOTTOM - PLOT_TOP)
  const animatedSafePoints = safePoints.map((point, index) => (
    index === safePoints.length - 1
      ? { ...point, value: latestPrice }
      : point
  ))
  const pointsWithCurrent = latestPoint?.timestamp === displayTime
    ? animatedSafePoints
    : [
        ...animatedSafePoints,
        { timestamp: displayTime, value: latestPrice },
      ]
  const visibleSeries = getContinuousVisiblePricePoints(
    pointsWithCurrent,
    anchorTime,
    seriesRight,
    0,
    PIXELS_PER_SECOND,
  )
  const chartPoints: ChartPoint[] = visibleSeries.points.map((point) => ({
    ...point,
    y: priceToY(point.value),
  }))
  const currentPoint: ChartPoint = {
    timestamp: anchorTime,
    value: anchorPrice,
    x: seriesRight,
    y: priceToY(anchorPrice),
  }
  // O recorte existe apenas para abrir espaço para os chevrons. Sem direção
  // confirmada ele deixaria um buraco permanente no tracejado, então fecha.
  const isDirectionActive = priceDirection !== null && !isPanned
  const directionClearClassName = `price-chart__direction-clear${
    isDirectionActive ? '' : ' price-chart__direction-clear--closed'
  }`
  const directionCenterX = directionIconX + 12
  const visibleLinePoints = chartPoints.length > 0
    ? chartPoints
    : [currentPoint]
  const linePath = getSmoothPath(visibleLinePoints)
  const areaStartX = visibleLinePoints[0]?.x ?? PLOT_LEFT
  const areaPath = `${linePath} L ${seriesRight} ${PLOT_BOTTOM} L ${areaStartX} ${PLOT_BOTTOM} Z`
  const ticks = Array.from(
    { length: GRID_LINE_COUNT },
    (_, index) => top - step * index,
  )
  const latestTimeTick =
    Math.floor(anchorTime / TIME_TICK_INTERVAL) * TIME_TICK_INTERVAL
  const timeTickCount = Math.max(
    4,
    Math.ceil((seriesRight - PLOT_LEFT) / TIME_TICK_SPACING) + 1,
  )
  const timeTicks = Array.from({ length: timeTickCount }, (_, index) => {
    const timestamp = latestTimeTick - index * TIME_TICK_INTERVAL

    return {
      timestamp,
      x:
        seriesRight -
        ((anchorTime - timestamp) / 1000) * PIXELS_PER_SECOND,
    }
  })

  return (
    <figure
      ref={containerRef}
      className={`price-chart ${isPanned ? 'price-chart--panned' : ''} ${isPanning ? 'price-chart--panning' : ''} ${className}`}
      aria-label={isPanned
        ? `Gráfico del historial de la ronda: ${priceFormatter.format(anchorPrice)}`
        : `Gráfico del precio actual: ${priceFormatter.format(latestPrice)}`}
      data-testid="price-chart"
      data-panned={isPanned}
      data-view-anchor={viewAnchorTimestamp ?? ''}
      data-window-span={Math.round(windowSpanMs)}
      style={priceLabelWidth > 0
        ? {
            '--price-chart-value-right': `${Math.max(
              0,
              chartWidth - priceLabelX - priceLabelWidth,
            )}px`,
          } as CSSProperties
        : undefined}
      {...panHandlers}
      data-point-count={safePoints.length}
      data-displayed-price={latestPrice}
      data-domain-bottom={domain.bottom}
      data-domain-top={domain.top}
      data-domain-step={domain.step}
      data-domain-trend-shift={domain.trendShiftIntervals ?? 0}
      data-render-domain-bottom={renderDomain.bottom}
      data-render-domain-top={renderDomain.top}
      data-render-domain-step={renderDomain.step}
      data-series-key={seriesKey}
      data-series-reset-reason={resetReason}
      data-series-start={safePoints[0]?.timestamp ?? ''}
      data-visible-point-count={visibleSeries.points.length}
      data-continuity-applied={visibleSeries.continuityApplied}
      data-gap-count={countPricePointGaps(safePoints)}
      data-current-source={source ?? ''}
      data-current-status={status}
      data-current-updated-at={updatedAt ?? ''}
    >
      <svg
        className="price-chart__canvas"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`0 0 ${chartWidth} ${PRICE_CHART_HEIGHT}`}
        role="img"
        aria-label="Precio en tiempo real"
        aria-describedby={`price-chart-description-${id}`}
      >
        <desc id={`price-chart-description-${id}`}>
          Serie con {safePoints.length} actualizaciones. El precio más reciente es{' '}
          {priceFormatter.format(latestPrice)}.
        </desc>

        <defs>
          <linearGradient id={`price-area-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#fbfbfb" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#fbfbfb" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={`current-price-${id}`}
            x1="0"
            x2="1"
            y1="1"
            y2="0"
          >
            <stop offset="0%" stopColor="#4b20ff" />
            <stop offset="100%" stopColor="#9730ff" />
          </linearGradient>
          <linearGradient
            id={`plot-fade-${id}`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2={PLOT_FADE_WIDTH}
            y1="0"
            y2="0"
          >
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="10%" stopColor="#fff" stopOpacity="0.028" />
            <stop offset="20%" stopColor="#fff" stopOpacity="0.104" />
            <stop offset="30%" stopColor="#fff" stopOpacity="0.216" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.352" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#fff" stopOpacity="0.648" />
            <stop offset="70%" stopColor="#fff" stopOpacity="0.784" />
            <stop offset="80%" stopColor="#fff" stopOpacity="0.896" />
            <stop offset="90%" stopColor="#fff" stopOpacity="0.972" />
            <stop offset="100%" stopColor="#fff" />
          </linearGradient>
          <mask
            id={`plot-fade-mask-${id}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="5"
            width={plotRight}
            height="216"
          >
            <rect
              x="0"
              y="5"
              width={plotRight}
              height="216"
              fill={`url(#plot-fade-${id})`}
            />
            <rect
              className={directionClearClassName}
              x={directionCenterX - DIRECTION_CLEAR_SIZE / 2}
              y={currentPoint.y - DIRECTION_CLEAR_SIZE / 2}
              width={DIRECTION_CLEAR_SIZE}
              height={DIRECTION_CLEAR_SIZE}
              fill="#000"
            />
          </mask>
          <mask
            id={`chart-clear-mask-${id}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={chartWidth}
            height={PRICE_CHART_HEIGHT}
          >
            <rect width={chartWidth} height={PRICE_CHART_HEIGHT} fill="#fff" />
            <rect
              className={directionClearClassName}
              x={directionCenterX - DIRECTION_CLEAR_SIZE / 2}
              y={currentPoint.y - DIRECTION_CLEAR_SIZE / 2}
              width={DIRECTION_CLEAR_SIZE}
              height={DIRECTION_CLEAR_SIZE}
              fill="#000"
            />
          </mask>
          <mask
            id={`current-line-clear-mask-${id}`}
            maskUnits="userSpaceOnUse"
            x="0"
            y={-DIRECTION_CLEAR_SIZE / 2}
            width={chartWidth}
            height={DIRECTION_CLEAR_SIZE}
          >
            <rect
              x="0"
              y={-DIRECTION_CLEAR_SIZE / 2}
              width={chartWidth}
              height={DIRECTION_CLEAR_SIZE}
              fill="#fff"
            />
            <rect
              className={directionClearClassName}
              x={directionCenterX - DIRECTION_CLEAR_SIZE / 2}
              y={-DIRECTION_CLEAR_SIZE / 2}
              width={DIRECTION_CLEAR_SIZE}
              height={DIRECTION_CLEAR_SIZE}
              fill="#000"
            />
          </mask>
          <clipPath id={`plot-clip-${id}`}>
            <rect x="0" y="5" width={plotRight} height="216" />
          </clipPath>
          <filter
            id={`point-glow-${id}`}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          className="price-chart__grid"
          mask={`url(#chart-clear-mask-${id})`}
          aria-hidden="true"
        >
          {ticks.map((tick, index) => {
            const y =
              PLOT_TOP +
              (index * (PLOT_BOTTOM - PLOT_TOP)) / (GRID_LINE_COUNT - 1)

            return (
              <g
                key={`grid-tick-${index}`}
                className="price-chart__grid-tick"
                style={{ transform: `translateY(${y}px)` }}
              >
                <line x1={PLOT_LEFT} x2={plotRight} y1="0" y2="0" />
                <text
                  ref={index === 0 ? priceLabelRef : undefined}
                  x={priceLabelX}
                  y="4"
                >
                  {priceFormatter.format(tick)}
                </text>
              </g>
            )
          })}
        </g>

        <g
          clipPath={`url(#plot-clip-${id})`}
          mask={`url(#plot-fade-mask-${id})`}
          aria-hidden="true"
        >
          <path
            className="price-chart__area"
            d={areaPath}
            fill={`url(#price-area-${id})`}
          />
          <path className="price-chart__line" d={linePath} pathLength="1" />
        </g>

        <g
          className="price-chart__current-level"
          style={{ transform: `translateY(${currentPoint.y}px)` }}
          aria-hidden="true"
        >
          <line
            className="price-chart__current-line"
            mask={`url(#current-line-clear-mask-${id})`}
            x1={PLOT_LEFT}
            x2={plotRight}
            y1="0"
            y2="0"
          />
          <circle
            className="price-chart__point-halo"
            cx={seriesRight}
            cy="0"
            r="10"
          />
          <circle
            className="price-chart__point-ring"
            cx={seriesRight}
            cy="0"
            r="6.5"
            filter={`url(#point-glow-${id})`}
          />
          <circle
            className="price-chart__point"
            cx={seriesRight}
            cy="0"
            r="3"
          />
          <g
            className="price-chart__direction"
            data-direction-visible={isDirectionVisible && !isPanned}
            data-price-direction={priceDirection ?? 'locked'}
            data-direction-sequence={directionAnimationSequence}
            transform={`translate(${directionIconX} -12)`}
          >
            <g
              className={`price-chart__direction-state price-chart__direction-state--up ${isDirectionVisible && !isPanned && priceDirection === 'up' ? 'price-chart__direction-state--active' : ''}`}
            >
              <DirectionChevrons
                key={`up-${directionAnimationSequence}`}
                onComplete={priceDirection === 'up'
                  ? () => setCompletedDirectionSequence(
                    directionAnimationSequence,
                  )
                  : undefined}
              />
            </g>
            <g
              className={`price-chart__direction-state price-chart__direction-state--down ${isDirectionVisible && !isPanned && priceDirection === 'down' ? 'price-chart__direction-state--active' : ''}`}
            >
              <DirectionChevrons
                key={`down-${directionAnimationSequence}`}
                onComplete={priceDirection === 'down'
                  ? () => setCompletedDirectionSequence(
                    directionAnimationSequence,
                  )
                  : undefined}
              />
            </g>
          </g>
          <g
            className="price-chart__current-label"
            transform={`translate(${currentLabelX} -9)`}
          >
            <path
              d={`M 8 0 H ${CURRENT_LABEL_WIDTH - 9} Q ${CURRENT_LABEL_WIDTH} 0 ${CURRENT_LABEL_WIDTH} 9 Q ${CURRENT_LABEL_WIDTH} 18 ${CURRENT_LABEL_WIDTH - 9} 18 H 8 L 0 9 Z`}
              fill={`url(#current-price-${id})`}
            />
            <text x="10" y="13">
              {priceFormatter.format(anchorPrice)}
            </text>
          </g>
        </g>

        <g className="price-chart__entry-feed" aria-hidden="true">
          {visibleEntries.map(({ entry, opacity, progress, x, y }) => (
            <g
              key={entry.id}
              className={`price-chart__entry price-chart__entry--${entry.direction}`}
              data-entry-amount={entry.amount}
              data-entry-direction={entry.direction}
              data-entry-id={entry.id}
              data-entry-progress={progress.toFixed(3)}
              style={{
                opacity,
                transform: `translate(${x}px, ${y}px)`,
              }}
            >
              <text x="0" y="0">
                +{entryAmountFormatter.format(entry.amount)}
              </text>
            </g>
          ))}
        </g>

        <g className="price-chart__time-axis" aria-hidden="true">
          {timeTicks.map(({ timestamp, x }) => (
            <g
              key={timestamp}
              className="price-chart__time-tick"
              data-time-tick={timestamp}
              style={{
                opacity: getTimeTickOpacity(
                  x,
                  PLOT_LEFT,
                  seriesRight,
                  TIME_TICK_FADE_DISTANCE,
                ),
              }}
            >
              <line
                x1={x}
                x2={x}
                y1="220"
                y2="225"
              />
              <text x={x} y="246" textAnchor="middle">
                {timeFormatter.format(timestamp)}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {isPanned ? (
        <button
          aria-label="Volver al precio en vivo"
          className="price-chart__live-button"
          onClick={returnToLive}
          type="button"
        >
          <LiveIndicator className="price-chart__live-dot" />
          LIVE
        </button>
      ) : (
        <output className="price-chart__live-value" aria-live="polite">
          {priceFormatter.format(latestPrice)}
        </output>
      )}
    </figure>
  )
}
