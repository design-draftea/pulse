import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import infoIcon from '../../assets/icon.svg'
import chevronRightIcon from '../../assets/iconChevronRight.svg'
import chevronUpIcon from '../../assets/iconChevronUp.svg'
import closeIcon from '../../assets/iconClose.svg'
import personalDataIcon from '../../assets/iconDados.svg'
import depositIcon from '../../assets/iconDeposito.svg'
import faqIcon from '../../assets/iconFaq.svg'
import privacyIcon from '../../assets/iconPrivacidade.svg'
import logoutIcon from '../../assets/iconSair.svg'
import withdrawIcon from '../../assets/iconSaque.svg'
import supportIcon from '../../assets/iconSuporte.svg'
import termsIcon from '../../assets/iconTermos.svg'
import { InfoModal } from '../InfoModal'
import {
  profileInfoById,
  type ProfileInfoId,
} from './profileInfoContent'
import './ProfileBottomSheet.css'

const SHEET_MOTION_MS = 300
const HEADER_DRAG_INTENT_PX = 8
const HEADER_CLOSE_THRESHOLD_PX = 48
const OVERLAY_BLUR_STYLE = {
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
} satisfies CSSProperties
const METRIC_COUNT_DURATION_MS = 900
const METRIC_UPDATE_DURATION_MS = 420

const balanceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const metricFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const netResultFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
})

export interface ProfileBottomSheetMetrics {
  availableBalanceCents: number
  portfolioTotalCents: number
  totalPurchasesCents: number
  openEntriesCents: number
  totalReceivedCents: number
  netResultCents: number
}

interface ProfileBottomSheetProps {
  isOpen: boolean
  metrics: ProfileBottomSheetMetrics
  onClose: () => void
}

interface HeaderDragState {
  captureTarget: HTMLElement
  pointerId: number
  startX: number
  startY: number
}

interface MenuSection {
  id: string
  title: string
  items: Array<{
    label: string
    icon: string
  }>
}

const menuSections: MenuSection[] = [
  {
    id: 'account',
    title: 'MI CUENTA',
    items: [{ label: 'Mis datos', icon: personalDataIcon }],
  },
  {
    id: 'support',
    title: 'SOPORTE',
    items: [
      { label: 'Soporte', icon: supportIcon },
      { label: 'Preguntas frecuentes', icon: faqIcon },
    ],
  },
  {
    id: 'about',
    title: 'ACERCA DE',
    items: [
      { label: 'Términos y condiciones', icon: termsIcon },
      { label: 'Aviso de privacidad', icon: privacyIcon },
    ],
  },
]

const formatBalance = (valueCents: number) => (
  balanceFormatter.format(valueCents / 100)
)

interface AnimatedCurrencyValueProps {
  className?: string
  delayMs?: number
  formatter: Intl.NumberFormat
  valueCents: number
}

function AnimatedCurrencyValue({
  className,
  delayMs = 0,
  formatter,
  valueCents,
}: AnimatedCurrencyValueProps) {
  const targetValueCents = Math.round(valueCents)
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  const initialValueCents = prefersReducedMotion ? targetValueCents : 0
  const currentValueRef = useRef(initialValueCents)
  const hasAnimatedRef = useRef(false)
  const [displayedValueCents, setDisplayedValueCents] = useState(initialValueCents)
  const [animationPhase, setAnimationPhase] = useState<
    'idle' | 'initial' | 'update'
  >('idle')
  const [canAnimate, setCanAnimate] = useState(
    delayMs === 0 || prefersReducedMotion,
  )

  useEffect(() => {
    if (canAnimate) return undefined

    const delayTimerId = window.setTimeout(() => setCanAnimate(true), delayMs)
    return () => window.clearTimeout(delayTimerId)
  }, [canAnimate, delayMs])

  useEffect(() => {
    if (!canAnimate) return undefined

    const startValueCents = currentValueRef.current
    let animationFrameId = 0

    if (startValueCents === targetValueCents) return undefined

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animationFrameId = window.requestAnimationFrame(() => {
        currentValueRef.current = targetValueCents
        setDisplayedValueCents(targetValueCents)
        setAnimationPhase('idle')
      })

      return () => window.cancelAnimationFrame(animationFrameId)
    }

    const nextAnimationPhase = hasAnimatedRef.current ? 'update' : 'initial'
    const animationDurationMs = hasAnimatedRef.current
      ? METRIC_UPDATE_DURATION_MS
      : METRIC_COUNT_DURATION_MS
    const startedAt = window.performance.now()
    let isFirstFrame = true

    hasAnimatedRef.current = true

    const animate = (frameTime: number) => {
      if (isFirstFrame) {
        setAnimationPhase(nextAnimationPhase)
        isFirstFrame = false
      }

      const progress = Math.min(
        1,
        (frameTime - startedAt) / animationDurationMs,
      )
      const easedProgress = 1 - (1 - progress) ** 4
      const nextValueCents = Math.round(
        startValueCents
          + (targetValueCents - startValueCents) * easedProgress,
      )

      currentValueRef.current = nextValueCents
      setDisplayedValueCents(nextValueCents)

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animate)
        return
      }

      currentValueRef.current = targetValueCents
      setDisplayedValueCents(targetValueCents)
      setAnimationPhase('idle')
    }

    animationFrameId = window.requestAnimationFrame(animate)

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [canAnimate, targetValueCents])

  return (
    <strong
      className={className}
      aria-label={formatter.format(targetValueCents / 100)}
      data-animating={animationPhase !== 'idle'}
      data-initial-animation={animationPhase === 'initial'}
      data-target-cents={targetValueCents}
    >
      <span aria-hidden="true">
        {formatter.format(displayedValueCents / 100)}
      </span>
    </strong>
  )
}

export function ProfileBottomSheet({
  isOpen,
  metrics,
  onClose,
}: ProfileBottomSheetProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isBalanceExpanded, setIsBalanceExpanded] = useState(true)
  const [activeInfoId, setActiveInfoId] = useState<ProfileInfoId | null>(null)
  const [isHeaderDragging, setIsHeaderDragging] = useState(false)
  const [isHeaderDragClosing, setIsHeaderDragClosing] = useState(false)
  const isClosingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const infoReturnFocusRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef<HeaderDragState | null>(null)
  const suppressHeaderClickRef = useRef(false)
  const overlayRef = useRef<HTMLButtonElement | null>(null)
  const sheetRef = useRef<HTMLElement | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const finishClose = useCallback(() => {
    const returnFocusTarget = returnFocusRef.current

    clearCloseTimer()
    setShouldRender(false)
    setIsClosing(false)
    isClosingRef.current = false
    setActiveInfoId(null)
    setIsHeaderDragging(false)
    setIsHeaderDragClosing(false)
    dragRef.current = null
    onClose()
    window.requestAnimationFrame(() => returnFocusTarget?.focus())
  }, [clearCloseTimer, onClose])

  const requestClose = useCallback((fromDrag = false) => {
    if (isClosingRef.current) return

    isClosingRef.current = true
    setIsClosing(true)
    if (fromDrag) setIsHeaderDragClosing(true)
    closeTimerRef.current = window.setTimeout(finishClose, SHEET_MOTION_MS)
  }, [finishClose])

  useEffect(() => {
    if (!isOpen) return undefined

    clearCloseTimer()
    isClosingRef.current = false
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    let focusFrame: number | null = null
    const openTimer = window.setTimeout(() => {
      setShouldRender(true)
      setIsClosing(false)
      setIsBalanceExpanded(true)
      setActiveInfoId(null)
      setIsHeaderDragging(false)
      setIsHeaderDragClosing(false)
      focusFrame = window.requestAnimationFrame(() => {
        sheetRef.current?.focus({ preventScroll: true })
      })
    }, 0)

    return () => {
      window.clearTimeout(openTimer)
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame)
    }
  }, [clearCloseTimer, isOpen])

  useEffect(() => {
    if (isOpen || !shouldRender) return undefined
    const closeFrame = window.requestAnimationFrame(() => requestClose())
    return () => window.cancelAnimationFrame(closeFrame)
  }, [isOpen, requestClose, shouldRender])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  useEffect(() => {
    if (!shouldRender) return undefined

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeInfoId === null) requestClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [activeInfoId, requestClose, shouldRender])

  const openInfoModal = useCallback((
    infoId: ProfileInfoId,
    trigger: HTMLElement,
  ) => {
    infoReturnFocusRef.current = trigger
    setActiveInfoId(infoId)
  }, [])

  const closeInfoModal = useCallback(() => {
    const returnFocusTarget = infoReturnFocusRef.current

    setActiveInfoId(null)
    window.requestAnimationFrame(() => returnFocusTarget?.focus())
  }, [])

  const handleHeaderPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (isClosing || isHeaderDragClosing) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button')) return

    suppressHeaderClickRef.current = false
    dragRef.current = {
      captureTarget: event.currentTarget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
    setIsHeaderDragging(true)
    sheetRef.current?.style.setProperty('--profile-sheet-drag-y', '0px')
    overlayRef.current?.style.setProperty('opacity', '1')

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is optional; the gesture can still end inside the header.
    }
  }, [isClosing, isHeaderDragClosing])

  const handleHeaderPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    const dragOffsetY = Math.max(0, deltaY)
    const sheetHeight = sheetRef.current?.getBoundingClientRect().height ?? window.innerHeight
    const dragProgress = Math.min(dragOffsetY / Math.max(1, sheetHeight), 1)

    sheetRef.current?.style.setProperty('--profile-sheet-drag-y', `${dragOffsetY}px`)
    overlayRef.current?.style.setProperty('opacity', String(1 - dragProgress))

    if (Math.hypot(deltaX, deltaY) >= HEADER_DRAG_INTENT_PX) {
      suppressHeaderClickRef.current = true
    }

    if (deltaY > 0) event.preventDefault()
  }, [])

  const finishHeaderDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    const shouldClose = deltaY >= HEADER_CLOSE_THRESHOLD_PX
      && deltaY > Math.abs(deltaX)

    if (drag.captureTarget.hasPointerCapture(event.pointerId)) {
      drag.captureTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = null

    if (suppressHeaderClickRef.current) {
      window.setTimeout(() => {
        suppressHeaderClickRef.current = false
      }, 0)
    }

    if (shouldClose) {
      overlayRef.current?.style.setProperty('opacity', '0')
      requestClose(true)
      return
    }

    setIsHeaderDragging(false)
    sheetRef.current?.style.setProperty('--profile-sheet-drag-y', '0px')
    overlayRef.current?.style.removeProperty('opacity')
  }, [requestClose])

  const cancelHeaderDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (drag.captureTarget.hasPointerCapture(event.pointerId)) {
      drag.captureTarget.releasePointerCapture(event.pointerId)
    }

    dragRef.current = null
    suppressHeaderClickRef.current = false
    setIsHeaderDragging(false)
    sheetRef.current?.style.setProperty('--profile-sheet-drag-y', '0px')
    overlayRef.current?.style.removeProperty('opacity')
  }, [])

  const handleHeaderClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressHeaderClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressHeaderClickRef.current = false
  }, [])

  if (!shouldRender) return null

  const metricCards: Array<{
    infoId: ProfileInfoId
    isNetResult?: boolean
    label: string
    value: number
  }> = [
    { infoId: 'totalPurchases', label: 'Compras totales', value: metrics.totalPurchasesCents },
    { infoId: 'openEntries', label: 'Entradas abiertas', value: metrics.openEntriesCents },
    { infoId: 'totalReceived', label: 'Total recibido', value: metrics.totalReceivedCents },
    { infoId: 'netResult', label: 'Resultado neto', value: metrics.netResultCents, isNetResult: true },
  ]
  const netResultTone = metrics.netResultCents > 0
    ? 'positive'
    : metrics.netResultCents < 0
      ? 'negative'
      : 'neutral'

  return createPortal(
    <div className="profile-sheet__container" data-node-id="383:18489">
      <button
        ref={overlayRef}
        className={`profile-sheet__overlay${isClosing ? ' profile-sheet__overlay--closing' : ''}`}
        style={OVERLAY_BLUR_STYLE}
        type="button"
        aria-label="Cerrar mi perfil"
        onClick={() => requestClose()}
      />

      <aside
        ref={sheetRef}
        className={[
          'profile-sheet',
          isClosing ? 'profile-sheet--closing' : '',
          isHeaderDragging ? 'profile-sheet--dragging' : '',
          isHeaderDragClosing ? 'profile-sheet--drag-closing' : '',
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-sheet-title"
        inert={activeInfoId !== null}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onPointerCancel={cancelHeaderDrag}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={finishHeaderDrag}
      >
        <header
          className="profile-sheet__header"
          onClickCapture={handleHeaderClickCapture}
          onPointerDown={handleHeaderPointerDown}
        >
          <span className="profile-sheet__header-spacer" aria-hidden="true" />
          <h2 id="profile-sheet-title">Mi perfil</h2>
          <button
            className="profile-sheet__close"
            type="button"
            aria-label="Cerrar mi perfil"
            onClick={() => requestClose()}
          >
            <img src={closeIcon} alt="" aria-hidden="true" />
          </button>
        </header>

        <div className="profile-sheet__content">
          <section
            className={`profile-sheet__balance${isBalanceExpanded ? ' profile-sheet__balance--expanded' : ''}`}
            aria-label="Resumen del saldo"
          >
            <button
              className="profile-sheet__balance-summary"
              type="button"
              aria-expanded={isBalanceExpanded}
              aria-controls="profile-sheet-balance-breakdown"
              onClick={() => setIsBalanceExpanded((current) => !current)}
            >
              <span className="profile-sheet__balance-heading">
                <strong>{formatBalance(metrics.availableBalanceCents)}</strong>
                <span>Disponible para jugar</span>
              </span>
              <span className="profile-sheet__balance-chevron" aria-hidden="true">
                <img src={chevronUpIcon} alt="" />
              </span>
            </button>

            <div
              className="profile-sheet__balance-breakdown"
              id="profile-sheet-balance-breakdown"
              aria-hidden={!isBalanceExpanded}
            >
              <span className="profile-sheet__balance-row">
                <button
                  className="profile-sheet__label-with-info profile-sheet__info-trigger"
                  type="button"
                  aria-haspopup="dialog"
                  aria-label="Más información sobre Saldo disponible"
                  onClick={(event) => openInfoModal('availableBalance', event.currentTarget)}
                >
                  Saldo disponible
                  <img src={infoIcon} alt="" aria-hidden="true" />
                </button>
                <strong>{formatBalance(metrics.availableBalanceCents)}</strong>
              </span>
              <span className="profile-sheet__balance-row">
                <button
                  className="profile-sheet__label-with-info profile-sheet__info-trigger"
                  type="button"
                  aria-haspopup="dialog"
                  aria-label="Más información sobre Portafolio total"
                  onClick={(event) => openInfoModal('portfolioTotal', event.currentTarget)}
                >
                  Portafolio total
                  <img src={infoIcon} alt="" aria-hidden="true" />
                </button>
                <AnimatedCurrencyValue
                  delayMs={80}
                  formatter={balanceFormatter}
                  valueCents={metrics.portfolioTotalCents}
                />
              </span>
            </div>

            <div className="profile-sheet__balance-actions" aria-label="Acciones de saldo no disponibles en el prototipo">
              <div className="profile-sheet__balance-action profile-sheet__balance-action--secondary" aria-hidden="true">
                <img src={withdrawIcon} alt="" />
                <span>Retirar</span>
              </div>
              <div className="profile-sheet__balance-action profile-sheet__balance-action--primary" aria-hidden="true">
                <img src={depositIcon} alt="" />
                <span>Depositar</span>
              </div>
            </div>
          </section>

          <div className="profile-sheet__metrics-scroll" aria-label="Métricas de la cuenta">
            <div className="profile-sheet__metrics">
              {metricCards.map((card, index) => (
                <article className="profile-sheet__metric" key={card.label}>
                  <button
                    className="profile-sheet__label-with-info profile-sheet__info-trigger"
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Más información sobre ${card.label}`}
                    onClick={(event) => openInfoModal(card.infoId, event.currentTarget)}
                  >
                    {card.label}
                    <img src={infoIcon} alt="" aria-hidden="true" />
                  </button>
                  <AnimatedCurrencyValue
                    className={card.isNetResult
                      ? `profile-sheet__metric-value profile-sheet__metric-value--${netResultTone}`
                      : 'profile-sheet__metric-value'}
                    delayMs={160 + index * 80}
                    formatter={card.isNetResult
                      ? netResultFormatter
                      : metricFormatter}
                    valueCents={card.value}
                  />
                </article>
              ))}
            </div>
          </div>

          <div className="profile-sheet__menu-groups">
            {menuSections.map((section) => (
              <section
                className="profile-sheet__menu-section"
                key={section.id}
                aria-labelledby={`profile-sheet-${section.id}`}
              >
                <h3 id={`profile-sheet-${section.id}`}>{section.title}</h3>
                <div className="profile-sheet__menu-items">
                  {section.items.map((item) => (
                    <div className="profile-sheet__menu-item" key={item.label}>
                      <span className="profile-sheet__menu-icon" aria-hidden="true">
                        <img src={item.icon} alt="" />
                      </span>
                      <span className="profile-sheet__menu-body">
                        <span>{item.label}</span>
                        <img src={chevronRightIcon} alt="" aria-hidden="true" />
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className="profile-sheet__footer" aria-label="Sesión y versión">
              <div className="profile-sheet__menu-item profile-sheet__menu-item--logout">
                <span className="profile-sheet__menu-icon" aria-hidden="true">
                  <img src={logoutIcon} alt="" />
                </span>
                <span className="profile-sheet__menu-body">
                  <span>Cerrar sesión</span>
                  <img src={chevronRightIcon} alt="" aria-hidden="true" />
                </span>
              </div>
              <p>
                www.draftea.mx operadora en México por Producciones Móviles S.A. de C.V., titular del permiso DGAJS/SCEVF/P-06/2005-TER en unión de Unocapali La Paz Operadora S.A. de C.V. de conformidad con los oficios DGJS/1580/2021 y DGJS/DCRCA/2420/2022. Juegos prohibidos para menores de edad, juegue responsablemente, no olvide que el principal propósito es la recreación, diversión y esparcimiento.
              </p>
              <p>VERSIÓN 2.4.5</p>
            </section>
          </div>
        </div>
      </aside>

      {activeInfoId ? (
        <InfoModal
          info={profileInfoById[activeInfoId]}
          onClose={closeInfoModal}
        />
      ) : null}
    </div>,
    document.body,
  )
}
