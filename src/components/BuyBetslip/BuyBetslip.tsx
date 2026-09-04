import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import iconChange from '../../assets/iconChange.svg'
import iconCheck from '../../assets/iconCheck.svg'
import iconChevronRight from '../../assets/iconChevronRight.svg'
import iconDelete from '../../assets/iconDelete.svg'
import iconDoubleChevronsUp from '../../assets/iconDoubleChevronsUp.svg'
import iconEdit from '../../assets/iconEdit.svg'
import iconLock from '../../assets/iconLock.svg'
import iconLoading from '../../assets/iconLoading.svg'
import quickAmountLight from '../../assets/quickAmountLight.svg'
import { usePresentedQuoteSnapshot } from '../../hooks/usePresentedQuotes'
import {
  type ExecutionQuote,
  type OutcomeMarketState,
} from '../../services/outcomeMarket'
import {
  validateQuoteProtection,
  type QuoteProtectionResult,
} from '../../services/quotePresentation'
import type { MarketSide } from '../MarketChoice/MarketChoice'
import './BuyBetslip.css'
import { QuickAmountEditorSheet } from './QuickAmountEditorSheet'

const SWIPE_COMPLETE_RATIO = 0.6
const SWIPE_COMPLETE_ANIMATION_MS = 180
const BUY_CONFIRM_LOADING_MS = 2000
const SWIPE_KNOB_WIDTH = 48
const SWIPE_TRACK_PADDING = 2
const SHEET_COLLAPSE_DISTANCE = 48
const SHEET_COLLAPSE_ANIMATION_MS = 360
const SHEET_DRAG_MAX_DISTANCE = 160
const SHEET_COLLAPSED_HEIGHT = 56
const CONTENT_FADE_OUT_MS = 110
const CONTENT_FADE_IN_MS = 170
const SHEET_EXIT_ANIMATION_MS = 280
type ContentTransitionPhase = 'idle' | 'out' | 'in'
type QuoteFeedback = 'requote' | 'unavailable' | null
const TEST_QUOTE_REPRICE_MODE = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('testQuoteReprice')
  : null
const dollarAmountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const dollarCentsFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const AMOUNT_MAX_DIGITS = 7
const DEFAULT_AMOUNT = 100

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.max(minimum, Math.min(value, maximum))
)

const formatAmount = (value: number) => dollarAmountFormatter.format(value)

// O teclado do monto acumula centavos, então o valor digitado sempre aparece
// com as duas casas decimais: `55555` é `$555.55`.
const formatTypedAmount = (value: number) => dollarCentsFormatter.format(value)

const toAmountDigits = (value: number) => String(Math.round(value * 100))

const formatAveragePrice = (quote: ExecutionQuote | null) => (
  quote?.complete ? `${Math.round(quote.averagePrice * 100)}¢` : '—'
)

const formatPotentialPayout = (quote: ExecutionQuote | null) => (
  quote?.complete ? dollarCentsFormatter.format(quote.participations) : '—'
)

const formatPercentage = (price: number | null) => (
  price === null ? '—' : `${Math.round(price * 100)}%`
)

const formatParticipations = (value: number) => participationFormatter.format(value)

const withAdverseTestMove = (
  quote: ExecutionQuote | null,
): ExecutionQuote | null => {
  if (!quote?.complete) return quote

  const averagePrice = quote.operation === 'buy'
    ? Math.min(0.99, quote.averagePrice + 0.02)
    : Math.max(0.01, quote.averagePrice - 0.02)

  return quote.operation === 'buy'
    ? {
        ...quote,
        averagePrice,
        participations: quote.grossValue / averagePrice,
      }
    : {
        ...quote,
        averagePrice,
        grossValue: quote.participations * averagePrice,
      }
}

interface SwipeToBuyProps {
  amount: number
  disabled?: boolean
  mode?: 'buy' | 'sell'
  formattedValue?: string
  unavailableLabel?: string
  onLock?: () => boolean
  onLoadingChange?: (isLoading: boolean) => void
  onComplete: () => void
}

function SwipeToBuy({
  amount,
  disabled = false,
  mode = 'buy',
  formattedValue,
  unavailableLabel,
  onLock,
  onLoadingChange,
  onComplete,
}: SwipeToBuyProps) {
  const trackRef = useRef<HTMLButtonElement>(null)
  const dragStartXRef = useRef(0)
  const dragStartProgressRef = useRef(0)
  const progressRef = useRef(0)
  const completeTimerRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isLoadingVisible, setIsLoadingVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastAmount, setLastAmount] = useState(amount)

  // Substitui o remount por `key`: um controle meio arrastado não pode valer
  // para um valor novo, mas recriar o componente a cada dígito descartava
  // progresso, arrasto e confirmação junto. O ajuste acontece no render, e não
  // num efeito, para não encadear uma renderização extra.
  if (amount !== lastAmount) {
    setLastAmount(amount)
    setProgress(0)
  }
  const isAmountEmpty = amount <= 0
  const isQuoteUnavailable = disabled && !isAmountEmpty
  const isInteractionDisabled = disabled || isCompleting || isLoadingVisible
  const swipeLabel = isAmountEmpty
    ? mode === 'sell'
      ? 'No tienes participaciones para vender'
      : 'Ingresa un monto para comprar'
    : isQuoteUnavailable
      ? unavailableLabel ?? 'Cotización no disponible'
    : mode === 'sell'
      ? `Desliza para vender: ${formattedValue ?? formatParticipations(amount)}`
      : `Desliza para comprar por: ${formatTypedAmount(amount)}`

  // O preenchimento é publicado como fração e convertido em largura pelo CSS,
  // contra a medida viva do trilho. Uma largura em pixels calculada aqui ficava
  // presa à medição feita na montagem: o `key` remonta este componente a cada
  // mudança de monto e a folha ainda estava em transição, então o valor
  // congelado divergia do trilho e o preenchimento parava antes do fim.
  // As medidas do trilho são publicadas daqui para o CSS, e não declaradas nos
  // dois lados: a matemática do arrasto usa as mesmas constantes, então uma
  // alteração só no CSS voltaria a divergir do gesto.
  const swipeStyle = {
    '--buy-swipe-knob': `${SWIPE_KNOB_WIDTH}px`,
    '--buy-swipe-inset': `${SWIPE_TRACK_PADDING}px`,
    '--buy-swipe-progress': isCompleting ? 1 : progress,
  } as CSSProperties

  const setVisualProgress = useCallback((nextProgress: number) => {
    const nextValue = clamp(nextProgress, 0, 1)

    progressRef.current = nextValue
    setProgress(nextValue)
  }, [])

  const getMaxTravel = useCallback(() => {
    const width = trackRef.current?.getBoundingClientRect().width ?? 0
    const availableWidth = Math.max(
      SWIPE_KNOB_WIDTH,
      width - SWIPE_TRACK_PADDING * 2,
    )

    return Math.max(1, availableWidth - SWIPE_KNOB_WIDTH)
  }, [])

  const completeSwipe = useCallback(() => {
    if (isInteractionDisabled || amount <= 0) return

    if (onLock && !onLock()) {
      setIsDragging(false)
      setVisualProgress(0)
      return
    }
    setIsDragging(false)
    setIsCompleting(true)
    setVisualProgress(1)
    completeTimerRef.current = window.setTimeout(() => {
      setIsLoadingVisible(true)
      completeTimerRef.current = window.setTimeout(() => {
        completeTimerRef.current = null
        setIsLoadingVisible(false)
        setIsCompleting(false)
        onComplete()
      }, BUY_CONFIRM_LOADING_MS)
    }, SWIPE_COMPLETE_ANIMATION_MS)
  }, [amount, isInteractionDisabled, onComplete, onLock, setVisualProgress])

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => () => {
    if (completeTimerRef.current !== null) {
      window.clearTimeout(completeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    onLoadingChange?.(isLoadingVisible)

    return () => {
      if (isLoadingVisible) onLoadingChange?.(false)
    }
  }, [isLoadingVisible, onLoadingChange])

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isInteractionDisabled || amount <= 0) return

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragStartXRef.current = event.clientX
    dragStartProgressRef.current = progressRef.current
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isDragging || isInteractionDisabled) return

    event.preventDefault()
    const distance = event.clientX - dragStartXRef.current
    setVisualProgress(dragStartProgressRef.current + distance / getMaxTravel())
  }

  const finishPointerGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return

    event.preventDefault()
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    setIsDragging(false)

    const currentInnerWidth = Math.max(
      SWIPE_KNOB_WIDTH,
      event.currentTarget.getBoundingClientRect().width - SWIPE_TRACK_PADDING * 2,
    )
    const currentFillWidth = SWIPE_KNOB_WIDTH
      + (currentInnerWidth - SWIPE_KNOB_WIDTH) * progressRef.current

    if (currentFillWidth / currentInnerWidth >= SWIPE_COMPLETE_RATIO) {
      completeSwipe()
      return
    }

    setVisualProgress(0)
  }

  const cancelPointerGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    setIsDragging(false)
    setVisualProgress(0)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['Enter', ' '].includes(event.key)) return

    event.preventDefault()
    completeSwipe()
  }

  return (
    <button
      className={`buy-betslip__swipe${isAmountEmpty || isQuoteUnavailable ? ' buy-betslip__swipe--empty' : ''}${isDragging ? ' buy-betslip__swipe--dragging' : ''}${isCompleting ? ' buy-betslip__swipe--completing' : ''}${isLoadingVisible ? ' buy-betslip__swipe--loading' : ''}`}
      type="button"
      ref={trackRef}
      style={swipeStyle}
      aria-label={swipeLabel}
      aria-busy={isLoadingVisible}
      disabled={isAmountEmpty || isInteractionDisabled}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerGesture}
      onPointerCancel={cancelPointerGesture}
    >
      <span className="buy-betslip__swipe-label">
        {swipeLabel}
      </span>
      <span className="buy-betslip__swipe-fill" aria-hidden="true">
        <img src={iconChevronRight} alt="" />
      </span>
      <span className="buy-betslip__swipe-loading" aria-hidden="true">
        <img src={iconLoading} alt="" />
        <span>
          {mode === 'sell' ? 'Preparando tu venta' : 'Preparando tu compra'}
        </span>
      </span>
    </button>
  )
}

export interface PurchaseSuccessDetails {
  operation: 'buy'
  side: MarketSide
  amount: number
  potentialPayout: number
  participations: number
  averagePrice: number
}

export interface SaleSuccessDetails {
  operation: 'sell'
  side: MarketSide
  amountReceived: number
  participations: number
  averagePrice: number
}

export type BetslipSuccessDetails =
  | PurchaseSuccessDetails
  | SaleSuccessDetails

export type BetslipOperationMode = 'buy' | 'sell'

interface BuyBetslipProps {
  market: OutcomeMarketState
  side: MarketSide
  initialOperationMode?: BetslipOperationMode
  onSideChange: (side: MarketSide) => void
  availableBalanceCents: number
  participations: Record<MarketSide, number>
  onOcclusionHeightChange?: (height: number) => void
  onPurchaseLoadingChange?: (isLoading: boolean) => void
  onPurchaseExecute?: (details: PurchaseSuccessDetails) => boolean
  onSaleExecute?: (details: SaleSuccessDetails) => boolean
  onSuccess?: (details: BetslipSuccessDetails) => void
}

export function BuyBetslip({
  market,
  side,
  initialOperationMode = 'buy',
  onSideChange,
  availableBalanceCents,
  participations,
  onOcclusionHeightChange,
  onPurchaseLoadingChange,
  onPurchaseExecute,
  onSaleExecute,
  onSuccess,
}: BuyBetslipProps) {
  const panelRef = useRef<HTMLElement>(null)
  const sheetDragRef = useRef<{
    captureTarget: HTMLButtonElement
    maxDragY: number
    pointerId: number
    startY: number
  } | null>(null)
  const collapseTimerRef = useRef<number | null>(null)
  const quickAmountTimerRef = useRef<number | null>(null)
  const contentSwapTimerRef = useRef<number | null>(null)
  const contentSettleTimerRef = useRef<number | null>(null)
  const quoteSwapTimerRef = useRef<number | null>(null)
  const quoteSettleTimerRef = useRef<number | null>(null)
  const contentTransitionActiveRef = useRef(false)
  const quoteTransitionActiveRef = useRef(false)
  const lockedQuoteRef = useRef<ExecutionQuote | null>(null)
  const lockedSuccessDetailsRef = useRef<BetslipSuccessDetails | null>(null)
  const forcedRequoteKeyRef = useRef<string | null>(null)
  const amountBeforeEditRef = useRef(toAmountDigits(DEFAULT_AMOUNT))
  const dragYRef = useRef(0)
  const sheetExpandedHeightRef = useRef(SHEET_COLLAPSED_HEIGHT)
  const [amount, setAmount] = useState(toAmountDigits(DEFAULT_AMOUNT))
  const [operationMode, setOperationMode] = useState<BetslipOperationMode>(
    initialOperationMode,
  )
  const [amountMode, setAmountMode] = useState<'custom' | 'one-tap'>('custom')
  const [quickAmounts, setQuickAmounts] = useState([10, 25, 50])
  const [sellParticipation, setSellParticipation] = useState(
    participations[side],
  )
  const [sellDraft, setSellDraft] = useState<number | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [isQuickAmountEditorOpen, setIsQuickAmountEditorOpen] = useState(false)
  const [quickAmountLoadingIndex, setQuickAmountLoadingIndex] = useState<number | null>(null)
  const [sideArrowAnimation, setSideArrowAnimation] = useState<{
    side: MarketSide
    id: number
  } | null>(null)
  const [contentTransitionPhase, setContentTransitionPhase] = useState<ContentTransitionPhase>('idle')
  const [quoteTransitionPhase, setQuoteTransitionPhase] = useState<ContentTransitionPhase>('idle')
  const [quoteFeedback, setQuoteFeedback] = useState<QuoteFeedback>(null)
  const [lockedSellParticipation, setLockedSellParticipation] = useState<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [sheetStageHeight, setSheetStageHeight] = useState<number | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const exitTimerRef = useRef<number | null>(null)
  const [isDraggingSheet, setIsDraggingSheet] = useState(false)
  const numericAmountCents = Number(amount || 0)
  const numericAmount = numericAmountCents / 100
  const isSellMode = operationMode === 'sell'
  const isContentTransitioning = contentTransitionPhase !== 'idle'
  const isQuoteTransitioning = quoteTransitionPhase !== 'idle'
  const isUiTransitioning = isContentTransitioning || isQuoteTransitioning
  const isInsufficientBalance = !isSellMode
    && numericAmountCents > availableBalanceCents
  const isSellDraftEmpty = isSellMode && isKeyboardOpen && sellDraft === null
  const activeSellParticipation = lockedSellParticipation ?? Math.min(
    sellDraft ?? sellParticipation,
    participations[side],
  )
  const presentedQuickAmounts = !isSellMode && amountMode === 'one-tap'
    ? quickAmounts
    : []
  const {
    publishNow: publishPresentedQuoteNow,
    snapshot: presentedQuote,
  } = usePresentedQuoteSnapshot({
    market,
    side,
    operation: operationMode,
    requestedValue: isSellMode ? activeSellParticipation : numericAmount,
    quickAmounts: presentedQuickAmounts,
  })
  const activeQuote = presentedQuote.quote
  const isActiveQuoteComplete = presentedQuote.percentages[side] !== null
    && activeQuote?.complete === true
    && !isInsufficientBalance
  const potentialPayout = formatPotentialPayout(
    isSellMode ? null : activeQuote,
  )
  const averagePrice = formatAveragePrice(activeQuote)
  const selectedPercentage = formatPercentage(presentedQuote.percentages[side])
  const amountToReceive = isSellMode && activeQuote?.complete
    ? dollarCentsFormatter.format(activeQuote.grossValue)
    : '—'
  const quoteFeedbackText = quoteFeedback === 'requote'
    ? 'El precio cambió. Revisa la nueva cotización.'
    : quoteFeedback === 'unavailable'
      ? 'Cotización no disponible'
      : ''
  const collapseProgress = isCollapsed
    ? 1
    : clamp(dragY / SHEET_DRAG_MAX_DISTANCE, 0, 1)
  const expandedOpacity = clamp(1 - collapseProgress * 1.42, 0, 1)
  const summaryOpacity = clamp((collapseProgress - 0.28) / 0.72, 0, 1)
  const panelStyle = {
    '--buy-betslip-collapse-progress': collapseProgress,
    '--buy-betslip-expanded-opacity': expandedOpacity,
    '--buy-betslip-expanded-y': `${collapseProgress * 8}px`,
    '--buy-betslip-expanded-scale': 1 - collapseProgress * 0.025,
    '--buy-betslip-summary-opacity': summaryOpacity,
    '--buy-betslip-summary-y': `${(1 - collapseProgress) * 12}px`,
    '--buy-betslip-summary-scale': 0.97 + collapseProgress * 0.03,
    '--buy-betslip-surface-radius': `${20 + collapseProgress * 36}px`,
    ...(sheetStageHeight === null
      ? {}
      : { '--buy-betslip-stage-height': `${sheetStageHeight}px` }),
  } as CSSProperties

  const clearQuoteFeedback = () => setQuoteFeedback(null)

  const maybeApplyForcedRequote = (
    quote: ExecutionQuote | null,
    operation: 'buy' | 'sell',
  ) => {
    const shouldForce = TEST_QUOTE_REPRICE_MODE === operation
      || TEST_QUOTE_REPRICE_MODE === 'both'
    const forceKey = `${market.roundSlug}:${operation}`

    if (
      !shouldForce
      || !quote?.complete
      || forcedRequoteKeyRef.current === forceKey
    ) return quote

    forcedRequoteKeyRef.current = forceKey
    return withAdverseTestMove(quote)
  }

  const protectQuote = (
    displayedQuote: ExecutionQuote | null,
    currentQuote: ExecutionQuote | null,
    quickIndex?: number,
  ): QuoteProtectionResult => {
    const guardedCurrentQuote = maybeApplyForcedRequote(
      currentQuote,
      displayedQuote?.operation ?? operationMode,
    )
    const result = validateQuoteProtection({
      currentQuote: guardedCurrentQuote,
      currentRoundSlug: market.roundSlug,
      presentedQuote: displayedQuote,
      presentedRoundSlug: presentedQuote.roundSlug,
    })

    if (result.status === 'accepted') {
      lockedQuoteRef.current = result.quote
      setQuoteFeedback(null)
      return result
    }

    lockedQuoteRef.current = null
    setQuoteFeedback(result.status)
    if (quickIndex === undefined) {
      publishPresentedQuoteNow({ quote: result.quote })
    } else {
      publishPresentedQuoteNow({
        quickQuote: { index: quickIndex, quote: result.quote },
      })
    }

    return result
  }

  const openKeyboard = () => {
    clearQuoteFeedback()
    if (!isKeyboardOpen) {
      amountBeforeEditRef.current = amount
    }
    setAmountMode('custom')
    setAmount('')
    setIsKeyboardOpen(true)
  }

  const finishAmountEditing = () => {
    setAmount((current) => current || amountBeforeEditRef.current)
    setIsKeyboardOpen(false)
  }

  const openSellKeyboard = () => {
    clearQuoteFeedback()
    setSellDraft(null)
    setIsKeyboardOpen(true)
  }

  const transitionContent = (commit: () => void) => {
    if (contentTransitionActiveRef.current || quoteTransitionActiveRef.current) {
      return false
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commit()
      return true
    }

    contentTransitionActiveRef.current = true
    setContentTransitionPhase('out')
    contentSwapTimerRef.current = window.setTimeout(() => {
      contentSwapTimerRef.current = null
      commit()
      setContentTransitionPhase('in')
      contentSettleTimerRef.current = window.setTimeout(() => {
        contentSettleTimerRef.current = null
        contentTransitionActiveRef.current = false
        setContentTransitionPhase('idle')
      }, CONTENT_FADE_IN_MS)
    }, CONTENT_FADE_OUT_MS)

    return true
  }

  const transitionQuote = (commit: () => void) => {
    if (contentTransitionActiveRef.current || quoteTransitionActiveRef.current) {
      return false
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commit()
      return true
    }

    quoteTransitionActiveRef.current = true
    setQuoteTransitionPhase('out')
    quoteSwapTimerRef.current = window.setTimeout(() => {
      quoteSwapTimerRef.current = null
      commit()
      setQuoteTransitionPhase('in')
      quoteSettleTimerRef.current = window.setTimeout(() => {
        quoteSettleTimerRef.current = null
        quoteTransitionActiveRef.current = false
        setQuoteTransitionPhase('idle')
      }, CONTENT_FADE_IN_MS)
    }, CONTENT_FADE_OUT_MS)

    return true
  }

  const selectOperationMode = (mode: 'buy' | 'sell') => {
    if (mode === operationMode) return

    transitionContent(() => {
      clearQuoteFeedback()
      setOperationMode(mode)
      setIsCollapsed(false)
      setIsKeyboardOpen(false)
      setIsQuickAmountEditorOpen(false)
      setSellDraft(null)
      setDragY(0)
      setSheetStageHeight(null)

      if (mode === 'sell') {
        setSellParticipation(participations[side])
      }
    })
  }

  const toggleAmountMode = () => {
    const nextAmountMode = amountMode === 'custom' ? 'one-tap' : 'custom'

    transitionContent(() => {
      clearQuoteFeedback()
      setIsKeyboardOpen(false)
      setAmountMode(nextAmountMode)
    })
  }

  const applySideSelection = (option: MarketSide) => {
    clearQuoteFeedback()
    setIsCollapsed(false)
    setIsKeyboardOpen(false)
    setSellDraft(null)
    setDragY(0)
    setSheetStageHeight(null)
    if (isSellMode) {
      setSellParticipation(participations[option])
    }
    onSideChange(option)
  }

  const selectMarketSide = (option: MarketSide) => {
    if (isUiTransitioning) return

    setSideArrowAnimation((current) => ({
      side: option,
      id: (current?.id ?? 0) + 1,
    }))

    if (option === side) {
      applySideSelection(option)
      return
    }

    transitionQuote(() => applySideSelection(option))
  }

  const beginBuyExecution = (
    purchaseAmount: number,
    quote: ExecutionQuote | null,
  ) => {
    if (!quote?.complete || quote.operation !== 'buy' || quote.side !== side) {
      return false
    }

    const details: PurchaseSuccessDetails = {
      operation: 'buy',
      side,
      amount: purchaseAmount,
      potentialPayout: quote.participations,
      participations: quote.participations,
      averagePrice: quote.averagePrice,
    }
    const wasAccepted = onPurchaseExecute?.(details) ?? true

    if (!wasAccepted) {
      lockedQuoteRef.current = null
      lockedSuccessDetailsRef.current = null
      setLockedSellParticipation(null)
      return false
    }

    lockedQuoteRef.current = quote
    lockedSuccessDetailsRef.current = details
    setLockedSellParticipation(null)
    return true
  }

  const buyQuickAmount = (quickAmount: number, index: number) => {
    if (quickAmountTimerRef.current !== null) return
    if (Math.round(quickAmount * 100) > availableBalanceCents) return
    const displayedQuote = presentedQuote.quickQuotes[index] ?? null
    const currentQuote = market.quoteBuy(side, quickAmount)
    const protection = protectQuote(displayedQuote, currentQuote, index)
    if (protection.status !== 'accepted') return
    const quote = protection.quote
    if (!beginBuyExecution(quickAmount, quote)) return

    setAmount(toAmountDigits(quickAmount))
    setIsKeyboardOpen(false)
    setQuickAmountLoadingIndex(index)
    onPurchaseLoadingChange?.(true)

    quickAmountTimerRef.current = window.setTimeout(() => {
      quickAmountTimerRef.current = null
      setQuickAmountLoadingIndex(null)
      onPurchaseLoadingChange?.(false)
      finishSuccessfulExecution()
    }, BUY_CONFIRM_LOADING_MS)
  }

  const openQuickAmountEditor = () => {
    clearQuoteFeedback()
    setIsKeyboardOpen(false)
    setIsQuickAmountEditorOpen(true)
  }

  const handleDigit = (digit: string) => {
    clearQuoteFeedback()
    setAmount((current) => {
      const next = `${current}${digit}`.replace(/^0+/, '')
      if (next.length > AMOUNT_MAX_DIGITS) return current
      return next
    })
  }

  const handleDelete = () => {
    clearQuoteFeedback()
    setAmount((current) => current.slice(0, -1))
  }

  const selectSellPercentage = (percentage: number) => {
    clearQuoteFeedback()
    setSellDraft(participations[side] * percentage)
  }

  const finishSellEditing = () => {
    if (sellDraft !== null) {
      setSellParticipation(sellDraft)
    }

    setSellDraft(null)
    setIsKeyboardOpen(false)
  }

  const beginSellExecution = (quote: ExecutionQuote | null) => {
    if (!quote?.complete || quote.operation !== 'sell' || quote.side !== side) {
      return false
    }

    const details: SaleSuccessDetails = {
      operation: 'sell',
      side,
      amountReceived: quote.grossValue,
      participations: quote.participations,
      averagePrice: quote.averagePrice,
    }
    const wasAccepted = onSaleExecute?.(details) ?? true

    if (!wasAccepted) {
      lockedQuoteRef.current = null
      lockedSuccessDetailsRef.current = null
      setLockedSellParticipation(null)
      return false
    }

    lockedQuoteRef.current = quote
    lockedSuccessDetailsRef.current = details
    setLockedSellParticipation(quote.requestedValue)
    return true
  }

  const finishSuccessfulExecution = () => {
    const details = lockedSuccessDetailsRef.current
    const quote = lockedQuoteRef.current
    if (!details || !quote?.complete) return

    lockedQuoteRef.current = null
    lockedSuccessDetailsRef.current = null
    setLockedSellParticipation(null)

    // `onSuccess` desmonta o betslip, então ele é adiado até o fim da saída
    // para a folha descer em vez de sumir de uma vez. Sem movimento, entrega
    // imediatamente e mantém o comportamento anterior.
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (prefersReducedMotion) {
      onSuccess?.(details)
    } else {
      setIsClosing(true)
      exitTimerRef.current = window.setTimeout(() => {
        exitTimerRef.current = null
        onSuccess?.(details)
      }, SHEET_EXIT_ANIMATION_MS)
    }

    if (details.operation === 'buy') {
      setAmount(toAmountDigits(details.amount))
      setIsKeyboardOpen(false)
      setIsCollapsed(true)
      return
    }

    const remaining = Math.max(
      0,
      participations[side] - quote.participations,
    )
    setSellParticipation(remaining)
    setSellDraft(null)
    setIsKeyboardOpen(false)
  }

  const completeBuy = () => finishSuccessfulExecution()

  const completeSell = () => finishSuccessfulExecution()

  useEffect(() => () => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
    }
  }, [])

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current === null) return

    window.clearTimeout(collapseTimerRef.current)
    collapseTimerRef.current = null
  }, [])

  const updateSheetDrag = useCallback((pointerId: number, clientY: number) => {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== pointerId) return false

    const nextDragY = clamp(
      clientY - drag.startY,
      0,
      SHEET_DRAG_MAX_DISTANCE,
    )
    const expandedHeight = sheetExpandedHeightRef.current
    const progress = nextDragY / SHEET_DRAG_MAX_DISTANCE

    drag.maxDragY = Math.max(drag.maxDragY, nextDragY)
    dragYRef.current = nextDragY
    setDragY(nextDragY)
    setSheetStageHeight(
      expandedHeight
        - (expandedHeight - SHEET_COLLAPSED_HEIGHT) * progress,
    )

    return true
  }, [setDragY, setSheetStageHeight])

  const resetSheetDrag = useCallback((pointerId: number) => {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== pointerId) return

    sheetDragRef.current = null
    if (drag.captureTarget.hasPointerCapture?.(pointerId)) {
      try {
        drag.captureTarget.releasePointerCapture(pointerId)
      } catch {
        // The browser may have already released capture during cancellation.
      }
    }

    const expandedHeight = sheetExpandedHeightRef.current

    dragYRef.current = 0
    setIsDraggingSheet(false)
    setDragY(0)
    setSheetStageHeight(expandedHeight)
    clearCollapseTimer()
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null
      setSheetStageHeight(null)
    }, SHEET_COLLAPSE_ANIMATION_MS)
  }, [
    clearCollapseTimer,
    setDragY,
    setIsDraggingSheet,
    setSheetStageHeight,
  ])

  const finishSheetDrag = useCallback((
    pointerId: number,
    clientY: number,
    allowTapToCollapse = true,
  ) => {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== pointerId) return

    const finalDragY = clamp(
      clientY - drag.startY,
      0,
      SHEET_DRAG_MAX_DISTANCE,
    )
    const shouldCollapse = (allowTapToCollapse && drag.maxDragY < 6)
      || finalDragY >= SHEET_COLLAPSE_DISTANCE

    sheetDragRef.current = null
    if (drag.captureTarget.hasPointerCapture?.(pointerId)) {
      try {
        drag.captureTarget.releasePointerCapture(pointerId)
      } catch {
        // The pointer may already be released when the window fallback runs.
      }
    }

    dragYRef.current = finalDragY
    setDragY(finalDragY)
    setIsDraggingSheet(false)

    if (!shouldCollapse) {
      dragYRef.current = 0
      setDragY(0)
      setSheetStageHeight(sheetExpandedHeightRef.current)
      clearCollapseTimer()
      collapseTimerRef.current = window.setTimeout(() => {
        collapseTimerRef.current = null
        setSheetStageHeight(null)
      }, SHEET_COLLAPSE_ANIMATION_MS)
      return
    }

    setIsKeyboardOpen(false)
    setSellDraft(null)
    setIsCollapsed(true)
    setSheetStageHeight(SHEET_COLLAPSED_HEIGHT)
    clearCollapseTimer()
    collapseTimerRef.current = window.setTimeout(() => {
      collapseTimerRef.current = null
      dragYRef.current = 0
      setDragY(0)
      setSheetStageHeight(null)
    }, SHEET_COLLAPSE_ANIMATION_MS)
  }, [
    clearCollapseTimer,
    setDragY,
    setIsCollapsed,
    setIsDraggingSheet,
    setIsKeyboardOpen,
    setSellDraft,
    setSheetStageHeight,
  ])

  const handleSheetPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()
    clearCollapseTimer()
    sheetDragRef.current = {
      captureTarget: event.currentTarget,
      maxDragY: 0,
      pointerId: event.pointerId,
      startY: event.clientY,
    }
    sheetExpandedHeightRef.current = panelRef.current
      ?.querySelector<HTMLElement>('.buy-betslip__stage')
      ?.getBoundingClientRect().height ?? SHEET_COLLAPSED_HEIGHT
    dragYRef.current = 0
    setDragY(0)
    setSheetStageHeight(sheetExpandedHeightRef.current)
    setIsDraggingSheet(true)

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Window listeners below keep the gesture working without capture.
    }
  }

  const handleSheetPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (updateSheetDrag(event.pointerId, event.clientY)) {
      event.preventDefault()
    }
  }

  const finishSheetGesture = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    finishSheetDrag(event.pointerId, event.clientY)
  }

  const cancelSheetGesture = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    resetSheetDrag(event.pointerId)
  }

  const handleLostSheetPointerCapture = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const drag = sheetDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    if (dragYRef.current >= SHEET_COLLAPSE_DISTANCE) {
      finishSheetDrag(
        event.pointerId,
        drag.startY + dragYRef.current,
        false,
      )
      return
    }

    resetSheetDrag(event.pointerId)
  }

  useEffect(() => {
    if (!isDraggingSheet) return undefined

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (updateSheetDrag(event.pointerId, event.clientY)) {
        event.preventDefault()
      }
    }
    const handleWindowPointerUp = (event: PointerEvent) => {
      finishSheetDrag(event.pointerId, event.clientY)
    }
    const handleWindowPointerCancel = (event: PointerEvent) => {
      resetSheetDrag(event.pointerId)
    }

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    })
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerCancel)

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerCancel)
    }
  }, [finishSheetDrag, isDraggingSheet, resetSheetDrag, updateSheetDrag])

  useEffect(() => () => clearCollapseTimer(), [clearCollapseTimer])

  useEffect(() => () => {
    if (quickAmountTimerRef.current === null) return

    window.clearTimeout(quickAmountTimerRef.current)
    quickAmountTimerRef.current = null
    onPurchaseLoadingChange?.(false)
  }, [onPurchaseLoadingChange])

  useEffect(() => () => {
    const timers = [
      contentSwapTimerRef,
      contentSettleTimerRef,
      quoteSwapTimerRef,
      quoteSettleTimerRef,
    ]

    timers.forEach((timerRef) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    })
    contentTransitionActiveRef.current = false
    quoteTransitionActiveRef.current = false
  }, [])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel || !onOcclusionHeightChange) return undefined

    const updateOcclusionHeight = () => {
      const panelTop = panel.getBoundingClientRect().top
      onOcclusionHeightChange(Math.max(0, Math.ceil(window.innerHeight - panelTop)))
    }

    updateOcclusionHeight()

    const resizeObserver = new ResizeObserver(updateOcclusionHeight)
    resizeObserver.observe(panel)
    window.addEventListener('resize', updateOcclusionHeight)
    window.visualViewport?.addEventListener('resize', updateOcclusionHeight)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateOcclusionHeight)
      window.visualViewport?.removeEventListener('resize', updateOcclusionHeight)
    }
  }, [onOcclusionHeightChange])

  const panelClassName = [
    'buy-betslip',
    isCollapsed ? 'buy-betslip--collapsed' : '',
    isKeyboardOpen ? 'buy-betslip--keyboard' : '',
    isSellMode ? 'buy-betslip--sell' : '',
    !isSellMode && amountMode === 'one-tap' ? 'buy-betslip--one-tap' : '',
    isDraggingSheet ? 'buy-betslip--dragging' : '',
    isClosing ? 'buy-betslip--closing' : '',
  ].filter(Boolean).join(' ')

  return (
    <section
      ref={panelRef}
      className={panelClassName}
      style={panelStyle}
      aria-label={isSellMode ? 'Venta de participaciones' : 'Compra de participaciones'}
      data-node-id={isCollapsed
        ? '244:4222'
        : isSellMode
          ? isKeyboardOpen
            ? '247:6539'
            : '247:6281'
          : amountMode === 'one-tap'
          ? '247:5101'
          : isKeyboardOpen
            ? '244:3941'
            : '244:3684'}
    >
      <div className="buy-betslip__stage">
        <div
          className="buy-betslip__expanded"
          aria-hidden={isCollapsed}
          inert={isCollapsed ? true : undefined}
        >
          <button
            className="buy-betslip__handle"
            type="button"
            aria-label={`Contraer ${isSellMode ? 'venta' : 'compra'}`}
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={finishSheetGesture}
            onPointerCancel={cancelSheetGesture}
            onLostPointerCapture={handleLostSheetPointerCapture}
          >
            <span />
          </button>

          <div className="buy-betslip__topbar">
            <div
              className={`buy-betslip__mode-pills${isSellMode ? ' buy-betslip__mode-pills--sell' : ''}`}
              aria-label="Tipo de operación"
            >
              <button
                className={`buy-betslip__pill${!isSellMode ? ' buy-betslip__pill--active' : ''}`}
                type="button"
                aria-pressed={!isSellMode}
                disabled={isUiTransitioning}
                onClick={() => selectOperationMode('buy')}
              >
                Comprar
              </button>
              <button
                className={`buy-betslip__pill${isSellMode ? ' buy-betslip__pill--active' : ''}`}
                type="button"
                aria-pressed={isSellMode}
                disabled={isUiTransitioning}
                onClick={() => selectOperationMode('sell')}
              >
                Vender
              </button>
            </div>
            <button
              className={`buy-betslip__free-amount${isSellMode ? ' buy-betslip__free-amount--hidden' : ''}`}
              type="button"
              aria-hidden={isSellMode}
              disabled={isSellMode || isUiTransitioning}
              tabIndex={isSellMode ? -1 : 0}
              onClick={toggleAmountMode}
            >
              <span
                className={`buy-betslip__free-amount-label buy-betslip__free-amount-label--${contentTransitionPhase}`}
                key={amountMode}
              >
                {amountMode === 'one-tap' ? 'Un toque' : 'Monto libre'}
              </span>
              <img src={iconChange} alt="" aria-hidden="true" />
            </button>
          </div>

          <div
            className={`buy-betslip__mode-content buy-betslip__mode-content--${contentTransitionPhase}`}
            key={`${operationMode}-${amountMode}`}
            aria-busy={isUiTransitioning}
            inert={isUiTransitioning ? true : undefined}
          >
          <div className="buy-betslip__side-wrap">
            <div className={`buy-betslip__side-control buy-betslip__side-control--${side}`}>
              {(['up', 'down'] as const).map((option) => {
                const isSelected = option === side
                const isUnavailable = presentedQuote.percentages[option] === null
                const shouldAnimateArrow = sideArrowAnimation?.side === option

                return (
                  <button
                    className={`buy-betslip__side buy-betslip__side--${option}${isUnavailable ? ' buy-betslip__side--locked' : ''}${isSelected ? ' buy-betslip__side--selected' : ''}`}
                    type="button"
                    aria-pressed={isSelected}
                    aria-disabled={isUnavailable || isUiTransitioning}
                    disabled={isUnavailable}
                    key={option}
                    onClick={() => selectMarketSide(option)}
                  >
                    <img
                      className={`buy-betslip__side-direction-icon${shouldAnimateArrow ? ` buy-betslip__side-arrow--${option}` : ''}`}
                      src={iconDoubleChevronsUp}
                      alt=""
                      aria-hidden="true"
                      key={shouldAnimateArrow ? `${option}-${sideArrowAnimation.id}` : option}
                    />
                    <span>{option.toUpperCase()}</span>
                    {isUnavailable ? (
                      <img
                        className="buy-betslip__side-lock-icon"
                        src={iconLock}
                        alt=""
                        aria-hidden="true"
                      />
                    ) : (
                      <span>{formatPercentage(presentedQuote.percentages[option])}</span>
                    )}
                  </button>
                )
              })}
            </div>
            {isSellMode && (
              <div className="buy-betslip__positions" aria-label="Participaciones disponibles">
                {(['up', 'down'] as const).map((option) => (
                  <span
                    className={`buy-betslip__position buy-betslip__position--${option}${option === side ? ' buy-betslip__position--selected' : ''}`}
                    key={option}
                  >
                    {formatParticipations(participations[option])} participaciones
                  </span>
                ))}
              </div>
            )}
          </div>

          <div
            className={`buy-betslip__quote-content buy-betslip__quote-content--${quoteTransitionPhase}`}
            key={side}
          >
          <div className="buy-betslip__divider" />

          {!isSellMode && amountMode === 'one-tap' ? (
            <>
              <div className="buy-betslip__quick-header">
                <strong>Compra con un toque</strong>
                <button type="button" onClick={openQuickAmountEditor}>
                  <img src={iconEdit} alt="" aria-hidden="true" />
                  <span>Editar</span>
                </button>
              </div>
              <div className="buy-betslip__quick-amounts">
                {quickAmounts.map((quickAmount, index) => {
                  const quickQuote = presentedQuote.quickQuotes[index] ?? null
                  const quickPayout = formatPotentialPayout(quickQuote)
                  const isQuickQuoteAvailable = presentedQuote.percentages[side] !== null
                    && quickQuote?.complete === true
                  const isQuickAmountAffordable = Math.round(quickAmount * 100)
                    <= availableBalanceCents

                  return (
                    <button
                      className={`buy-betslip__quick-amount${quickAmountLoadingIndex === index ? ' buy-betslip__quick-amount--loading' : ''}`}
                      type="button"
                      key={index}
                      aria-label={isQuickAmountAffordable
                        ? `Comprar por ${formatAmount(quickAmount)}; ganancia potencial ${quickPayout}`
                        : `Comprar por ${formatAmount(quickAmount)}; saldo insuficiente`}
                      aria-busy={quickAmountLoadingIndex === index}
                      disabled={quickAmountLoadingIndex !== null
                        || !isQuickQuoteAvailable
                        || !isQuickAmountAffordable}
                      onClick={() => buyQuickAmount(quickAmount, index)}
                    >
                      <img
                        className="buy-betslip__quick-amount-light"
                        src={quickAmountLight}
                        alt=""
                        aria-hidden="true"
                      />
                      {quickAmountLoadingIndex === index ? (
                        <span className="buy-betslip__quick-amount-loading" aria-hidden="true">
                          <img src={iconLoading} alt="" />
                        </span>
                      ) : (
                        <>
                          <strong>{formatAmount(quickAmount)}</strong>
                          <span>Ganancia potencial</span>
                          <small>{quickPayout}</small>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
              {quoteFeedback && (
                <div
                  className="buy-betslip__quote-protection buy-betslip__quote-protection--error"
                  role="status"
                  aria-live="polite"
                >
                  {quoteFeedbackText}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="buy-betslip__metrics">
                <button
                  className="buy-betslip__metric"
                  type="button"
                  onClick={isSellMode ? openSellKeyboard : openKeyboard}
                >
                  <span className="buy-betslip__metric-value buy-betslip__metric-value--amount">
                    <img src={iconEdit} alt="" aria-hidden="true" />
                    <span>
                      {isSellMode
                        ? isSellDraftEmpty
                          ? ''
                          : formatParticipations(activeSellParticipation)
                        : amount
                          ? formatTypedAmount(numericAmount)
                          : '$'}
                    </span>
                    {isKeyboardOpen && <span className="buy-betslip__caret" aria-hidden="true" />}
                  </span>
                  <span className="buy-betslip__metric-label">
                    {isSellMode ? 'Participaciones' : 'Monto'}
                  </span>
                </button>
                <div className="buy-betslip__metric">
                  <span className="buy-betslip__metric-value">{averagePrice}</span>
                  <span className="buy-betslip__metric-label">
                    {isSellMode ? 'Precio de venta' : 'Precio promedio'}
                  </span>
                </div>
                <div className="buy-betslip__metric">
                  <span className="buy-betslip__metric-value buy-betslip__metric-value--gain">
                    {isSellMode ? amountToReceive : potentialPayout}
                  </span>
                  <span className="buy-betslip__metric-label">
                    {isSellMode ? 'Monto a recibir' : 'Ganancia potencial'}
                  </span>
                </div>
              </div>

              <div className="buy-betslip__keyboard-shell" aria-hidden={!isKeyboardOpen}>
                <div className={`buy-betslip__keyboard${isSellMode ? ' buy-betslip__keyboard--sell' : ''}`}>
                  {isSellMode ? (
                    <>
                      {[0.25, 0.5, 0.75].map((percentage) => (
                        <button
                          type="button"
                          key={percentage}
                          onClick={() => selectSellPercentage(percentage)}
                        >
                          {percentage * 100}%
                        </button>
                      ))}
                      <button type="button" onClick={() => selectSellPercentage(1)}>MAX</button>
                      <button
                        className="buy-betslip__done"
                        type="button"
                        onClick={finishSellEditing}
                      >
                        <img src={iconCheck} alt="" aria-hidden="true" />
                        <span>Hecho</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                        <button type="button" key={digit} onClick={() => handleDigit(digit)}>
                          {digit}
                        </button>
                      ))}
                      <button type="button" aria-label="Borrar último número" onClick={handleDelete}>
                        <img className="buy-betslip__delete-icon" src={iconDelete} alt="" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => handleDigit('0')}>0</button>
                      <button
                        className="buy-betslip__done"
                        type="button"
                        onClick={finishAmountEditing}
                      >
                        <img src={iconCheck} alt="" aria-hidden="true" />
                        <span>Hecho</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {quoteFeedback && (
                <div
                  className="buy-betslip__quote-protection buy-betslip__quote-protection--error"
                  role="status"
                  aria-live="polite"
                >
                  {quoteFeedbackText}
                </div>
              )}

              <div className="buy-betslip__swipe-wrap">
                <SwipeToBuy
                  key={`${operationMode}-${side}-${isKeyboardOpen ? 'keyboard' : 'regular'}`}
                  amount={isSellMode ? activeSellParticipation : numericAmount}
                  disabled={!isActiveQuoteComplete}
                  mode={operationMode}
                  formattedValue={formatParticipations(activeSellParticipation)}
                  unavailableLabel={isInsufficientBalance
                    ? 'Saldo insuficiente'
                    : undefined}
                  onLock={() => {
                    const currentQuote = isSellMode
                      ? market.quoteSell(side, activeSellParticipation)
                      : market.quoteBuy(side, numericAmount)
                    const protection = protectQuote(activeQuote, currentQuote)
                    if (protection.status !== 'accepted') return false

                    return isSellMode
                      ? beginSellExecution(protection.quote)
                      : beginBuyExecution(numericAmount, protection.quote)
                  }}
                  onLoadingChange={onPurchaseLoadingChange}
                  onComplete={isSellMode ? completeSell : completeBuy}
                />
              </div>
            </>
          )}
          </div>
          </div>
        </div>

        <button
          className="buy-betslip__summary"
          type="button"
          aria-label={`Expandir detalles de la ${isSellMode ? 'venta' : 'compra'}`}
          aria-hidden={!isCollapsed}
          tabIndex={isCollapsed ? 0 : -1}
          onClick={() => {
            clearCollapseTimer()
            dragYRef.current = 0
            setDragY(0)
            setSheetStageHeight(null)
            setIsDraggingSheet(false)
            setIsCollapsed(false)
          }}
        >
          <span className="buy-betslip__summary-metrics">
            <span className={`buy-betslip__summary-metric buy-betslip__summary-metric--${side}`}>
              <strong>{selectedPercentage}</strong>
              <small>{side === 'up' ? 'Up' : 'Down'}</small>
            </span>
            <span className="buy-betslip__summary-metric">
              <strong>{averagePrice}</strong>
              <small>{isSellMode ? 'Precio de venta' : 'Precio promedio'}</small>
            </span>
            <span className="buy-betslip__summary-metric">
              <strong>
                {isSellMode
                  ? formatParticipations(sellParticipation)
                  : formatTypedAmount(numericAmount)}
              </strong>
              <small>{isSellMode ? 'Participaciones' : 'Monto'}</small>
            </span>
          </span>
          <span className="buy-betslip__summary-gain">
            <strong>{isSellMode ? amountToReceive : potentialPayout}</strong>
            <span>
              {isSellMode ? 'Recibe' : 'Ganancia'}
              <img src={iconChevronRight} alt="" aria-hidden="true" />
            </span>
          </span>
        </button>
      </div>

      {isQuickAmountEditorOpen && (
        <QuickAmountEditorSheet
          amounts={quickAmounts}
          onClose={() => setIsQuickAmountEditorOpen(false)}
          onSave={(nextAmounts) => {
            clearQuoteFeedback()
            setQuickAmounts(nextAmounts)
          }}
        />
      )}
    </section>
  )
}
