import {
  useCallback,
  useEffect,
  useRef,
  useState,
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

  return createPortal(
    <div
      className={`movement-detail-modal__container${isClosing ? ' movement-detail-modal__container--closing' : ''}`}
    >
      <button
        className="movement-detail-modal__overlay"
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
