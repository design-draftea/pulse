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
const KEYBOARD_OPEN_THRESHOLD_PX = 60

const isVirtualKeyboardOpen = () => {
  const visualViewport = window.visualViewport

  if (!visualViewport) return false

  const layoutViewportHeight = Math.max(
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
  )

  return layoutViewportHeight - visualViewport.height
    > KEYBOARD_OPEN_THRESHOLD_PX
}

export function useTapFocusScrollGuard({
  inputRef,
  isEnabled,
  onFocus,
}: UseTapFocusScrollGuardOptions) {
  const pendingScrollSnapshotRef = useRef<ScrollSnapshot | null>(null)
  const pendingTapRef = useRef<{
    pointerId: number
    resetFocusedInput: boolean
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
    const isFocusedInputTap = (
      document.activeElement === inputRef.current
      && event.target === inputRef.current
    )

    // O botão nativo de recolher o teclado no iOS mantém o input focado. Nesse
    // estado, o toque seguinte não dispara um novo focus e escaparia do guard,
    // deixando o Safari revelar o campo pela rolagem da página. Com o teclado
    // aberto preservamos o comportamento nativo de posicionar o caret; com ele
    // fechado refazemos o foco no pointerup pelo mesmo caminho protegido do
    // primeiro toque.
    if (
      isFocusedInputTap
      && (event.pointerType === 'mouse' || isVirtualKeyboardOpen())
    ) return

    // Impede o reveal nativo do iOS; o foco só acontece quando o gesto termina
    // como toque, preservando tanto a página quanto os scrollers ancestrais.
    event.preventDefault()
    pendingTapRef.current = {
      pointerId: event.pointerId,
      resetFocusedInput: isFocusedInputTap,
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

    if (pendingTap.resetFocusedInput && document.activeElement === input) {
      input.blur()
    }

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
