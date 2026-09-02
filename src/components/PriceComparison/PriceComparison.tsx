import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import arrowDownRed from '../../assets/arrowDownRed.svg'
import arrowUpGreen from '../../assets/arrowUpGreen.svg'
import lightPriceCurrent from '../../assets/lightPriceCurrent.svg'
import lightPriceTarget from '../../assets/lightPriceTarget.svg'
import { InfoModal } from '../InfoModal'
import { priceInfoById, type PriceInfoId } from './priceInfoContent'
import './PriceComparison.css'

interface PriceComparisonProps {
  isCompact: boolean
  targetPrice: number | null
  currentPrice: number | null
}

const priceFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatPrice = (price: number | null) => (
  price === null ? '—' : priceFormatter.format(price)
)

export function PriceComparison({
  isCompact,
  targetPrice,
  currentPrice,
}: PriceComparisonProps) {
  const [activeInfoId, setActiveInfoId] = useState<PriceInfoId | null>(null)
  const infoReturnFocusRef = useRef<HTMLElement | null>(null)

  const openInfoModal = useCallback((
    infoId: PriceInfoId,
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

  useEffect(() => {
    if (activeInfoId === null) return

    const previousBodyOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
    }
  }, [activeInfoId])

  const priceDifference = targetPrice !== null && currentPrice !== null
    ? currentPrice - targetPrice
    : null
  const trendDirection = priceDifference === null || priceDifference === 0
    ? 'flat'
    : priceDifference > 0 ? 'up' : 'down'
  const trendIcon = trendDirection === 'up'
    ? arrowUpGreen
    : trendDirection === 'down' ? arrowDownRed : null

  return (
    <div
      className={`price-comparison-slot${isCompact ? ' price-comparison-slot--compact' : ''}`}
    >
      <section
        className={`price-comparison${isCompact ? ' price-comparison--sticky' : ''}`}
        aria-label="Comparación de precios de Bitcoin"
        data-node-id={isCompact ? '198:3376' : '188:2941'}
      >
        <button
          className="price-comparison__card price-comparison__card--target"
          type="button"
          aria-haspopup="dialog"
          data-market-price={targetPrice ?? ''}
          onClick={(event) => openInfoModal('targetPrice', event.currentTarget)}
        >
          <span className="price-comparison__label">Precio objetivo</span>
          <strong className="price-comparison__value">
            {formatPrice(targetPrice)}
          </strong>
          <span className="price-comparison__light" aria-hidden="true">
            <img src={lightPriceTarget} alt="" />
          </span>
        </button>

        <button
          className="price-comparison__card price-comparison__card--current"
          type="button"
          aria-haspopup="dialog"
          data-market-price={currentPrice ?? ''}
          onClick={(event) => openInfoModal('currentPrice', event.currentTarget)}
        >
          <span className="price-comparison__heading">
            <span className="price-comparison__label">Precio actual</span>
            {priceDifference !== null && (
              <span
                className={`price-comparison__trend price-comparison__trend--${trendDirection}`}
              >
                {trendIcon && (
                  <img src={trendIcon} alt="" aria-hidden="true" />
                )}
                <span>{priceFormatter.format(Math.abs(priceDifference))}</span>
              </span>
            )}
          </span>
          <strong className="price-comparison__value">
            {formatPrice(currentPrice)}
          </strong>
          <span className="price-comparison__light" aria-hidden="true">
            <img src={lightPriceCurrent} alt="" />
          </span>
        </button>
      </section>

      {activeInfoId
        ? createPortal(
          <InfoModal
            containerClassName="price-comparison__info-modal"
            info={priceInfoById[activeInfoId]}
            onClose={closeInfoModal}
          />,
          document.body,
        )
        : null}
    </div>
  )
}
