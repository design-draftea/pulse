import { useEffect, useRef, useState } from 'react'
import iconDoubleChevronsUp from '../../assets/iconDoubleChevronsUp.svg'
import { usePresentedOutcomePrices } from '../../hooks/usePresentedQuotes'
import './MarketChoice.css'

export type MarketSide = 'up' | 'down'

interface MarketChoiceProps {
  onSelect: (side: MarketSide) => void
  isClosing?: boolean
  prices: Record<MarketSide, number | null>
  roundSlug: string
}

const formatPercentage = (price: number | null) => (
  price === null ? '—' : `${Math.round(price * 100)}%`
)

export function MarketChoice({
  onSelect,
  isClosing = false,
  prices,
  roundSlug,
}: MarketChoiceProps) {
  const selectionTimerRef = useRef<number | null>(null)
  const [selectedSide, setSelectedSide] = useState<MarketSide | null>(null)
  const presentedPrices = usePresentedOutcomePrices(roundSlug, prices)

  useEffect(() => () => {
    if (selectionTimerRef.current !== null) {
      window.clearTimeout(selectionTimerRef.current)
    }
  }, [])

  const selectSide = (side: MarketSide) => {
    if (selectedSide !== null || isClosing || presentedPrices[side] === null) return

    setSelectedSide(side)
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const commitSelection = () => {
      selectionTimerRef.current = null
      onSelect(side)
    }

    if (prefersReducedMotion) {
      commitSelection()
      return
    }

    selectionTimerRef.current = window.setTimeout(commitSelection, 180)
  }

  return (
    <div
      className={`market-choice${isClosing ? ' market-choice--closing' : ''}`}
      data-node-id="188:3099"
      data-round-closing={isClosing}
    >
      <div className={`market-choice__base${selectedSide ? ' market-choice__base--selecting' : ''}`}>
        {isClosing ? (
          <div className="market-choice__closing-notice" role="status">
            <span className="market-choice__closing-pulse" aria-hidden="true" />
            <span>Cerrando ronda…</span>
          </div>
        ) : (
          <>
            <button
              className={`market-choice__button market-choice__button--up${selectedSide === 'up' ? ' market-choice__button--selected' : ''}`}
              type="button"
              aria-pressed={selectedSide === 'up'}
              aria-label={presentedPrices.up === null
                ? 'UP no disponible'
                : `Elegir UP, ${Math.round(presentedPrices.up * 100)} por ciento`}
              aria-disabled={presentedPrices.up === null || selectedSide !== null}
              disabled={presentedPrices.up === null}
              tabIndex={selectedSide === null ? 0 : -1}
              onClick={() => selectSide('up')}
            >
              <img src={iconDoubleChevronsUp} alt="" aria-hidden="true" />
              <span>UP</span>
              <span>{formatPercentage(presentedPrices.up)}</span>
            </button>

            <button
              className={`market-choice__button market-choice__button--down${selectedSide === 'down' ? ' market-choice__button--selected' : ''}`}
              type="button"
              aria-pressed={selectedSide === 'down'}
              aria-label={presentedPrices.down === null
                ? 'DOWN no disponible'
                : `Elegir DOWN, ${Math.round(presentedPrices.down * 100)} por ciento`}
              aria-disabled={presentedPrices.down === null || selectedSide !== null}
              disabled={presentedPrices.down === null}
              tabIndex={selectedSide === null ? 0 : -1}
              onClick={() => selectSide('down')}
            >
              <img src={iconDoubleChevronsUp} alt="" aria-hidden="true" />
              <span>DOWN</span>
              <span>{formatPercentage(presentedPrices.down)}</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
