import { useEffect, useRef } from 'react'
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

interface MovementDetailModalProps {
  movement: PrototypeWalletMovement
  onClose: () => void
}

export function MovementDetailModal({
  movement,
  onClose,
}: MovementDetailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const occurredAt = new Date(movement.occurredAt)

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleEscape)
      previousFocus?.focus()
    }
  }, [onClose])

  return createPortal(
    <div className="movement-detail-modal__container">
      <button
        className="movement-detail-modal__overlay"
        type="button"
        aria-label="Cerrar detalle al tocar fuera"
        onClick={onClose}
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
          onClick={onClose}
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
          <button type="button" onClick={onClose}>Entendido</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
