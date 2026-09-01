import arrowDownRed from '../../assets/arrowDownRed.svg'
import arrowUpGreen from '../../assets/arrowUpGreen.svg'
import lightPriceCurrent from '../../assets/lightPriceCurrent.svg'
import lightPriceTarget from '../../assets/lightPriceTarget.svg'
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
        <article
          className="price-comparison__card price-comparison__card--target"
          data-market-price={targetPrice ?? ''}
        >
          <span className="price-comparison__label">Precio objetivo</span>
          <strong className="price-comparison__value">
            {formatPrice(targetPrice)}
          </strong>
          <span className="price-comparison__light" aria-hidden="true">
            <img src={lightPriceTarget} alt="" />
          </span>
        </article>

        <article
          className="price-comparison__card price-comparison__card--current"
          data-market-price={currentPrice ?? ''}
        >
          <div className="price-comparison__heading">
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
          </div>
          <strong className="price-comparison__value">
            {formatPrice(currentPrice)}
          </strong>
          <span className="price-comparison__light" aria-hidden="true">
            <img src={lightPriceCurrent} alt="" />
          </span>
        </article>
      </section>
    </div>
  )
}
