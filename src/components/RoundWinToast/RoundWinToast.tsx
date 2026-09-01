import { useEffect, useState } from 'react'
import iconRoundWin from '../../assets/iconRoundWin.svg'
import './RoundWinToast.css'

const TOAST_VISIBLE_MS = 4_000
const TOAST_EXIT_MS = 300

const gainFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export interface RoundWinDetails {
  roundStart: number
  totalReceived: number
}

interface RoundWinToastProps {
  details: RoundWinDetails
  onDismiss: () => void
}

export function RoundWinToast({
  details,
  onDismiss,
}: RoundWinToastProps) {
  const [isClosing, setIsClosing] = useState(false)
  const gain = gainFormatter.format(details.totalReceived)

  useEffect(() => {
    const closingTimer = window.setTimeout(
      () => setIsClosing(true),
      TOAST_VISIBLE_MS,
    )
    const dismissTimer = window.setTimeout(
      onDismiss,
      TOAST_VISIBLE_MS + TOAST_EXIT_MS,
    )

    return () => {
      window.clearTimeout(closingTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [onDismiss])

  return (
    <section
      className={`round-win-toast${isClosing ? ' round-win-toast--closing' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Ganaste ${gain}`}
      data-node-id="320:13133"
      data-round-start={details.roundStart}
      data-total-received={details.totalReceived}
    >
      <img src={iconRoundWin} alt="" aria-hidden="true" />
      <span>Ganaste {gain}</span>
    </section>
  )
}
