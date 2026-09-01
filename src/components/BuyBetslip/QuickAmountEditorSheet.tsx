import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import iconCheck from '../../assets/iconCheck.svg'
import iconClose from '../../assets/iconClose.svg'
import iconDelete from '../../assets/iconDelete.svg'
import quickAmountLight from '../../assets/quickAmountLight.svg'

const SHEET_MOTION_MS = 300
const MAX_AMOUNT_DIGITS = 5
const amountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

interface QuickAmountEditorSheetProps {
  amounts: number[]
  onClose: () => void
  onSave: (amounts: number[]) => void
}

const formatAmount = (value: string) => {
  const numericValue = Number(value || 0)
  return numericValue > 0 ? amountFormatter.format(numericValue) : '$'
}

export function QuickAmountEditorSheet({
  amounts,
  onClose,
  onSave,
}: QuickAmountEditorSheetProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [activeEdit, setActiveEdit] = useState<{ index: number; originalValue: string } | null>(null)
  const [draftAmounts, setDraftAmounts] = useState(() => amounts.map(String))
  const closeTimerRef = useRef<number | null>(null)
  const activeIndex = activeEdit?.index ?? null

  const requestClose = useCallback(() => {
    if (isClosing) return

    setIsClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      onClose()
    }, SHEET_MOTION_MS)
  }, [isClosing, onClose])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [requestClose])

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  const selectAmount = (index: number) => {
    if (activeIndex === index) return

    setDraftAmounts((current) => current.map((value, currentIndex) => (
      currentIndex === activeIndex && !value
        ? activeEdit?.originalValue ?? String(amounts[currentIndex])
        : currentIndex === index
          ? ''
          : value
    )))
    setActiveEdit({
      index,
      originalValue: draftAmounts[index] || String(amounts[index]),
    })
  }

  const handleDigit = (digit: string) => {
    if (activeIndex === null) return

    setDraftAmounts((current) => current.map((value, index) => {
      if (index !== activeIndex || value.length >= MAX_AMOUNT_DIGITS) return value
      if (value === '0') return digit
      return `${value}${digit}`
    }))
  }

  const handleDelete = () => {
    if (activeIndex === null) return

    setDraftAmounts((current) => current.map((value, index) => (
      index === activeIndex ? value.slice(0, -1) : value
    )))
  }

  const finishEditing = () => {
    if (activeEdit === null) return

    setDraftAmounts((current) => current.map((value, index) => (
      index === activeEdit.index && !value ? activeEdit.originalValue : value
    )))
    setActiveEdit(null)
  }

  const saveAmounts = () => {
    const nextAmounts = draftAmounts.map((value, index) => {
      const resolvedValue = index === activeEdit?.index && !value
        ? activeEdit.originalValue
        : value
      const numericValue = Number(resolvedValue || 0)
      return numericValue > 0 ? numericValue : amounts[index]
    })

    onSave(nextAmounts)
    requestClose()
  }

  return createPortal(
    <div
      className={`quick-amount-sheet__container${isClosing ? ' quick-amount-sheet__container--closing' : ''}`}
      data-node-id="247:5678"
    >
      <button
        className="quick-amount-sheet__overlay"
        type="button"
        aria-label="Cerrar editor de montos"
        onClick={requestClose}
      />
      <section
        className={`quick-amount-sheet${activeIndex !== null ? ' quick-amount-sheet--editing' : ''}${isClosing ? ' quick-amount-sheet--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-amount-sheet-title"
      >
        <header className="quick-amount-sheet__header">
          <span className="quick-amount-sheet__header-spacer" aria-hidden="true" />
          <h2 id="quick-amount-sheet-title">Editar montos</h2>
          <button
            className="quick-amount-sheet__close"
            type="button"
            aria-label="Cerrar"
            onClick={requestClose}
          >
            <img src={iconClose} alt="" aria-hidden="true" />
          </button>
        </header>

        <div className="quick-amount-sheet__content">
          <div className="quick-amount-sheet__amounts" aria-label="Montos de compra con un toque">
            {draftAmounts.map((value, index) => {
              const isActive = index === activeIndex

              return (
                <button
                  className={`quick-amount-sheet__amount${isActive ? ' quick-amount-sheet__amount--active' : ''}`}
                  type="button"
                  key={index}
                  aria-pressed={isActive}
                  aria-label={`Editar monto ${index + 1}: ${formatAmount(value)}`}
                  onClick={() => selectAmount(index)}
                >
                  <span>Editar</span>
                  <strong>
                    {formatAmount(value)}
                    {isActive && <i className="quick-amount-sheet__caret" aria-hidden="true" />}
                  </strong>
                  {isActive && <img src={quickAmountLight} alt="" aria-hidden="true" />}
                </button>
              )
            })}
          </div>

          {activeIndex !== null && (
            <div className="quick-amount-sheet__keyboard-shell">
              <div className="buy-betslip__keyboard quick-amount-sheet__keyboard">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button type="button" key={digit} onClick={() => handleDigit(digit)}>
                    {digit}
                  </button>
                ))}
                <button type="button" aria-label="Borrar último número" onClick={handleDelete}>
                  <img className="buy-betslip__delete-icon" src={iconDelete} alt="" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => handleDigit('0')}>0</button>
                <button className="buy-betslip__done" type="button" onClick={finishEditing}>
                  <img src={iconCheck} alt="" aria-hidden="true" />
                  <span>Hecho</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="quick-amount-sheet__footer">
          <button type="button" onClick={saveAmounts}>Salvar</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
