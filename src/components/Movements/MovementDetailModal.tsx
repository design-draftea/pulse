import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import iconClose from '../../assets/iconClose.svg'
import type { PrototypeWalletMovement } from '../../services/prototypeWallet'
import {
  formatMovementAmount,
  formatMovementDate,
  formatMovementTime,
  movementIcons,
  movementTitles,
} from './movementPresentation'
import './MovementDetailModal.css'

const MODAL_MOTION_MS = 300
const ROUND_DURATION_MS = 15 * 60 * 1000
const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const roundTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const OVERLAY_BLUR_STYLE = {
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
} satisfies CSSProperties

interface MovementDetailModalProps {
  movement: PrototypeWalletMovement
  onClose: () => void
}

export function MovementDetailModal({
  movement,
  onClose,
}: MovementDetailModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const isClosingRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const occurredAt = new Date(movement.occurredAt)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const requestClose = useCallback(() => {
    if (isClosingRef.current) return

    isClosingRef.current = true
    setIsClosing(true)
    const closeDelay = window.matchMedia('(prefers-reduced-motion: reduce)')
      .matches
      ? 1
      : MODAL_MOTION_MS

    closeTimerRef.current = window.setTimeout(() => {
      onCloseRef.current()
    }, closeDelay)
  }, [])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      requestClose()
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleEscape)
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
      previousFocus?.focus()
    }
  }, [requestClose])

  // O preço só existe onde a operação teve execução no livro. Numa vitória cada
  // participação paga $1 fixo, então exibir "preço" ali seria ruído.
  const hasExecutionPrice = (movement.type === 'purchase' || movement.type === 'sale')
    && movement.participations !== undefined
    && movement.participations > 0
  const priceLabel = hasExecutionPrice
    ? movement.type === 'sale' ? 'Precio de venta' : 'Precio promedio'
    : null
  const priceCents = hasExecutionPrice
    ? Math.round(Math.abs(movement.amountCents) / (movement.participations ?? 1))
    : null

  return createPortal(
    <div
      className={`movement-detail-modal__container${isClosing ? ' movement-detail-modal__container--closing' : ''}`}
    >
      <button
        className="movement-detail-modal__overlay"
        style={OVERLAY_BLUR_STYLE}
        type="button"
        aria-label="Cerrar detalle al tocar fuera"
        onClick={requestClose}
      />
      <section
        className="movement-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-detail-modal-title"
        data-node-id="383:6647"
      >
        <button
          ref={closeButtonRef}
          className="movement-detail-modal__close"
          type="button"
          aria-label="Cerrar detalle del movimiento"
          onClick={requestClose}
        >
          <img src={iconClose} alt="" aria-hidden="true" />
        </button>

        <header className="movement-detail-modal__header">
          <span className="movement-detail-modal__icon-wrap" aria-hidden="true">
            <img src={movementIcons[movement.type]} alt="" />
          </span>

          <div className="movement-detail-modal__heading">
            <h2 id="movement-detail-modal-title">
              {movementTitles[movement.type]}
            </h2>
            <div className="movement-detail-modal__date">
              <time dateTime={occurredAt.toISOString()}>
                {formatMovementTime(occurredAt)}
              </time>
              <span aria-hidden="true" />
              <time dateTime={occurredAt.toISOString()}>
                {formatMovementDate(occurredAt)}
              </time>
            </div>
          </div>
        </header>

        <dl className="movement-detail-modal__rows">
          {movement.side && (
            <div className="movement-detail-modal__row">
              <dt>Lado</dt>
              <dd className={`movement-detail-modal__side movement-detail-modal__side--${movement.side}`}>
                {movement.side.toUpperCase()}
              </dd>
            </div>
          )}

          {movement.roundStart !== undefined && (
            <div className="movement-detail-modal__row">
              <dt>Ronda</dt>
              <dd>
                {roundTimeFormatter.format(movement.roundStart)}
                {' - '}
                {roundTimeFormatter.format(movement.roundStart + ROUND_DURATION_MS)}
              </dd>
            </div>
          )}

          {movement.participations !== undefined && (
            <div className="movement-detail-modal__row">
              <dt>Participaciones</dt>
              <dd>{participationFormatter.format(movement.participations)}</dd>
            </div>
          )}

          {priceLabel && (
            <div className="movement-detail-modal__row">
              <dt>{priceLabel}</dt>
              <dd>{priceCents}¢</dd>
            </div>
          )}
        </dl>

        <div className="movement-detail-modal__total">
          <span>Total</span>
          <strong>{formatMovementAmount(movement.amountCents)}</strong>
        </div>

        <footer className="movement-detail-modal__footer">
          <button type="button" onClick={requestClose}>Entendido</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
