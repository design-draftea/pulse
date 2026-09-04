import { useLayoutEffect, type RefObject } from 'react'

interface UseStableKeyboardViewportOptions<T extends HTMLElement> {
  rootRef: RefObject<T | null>
  scrollContainerSelector: string
  stableHeightCssVariable: string
  keyboardInsetCssVariable: string
  enabled?: boolean
}

const isKeyboardFocusElement = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  if (
    element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
  ) return true
  if (!(element instanceof HTMLInputElement)) return false

  return ![
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ].includes(element.type)
}

export function useStableKeyboardViewport<T extends HTMLElement>({
  rootRef,
  scrollContainerSelector,
  stableHeightCssVariable,
  keyboardInsetCssVariable,
  enabled = true,
}: UseStableKeyboardViewportOptions<T>) {
  useLayoutEffect(() => {
    if (!enabled) return undefined

    const rootElement = rootRef.current
    if (!rootElement) return undefined

    let stableViewportHeight = 0
    let keyboardInset = 0
    let viewportUpdateTimer: number | null = null
    let revealTimer: number | null = null

    const readLayoutViewportHeight = () => Math.max(
      window.innerHeight || 0,
      document.documentElement.clientHeight || 0,
      1,
    )

    const readVisibleViewportBottom = () => {
      const visualViewport = window.visualViewport

      if (!visualViewport) return readLayoutViewportHeight()

      return visualViewport.offsetTop + visualViewport.height
    }

    const revealFocusedField = () => {
      const activeElement = document.activeElement

      if (!(activeElement instanceof HTMLElement)) return
      if (
        !isKeyboardFocusElement(activeElement)
        || !rootElement.contains(activeElement)
      ) return

      const scrollContainer = activeElement.closest(scrollContainerSelector)

      if (
        !(scrollContainer instanceof HTMLElement)
        || !rootElement.contains(scrollContainer)
      ) return

      const scrollContainerBottom = scrollContainer.getBoundingClientRect().bottom
      const visibleContentBottom = Math.min(
        readVisibleViewportBottom(),
        scrollContainerBottom,
      )
      const hiddenBelow = activeElement.getBoundingClientRect().bottom
        + 24
        - visibleContentBottom

      if (hiddenBelow > 0) scrollContainer.scrollTop += hiddenBelow
    }

    const scheduleFocusedFieldReveal = () => {
      window.requestAnimationFrame(revealFocusedField)

      if (revealTimer !== null) window.clearTimeout(revealTimer)
      revealTimer = window.setTimeout(() => {
        revealTimer = null
        revealFocusedField()
      }, 400)
    }

    const updateKeyboardInset = () => {
      const visibleBottom = readVisibleViewportBottom()

      if (visibleBottom > stableViewportHeight + 1) {
        const nextViewportHeight = readLayoutViewportHeight()

        if (Math.abs(nextViewportHeight - stableViewportHeight) >= 1) {
          stableViewportHeight = nextViewportHeight
          rootElement.style.setProperty(
            stableHeightCssVariable,
            `${nextViewportHeight}px`,
          )
        }
      }

      const layoutHeight = stableViewportHeight || readLayoutViewportHeight()
      const nextKeyboardInset = Math.max(
        0,
        Math.round(layoutHeight - visibleBottom),
      )

      if (Math.abs(nextKeyboardInset - keyboardInset) < 2) return

      keyboardInset = nextKeyboardInset
      rootElement.style.setProperty(
        keyboardInsetCssVariable,
        `${nextKeyboardInset}px`,
      )

      if (nextKeyboardInset > 0) scheduleFocusedFieldReveal()
    }

    const updateStableViewportHeight = (force = false) => {
      if (force || !isKeyboardFocusElement(document.activeElement)) {
        const nextViewportHeight = readLayoutViewportHeight()

        if (Math.abs(nextViewportHeight - stableViewportHeight) >= 1) {
          stableViewportHeight = nextViewportHeight
          rootElement.style.setProperty(
            stableHeightCssVariable,
            `${nextViewportHeight}px`,
          )
        }
      }

      updateKeyboardInset()
    }

    const scheduleStableViewportHeightUpdate = (force = false) => {
      if (viewportUpdateTimer !== null) {
        window.clearTimeout(viewportUpdateTimer)
      }

      viewportUpdateTimer = window.setTimeout(() => {
        viewportUpdateTimer = null
        updateStableViewportHeight(force)
      }, force ? 320 : 120)
    }

    updateStableViewportHeight(true)

    const handleViewportResize = () => {
      updateKeyboardInset()
      scheduleStableViewportHeightUpdate()
    }
    const handleOrientationChange = () => scheduleStableViewportHeightUpdate(true)
    const handleVisualViewportChange = () => updateKeyboardInset()
    const handleFocusInReveal = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null

      if (!target || !rootElement.contains(target)) return
      if (!isKeyboardFocusElement(target)) return

      scheduleFocusedFieldReveal()
    }

    window.addEventListener('resize', handleViewportResize)
    window.addEventListener('orientationchange', handleOrientationChange)
    window.visualViewport?.addEventListener('resize', handleVisualViewportChange)
    window.visualViewport?.addEventListener('scroll', handleVisualViewportChange)
    document.addEventListener('focusin', handleFocusInReveal)

    return () => {
      if (viewportUpdateTimer !== null) {
        window.clearTimeout(viewportUpdateTimer)
      }
      if (revealTimer !== null) window.clearTimeout(revealTimer)

      window.removeEventListener('resize', handleViewportResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
      window.visualViewport?.removeEventListener('resize', handleVisualViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleVisualViewportChange)
      document.removeEventListener('focusin', handleFocusInReveal)
      rootElement.style.removeProperty(stableHeightCssVariable)
      rootElement.style.removeProperty(keyboardInsetCssVariable)
    }
  }, [
    enabled,
    keyboardInsetCssVariable,
    rootRef,
    scrollContainerSelector,
    stableHeightCssVariable,
  ])

  useLayoutEffect(() => {
    if (!enabled) return undefined

    const rootElement = rootRef.current
    if (!rootElement) return undefined

    const lockedWindowX = window.scrollX
    const lockedWindowY = window.scrollY
    let restoreFrame: number | null = null
    const restoreTimers: number[] = []

    const hasWindowScroll = () => (
      Math.abs(window.scrollX - lockedWindowX) >= 1
      || Math.abs(window.scrollY - lockedWindowY) >= 1
    )

    const restoreWindowScroll = () => {
      document.documentElement.scrollLeft = lockedWindowX
      document.documentElement.scrollTop = lockedWindowY
      document.body.scrollLeft = lockedWindowX
      document.body.scrollTop = lockedWindowY

      if (hasWindowScroll()) window.scrollTo(lockedWindowX, lockedWindowY)
    }

    const scheduleWindowScrollRestore = () => {
      restoreWindowScroll()

      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame)
      restoreTimers.splice(0).forEach((timer) => window.clearTimeout(timer))

      restoreFrame = window.requestAnimationFrame(() => {
        restoreFrame = null
        restoreWindowScroll()
      })

      ;[80, 160, 320].forEach((delay) => {
        restoreTimers.push(window.setTimeout(restoreWindowScroll, delay))
      })
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null

      if (!target || !rootElement.contains(target)) return
      if (!isKeyboardFocusElement(target)) return

      scheduleWindowScrollRestore()
    }

    const handleWindowScroll = () => {
      if (!hasWindowScroll()) return
      if (!isKeyboardFocusElement(document.activeElement)) return

      scheduleWindowScrollRestore()
    }

    document.addEventListener('focusin', handleFocusIn)
    window.addEventListener('scroll', handleWindowScroll, { passive: true })

    return () => {
      if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame)
      restoreTimers.splice(0).forEach((timer) => window.clearTimeout(timer))
      document.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('scroll', handleWindowScroll)
    }
  }, [enabled, rootRef])
}
