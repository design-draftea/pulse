import { useEffect, useRef, useState } from 'react'
import bgToasterSucesso from '../../assets/bgToasterSucesso.webp'
import ilustraSucesso from '../../assets/ilustraSucesso.webp'
import type { BetslipSuccessDetails } from '../BuyBetslip/BuyBetslip'
import './PurchaseSuccessToast.css'

const TOAST_VISIBLE_MS = 4000
const TOAST_EXIT_MS = 300
const TOAST_FRAME_STROKE_WIDTH_PX = 4
const TOAST_FRAME_CORNER_RADIUS_PX = 24
const TOAST_FRAME_NOTCH_RADIUS_PX = 15

interface ToastFrameSize {
  height: number
  width: number
}

const getToastFramePath = ({ height, width }: ToastFrameSize) => {
  if (height <= 0 || width <= 0) return ''

  const inset = TOAST_FRAME_STROKE_WIDTH_PX / 2
  const left = inset
  const top = inset
  const right = width - inset
  const bottom = height - inset
  const cornerRadius = Math.min(
    TOAST_FRAME_CORNER_RADIUS_PX,
    (right - left) / 2,
    (bottom - top) / 2,
  )
  const notchRadius = Math.min(
    TOAST_FRAME_NOTCH_RADIUS_PX,
    Math.max(0, (bottom - top - cornerRadius * 2) / 2),
  )
  // A dobra acompanha o centro vertical do quadro medido. Uma posição fixa
  // ficava acima do meio e passava a divergir a cada mudança de altura.
  const notchCenterY = Math.min(
    Math.max(
      (top + bottom) / 2,
      top + cornerRadius + notchRadius,
    ),
    bottom - cornerRadius - notchRadius,
  )
  const notchTop = notchCenterY - notchRadius
  const notchBottom = notchCenterY + notchRadius

  return [
    `M ${left + cornerRadius} ${top}`,
    `H ${right - cornerRadius}`,
    `Q ${right} ${top} ${right} ${top + cornerRadius}`,
    `V ${notchTop}`,
    `A ${notchRadius} ${notchRadius} 0 0 0 ${right} ${notchBottom}`,
    `V ${bottom - cornerRadius}`,
    `Q ${right} ${bottom} ${right - cornerRadius} ${bottom}`,
    `H ${left + cornerRadius}`,
    `Q ${left} ${bottom} ${left} ${bottom - cornerRadius}`,
    `V ${notchBottom}`,
    `A ${notchRadius} ${notchRadius} 0 0 0 ${left} ${notchTop}`,
    `V ${top + cornerRadius}`,
    `Q ${left} ${top} ${left + cornerRadius} ${top}`,
    'Z',
  ].join(' ')
}

function PurchaseSuccessToastFrame() {
  const frameRef = useRef<SVGSVGElement | null>(null)
  const [frameSize, setFrameSize] = useState<ToastFrameSize>({
    height: 0,
    width: 0,
  })
  const path = getToastFramePath(frameSize)

  useEffect(() => {
    const node = frameRef.current
    if (!node) return undefined

    const updateFrameSize = () => {
      const rect = node.getBoundingClientRect()
      const nextSize = {
        height: Math.round(rect.height),
        width: Math.round(rect.width),
      }

      setFrameSize((currentSize) =>
        currentSize.height === nextSize.height &&
        currentSize.width === nextSize.width
          ? currentSize
          : nextSize,
      )
    }

    updateFrameSize()

    if (!window.ResizeObserver) {
      window.addEventListener('resize', updateFrameSize)
      return () => window.removeEventListener('resize', updateFrameSize)
    }

    const observer = new ResizeObserver(updateFrameSize)
    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  return (
    <svg
      ref={frameRef}
      className="purchase-success-toast__frame"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      viewBox={`0 0 ${Math.max(frameSize.width, 1)} ${Math.max(frameSize.height, 1)}`}
    >
      {path ? <path d={path} /> : null}
    </svg>
  )
}

const amountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const gainFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

interface PurchaseSuccessToastProps {
  details: BetslipSuccessDetails
  onDismiss: () => void
}

export function PurchaseSuccessToast({
  details,
  onDismiss,
}: PurchaseSuccessToastProps) {
  const dismissTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    dismissTimerRef.current = window.setTimeout(() => {
      dismissTimerRef.current = null
      setIsClosing(true)
      exitTimerRef.current = window.setTimeout(() => {
        exitTimerRef.current = null
        onDismiss()
      }, TOAST_EXIT_MS)
    }, TOAST_VISIBLE_MS)

    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current)
      }
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
      }
    }
  }, [onDismiss])

  const isSale = details.operation === 'sell'
  const direction = details.side.toUpperCase()
  const primaryAmount = gainFormatter.format(
    isSale ? details.amountReceived : details.potentialPayout,
  )
  const amount = isSale ? null : amountFormatter.format(details.amount)
  const participations = participationFormatter.format(details.participations)
  const averagePriceCents = Math.round(details.averagePrice * 100)
  const ariaLabel = isSale
    ? `Venta en ${direction} confirmada. Monto recibido ${primaryAmount}. Precio de venta ${averagePriceCents} centavos. Participaciones ${participations}.`
    : `Compra en ${direction} confirmada. Ganancia potencial ${primaryAmount}. Monto ${amount}. Precio promedio ${averagePriceCents} centavos.`

  return (
    <section
      className={`purchase-success-toast${isClosing ? ' purchase-success-toast--closing' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      data-node-id="295:11630"
    >
      <img
        className="purchase-success-toast__background"
        src={bgToasterSucesso}
        alt=""
        aria-hidden="true"
      />
      <PurchaseSuccessToastFrame />
      <div className="purchase-success-toast__content">
        <div className="purchase-success-toast__overview">
          <div className="purchase-success-toast__body">
            <strong className="purchase-success-toast__title">
              ¡{isSale ? 'VENTA' : 'COMPRA'} EN {direction}!
            </strong>
            <div className="purchase-success-toast__gain">
              <strong>{primaryAmount}</strong>
              <span>{isSale ? 'Monto recibido' : 'Ganancia potencial'}</span>
            </div>
            <div className="purchase-success-toast__details">
              {isSale ? (
                <>
                  <span>Precio de venta {averagePriceCents}¢</span>
                  <span>Participaciones: {participations}</span>
                </>
              ) : (
                <>
                  <span>Monto: {amount}</span>
                  <span>
                    Participaciones: {participations} - {averagePriceCents}¢
                  </span>
                </>
              )}
            </div>
          </div>
          <img
            className="purchase-success-toast__illustration"
            src={ilustraSucesso}
            alt=""
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  )
}
