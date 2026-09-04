import {
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

interface ScrollSnapshot {
  windowX: number
  windowY: number
  scrollContainers: Array<{
    element: HTMLElement
    left: number
    top: number
  }>
}

interface UseTapFocusScrollGuardOptions {
  inputRef: RefObject<HTMLInputElement | null>
  isEnabled: boolean
  onFocus?: () => void
}

const hasScrollableOverflow = (element: HTMLElement) => {
  const style = window.getComputedStyle(element)

  return /(auto|scroll|overlay)/.test(
    `${style.overflow}${style.overflowX}${style.overflowY}`,
  )
}

const captureScrollSnapshot = (element: HTMLElement): ScrollSnapshot => {
  const scrollContainers: ScrollSnapshot['scrollContainers'] = []
  let parentElement = element.parentElement

  while (parentElement) {
    if (hasScrollableOverflow(parentElement)) {
      scrollContainers.push({
        element: parentElement,
        left: parentElement.scrollLeft,
        top: parentElement.scrollTop,
      })
    }

    parentElement = parentElement.parentElement
  }

  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    scrollContainers,
  }
}

const restoreScrollSnapshot = (snapshot: ScrollSnapshot) => {
  window.scrollTo(snapshot.windowX, snapshot.windowY)

  snapshot.scrollContainers.forEach(({ element, left, top }) => {
    element.scrollLeft = left
    element.scrollTop = top
  })
}

const restoreScrollSnapshotAfterFocus = (snapshot: ScrollSnapshot) => {
  restoreScrollSnapshot(snapshot)

  window.requestAnimationFrame(() => {
    restoreScrollSnapshot(snapshot)
    window.requestAnimationFrame(() => restoreScrollSnapshot(snapshot))
  })

  window.setTimeout(() => restoreScrollSnapshot(snapshot), 80)
  window.setTimeout(() => restoreScrollSnapshot(snapshot), 160)
  window.setTimeout(() => restoreScrollSnapshot(snapshot), 320)
}

const TAP_MOVEMENT_TOLERANCE_PX = 10

export function useTapFocusScrollGuard({
  inputRef,
  isEnabled,
  onFocus,
}: UseTapFocusScrollGuardOptions) {
  const pendingScrollSnapshotRef = useRef<ScrollSnapshot | null>(null)
  const pendingTapRef = useRef<{
    pointerId: number
    startX: number
    startY: number
  } | null>(null)

  const handleFieldPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!isEnabled) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button')) {
      pendingTapRef.current = null
      return
    }
    if (
      document.activeElement === inputRef.current
      && event.target === inputRef.current
    ) return

    // Impede o reveal nativo do iOS; o foco só acontece quando o gesto termina
    // como toque, preservando tanto a página quanto os scrollers ancestrais.
    event.preventDefault()
    pendingTapRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  const handleFieldPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest('button')) {
      pendingTapRef.current = null
      return
    }

    const pendingTap = pendingTapRef.current
    pendingTapRef.current = null

    if (!isEnabled || !pendingTap || pendingTap.pointerId !== event.pointerId) {
      return
    }

    const tapDistance = Math.hypot(
      event.clientX - pendingTap.startX,
      event.clientY - pendingTap.startY,
    )

    if (tapDistance > TAP_MOVEMENT_TOLERANCE_PX) return

    const input = inputRef.current
    if (!input) return

    const scrollSnapshot = captureScrollSnapshot(input)

    pendingScrollSnapshotRef.current = scrollSnapshot
    input.focus({ preventScroll: true })
    restoreScrollSnapshotAfterFocus(scrollSnapshot)
  }

  const handleFieldPointerCancel = () => {
    pendingTapRef.current = null
  }

  const handleFocus = () => {
    onFocus?.()

    if (!isEnabled || pendingScrollSnapshotRef.current === null) return

    const scrollSnapshot = pendingScrollSnapshotRef.current

    pendingScrollSnapshotRef.current = null
    restoreScrollSnapshotAfterFocus(scrollSnapshot)
  }

  return {
    handleFieldPointerDown,
    handleFieldPointerUp,
    handleFieldPointerCancel,
    handleFocus,
  }
}
