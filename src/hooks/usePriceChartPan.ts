import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  clampPriceChartAnchor,
  type PricePoint,
} from '../components/priceChartModel'

type PriceChartPanOptions = {
  points: PricePoint[]
  latestTimestamp: number
  windowSpanMs: number
  pixelsPerSecond: number
  viewAnchorTimestamp: number | null
  onViewAnchorChange: (next: number | null) => void
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  startAnchor: number
  axis: 'undecided' | 'horizontal' | 'vertical'
  lastX: number
  lastMovedAt: number
  velocity: number
}

const AXIS_LOCK_THRESHOLD_PX = 8
const LIVE_SNAP_TOLERANCE_MS = 400
const INERTIA_DECAY_PER_FRAME = 0.94
const INERTIA_MINIMUM_VELOCITY_PX_PER_MS = 0.02
const INERTIA_MAXIMUM_VELOCITY_PX_PER_MS = 6
const RETURN_TO_LIVE_DURATION_MS = 320
const REFERENCE_FRAME_MS = 1000 / 60

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
)

export const usePriceChartPan = ({
  points,
  latestTimestamp,
  windowSpanMs,
  pixelsPerSecond,
  viewAnchorTimestamp,
  onViewAnchorChange,
}: PriceChartPanOptions) => {
  const [isPanning, setIsPanning] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const frameRef = useRef(0)
  const contextRef = useRef({
    points,
    latestTimestamp,
    windowSpanMs,
    pixelsPerSecond,
    viewAnchorTimestamp,
    onViewAnchorChange,
  })

  useEffect(() => {
    contextRef.current = {
      points,
      latestTimestamp,
      windowSpanMs,
      pixelsPerSecond,
      viewAnchorTimestamp,
      onViewAnchorChange,
    }
  })

  const stopAnimation = useCallback(() => {
    if (frameRef.current === 0) return
    window.cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
  }, [])

  useEffect(() => stopAnimation, [stopAnimation])

  const commitAnchor = useCallback((anchor: number) => {
    const context = contextRef.current
    const clamped = clampPriceChartAnchor(
      anchor,
      context.points,
      context.windowSpanMs,
      context.latestTimestamp,
    )

    context.onViewAnchorChange(
      clamped >= context.latestTimestamp - LIVE_SNAP_TOLERANCE_MS
        ? null
        : clamped,
    )

    return clamped
  }, [])

  const startInertia = useCallback((velocityPxPerMs: number, anchor: number) => {
    const boundedVelocity = Math.max(
      -INERTIA_MAXIMUM_VELOCITY_PX_PER_MS,
      Math.min(INERTIA_MAXIMUM_VELOCITY_PX_PER_MS, velocityPxPerMs),
    )

    if (
      prefersReducedMotion()
      || Math.abs(boundedVelocity) < INERTIA_MINIMUM_VELOCITY_PX_PER_MS
    ) return

    stopAnimation()

    let velocity = boundedVelocity
    let currentAnchor = anchor
    let previousFrameTime = window.performance.now()

    const step = (frameTime: number) => {
      const elapsed = Math.min(64, frameTime - previousFrameTime)
      previousFrameTime = frameTime
      currentAnchor -= (velocity * elapsed / contextRef.current.pixelsPerSecond) * 1000

      const clamped = commitAnchor(currentAnchor)
      const decay = INERTIA_DECAY_PER_FRAME ** (elapsed / REFERENCE_FRAME_MS)
      velocity *= decay

      if (
        clamped !== currentAnchor
        || clamped >= contextRef.current.latestTimestamp - LIVE_SNAP_TOLERANCE_MS
        || Math.abs(velocity) < INERTIA_MINIMUM_VELOCITY_PX_PER_MS
      ) {
        frameRef.current = 0
        return
      }

      frameRef.current = window.requestAnimationFrame(step)
    }

    frameRef.current = window.requestAnimationFrame(step)
  }, [commitAnchor, stopAnimation])

  const returnToLive = useCallback(() => {
    stopAnimation()

    const context = contextRef.current
    const from = context.viewAnchorTimestamp

    if (from === null || prefersReducedMotion()) {
      context.onViewAnchorChange(null)
      return
    }

    const startedAt = window.performance.now()
    const step = (frameTime: number) => {
      const progress = Math.min(
        1,
        (frameTime - startedAt) / RETURN_TO_LIVE_DURATION_MS,
      )
      const eased = 1 - (1 - progress) ** 3
      const to = contextRef.current.latestTimestamp

      if (progress >= 1) {
        frameRef.current = 0
        contextRef.current.onViewAnchorChange(null)
        return
      }

      contextRef.current.onViewAnchorChange(from + (to - from) * eased)
      frameRef.current = window.requestAnimationFrame(step)
    }

    frameRef.current = window.requestAnimationFrame(step)
  }, [stopAnimation])

  const cancelPan = useCallback(() => {
    stopAnimation()
    dragRef.current = null
    setIsPanning(false)
  }, [stopAnimation])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    stopAnimation()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startAnchor: contextRef.current.viewAnchorTimestamp
        ?? contextRef.current.latestTimestamp,
      axis: 'undecided',
      lastX: event.clientX,
      lastMovedAt: event.timeStamp,
      velocity: 0,
    }
  }, [stopAnimation])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY

    if (drag.axis === 'undecided') {
      if (
        Math.abs(deltaX) >= AXIS_LOCK_THRESHOLD_PX
        && Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        drag.axis = 'horizontal'
        setIsPanning(true)
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Um ponteiro já liberado pelo navegador não impede o arrasto.
        }
      } else if (Math.abs(deltaY) >= AXIS_LOCK_THRESHOLD_PX) {
        drag.axis = 'vertical'
      }
    }

    if (drag.axis !== 'horizontal') return

    const elapsed = Math.max(1, event.timeStamp - drag.lastMovedAt)
    drag.velocity = (event.clientX - drag.lastX) / elapsed
    drag.lastX = event.clientX
    drag.lastMovedAt = event.timeStamp

    commitAnchor(
      drag.startAnchor
      - (deltaX / contextRef.current.pixelsPerSecond) * 1000,
    )
  }, [commitAnchor])

  const handlePointerEnd = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (drag === null || drag.pointerId !== event.pointerId) return

    dragRef.current = null
    setIsPanning(false)

    if (drag.axis !== 'horizontal') return

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // O navegador pode ter liberado a captura antes do fim do gesto.
    }

    const idleTime = event.timeStamp - drag.lastMovedAt
    const anchor = contextRef.current.viewAnchorTimestamp
      ?? contextRef.current.latestTimestamp

    if (event.type === 'pointercancel' || idleTime > 120) return

    startInertia(drag.velocity, anchor)
  }, [startInertia])

  return {
    cancelPan,
    isPanning,
    returnToLive,
    panHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
    },
  }
}
