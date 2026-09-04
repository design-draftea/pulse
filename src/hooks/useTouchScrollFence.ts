import { useLayoutEffect } from 'react'

/**
 * Impede que o Safari arraste o documento inteiro com o teclado aberto. Gestos
 * só passam quando um scroller interno ainda tem espaço naquela direção.
 */
export function useTouchScrollFence(
  elementRef: { current: HTMLElement | null },
  isActive = true,
) {
  useLayoutEffect(() => {
    if (!isActive) return undefined

    const rootElement = elementRef.current
    if (!rootElement) return undefined

    let activeTouch: {
      startY: number
      scrollable: HTMLElement | null
    } | null = null

    const findScrollableAncestor = (
      start: EventTarget | null,
    ): HTMLElement | null => {
      let element = start instanceof Element ? start : null

      while (element && element !== rootElement) {
        if (
          element instanceof HTMLElement
          && element.scrollHeight > element.clientHeight + 1
        ) {
          const { overflowY } = window.getComputedStyle(element)

          if (overflowY === 'auto' || overflowY === 'scroll') return element
        }

        element = element.parentElement
      }

      return null
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        activeTouch = null
        return
      }

      activeTouch = {
        startY: event.touches[0].clientY,
        scrollable: findScrollableAncestor(event.target),
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!event.cancelable || event.touches.length !== 1 || !activeTouch) return

      const { startY, scrollable } = activeTouch

      if (!scrollable) {
        event.preventDefault()
        return
      }

      const deltaY = event.touches[0].clientY - startY
      const maxScrollTop = scrollable.scrollHeight - scrollable.clientHeight
      const isAtTop = scrollable.scrollTop <= 0
      const isAtBottom = scrollable.scrollTop >= maxScrollTop - 1

      if ((deltaY > 0 && isAtTop) || (deltaY < 0 && isAtBottom)) {
        event.preventDefault()
      }
    }

    const handleTouchEnd = () => {
      activeTouch = null
    }

    rootElement.addEventListener('touchstart', handleTouchStart, { passive: true })
    rootElement.addEventListener('touchmove', handleTouchMove, { passive: false })
    rootElement.addEventListener('touchend', handleTouchEnd, { passive: true })
    rootElement.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      rootElement.removeEventListener('touchstart', handleTouchStart)
      rootElement.removeEventListener('touchmove', handleTouchMove)
      rootElement.removeEventListener('touchend', handleTouchEnd)
      rootElement.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [elementRef, isActive])
}
