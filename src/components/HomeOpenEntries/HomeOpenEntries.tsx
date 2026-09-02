import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type UIEvent,
} from 'react'
import homeEntryLight from '../../assets/homeEntryLight.svg'
import {
  getOpenEntrySummaries,
  type OpenEntrySummary,
} from '../../services/openEntries'
import type { OutcomeSide } from '../../services/outcomeMarket'
import type {
  PrototypeWalletCostBasis,
  PrototypeWalletPosition,
} from '../../services/prototypeWallet'
import './HomeOpenEntries.css'

const payoutFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const amountFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const participationFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const ENTRY_SIDE_ORDER: Record<OutcomeSide, number> = { down: 0, up: 1 }

export interface HomeOpenEntryExit {
  side: OutcomeSide
  position: PrototypeWalletPosition
  costBasis: PrototypeWalletCostBasis
  isLeaving: boolean
}

interface HomeOpenEntriesProps {
  roundStart: number
  position: PrototypeWalletPosition
  costBasis: PrototypeWalletCostBasis
  exitingEntry?: HomeOpenEntryExit | null
  onExitEnd?: () => void
  onSell: (side: OutcomeSide) => void
}

interface HomeOpenEntryCardProps {
  entry: OpenEntrySummary
  isEntering: boolean
  isLeaving: boolean
  onEnterEnd: () => void
  onLeaveEnd?: () => void
  onSell: (side: OutcomeSide) => void
}

function HomeOpenEntryCard({
  entry,
  isEntering,
  isLeaving,
  onEnterEnd,
  onLeaveEnd,
  onSell,
}: HomeOpenEntryCardProps) {
  const handleAnimationEnd = (event: ReactAnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return

    if (event.animationName === 'home-open-entry-card-enter') {
      onEnterEnd()
      return
    }

    if (event.animationName === 'home-open-entry-card-leave') {
      onLeaveEnd?.()
    }
  }

  return (
    <article
      className={`home-open-entry-card${isEntering ? ' home-open-entry-card--entering' : ''}${isLeaving ? ' home-open-entry-card--leaving' : ''}`}
      data-entry-side={entry.side}
      data-node-id="498:13381"
      onAnimationEnd={handleAnimationEnd}
    >
      <span className="home-open-entry-card__light" aria-hidden="true">
        <img src={homeEntryLight} alt="" />
      </span>

      <div className="home-open-entry-card__body">
        <span className="home-open-entry-card__row">
          <span>Compra:</span>
          <strong
            className={`home-open-entry-card__side home-open-entry-card__side--${entry.side}`}
          >
            {entry.side.toUpperCase()}
          </strong>
        </span>
        <span className="home-open-entry-card__row">
          <span>Monto:</span>
          <strong>{amountFormatter.format(entry.amountCents / 100)}</strong>
        </span>
        <span className="home-open-entry-card__row">
          <span>Precio promedio:</span>
          <strong>{Math.round(entry.averagePriceCents)}¢</strong>
        </span>
        <span className="home-open-entry-card__row">
          <span>Participaciones:</span>
          <strong>{participationFormatter.format(entry.participations)}</strong>
        </span>
      </div>

      <div className="home-open-entry-card__footer">
        <div className="home-open-entry-card__potential">
          <span className="home-open-entry-card__potential-label">
            Ganancia potencial:
          </span>
          <span className="home-open-entry-card__value">
            <span>$</span>
            <strong>
              {payoutFormatter.format(entry.potentialPayoutCents / 100)}
            </strong>
          </span>
        </div>
        <button
          className="home-open-entry-card__sell"
          type="button"
          onClick={() => onSell(entry.side)}
        >
          Vender
        </button>
      </div>
    </article>
  )
}

export function HomeOpenEntries({
  roundStart,
  position,
  costBasis,
  exitingEntry,
  onExitEnd,
  onSell,
}: HomeOpenEntriesProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [enteringKey, setEnteringKey] = useState<string | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  // A entrada só é revelada quando ela nasce durante a sessão. Chegar à Home
  // com uma posição já aberta, inclusive depois de um F5, permanece neutro.
  const knownKeysRef = useRef<Set<string> | null>(null)
  const liveEntries = getOpenEntrySummaries(position, costBasis)
  // O instantâneo anterior à venda mantém o card na lista enquanto a carteira
  // já está atualizada, e sai da lista só ao fim da animação de saída.
  const heldEntry = exitingEntry
    ? getOpenEntrySummaries(exitingEntry.position, exitingEntry.costBasis)
      .find(({ side }) => side === exitingEntry.side) ?? null
    : null
  const entries = heldEntry
    ? [...liveEntries, heldEntry]
      .toSorted((left, right) => ENTRY_SIDE_ORDER[left.side] - ENTRY_SIDE_ORDER[right.side])
    : liveEntries
  const entryKeys = entries.map(({ side }) => `${roundStart}-${side}`)
  const entryKeysSignature = entryKeys.join('|')

  useEffect(() => {
    const currentKeys = entryKeysSignature === ''
      ? []
      : entryKeysSignature.split('|')

    if (knownKeysRef.current === null) {
      knownKeysRef.current = new Set(currentKeys)
      return
    }

    const knownKeys = knownKeysRef.current
    const freshKey = currentKeys.find((key) => !knownKeys.has(key)) ?? null

    knownKeysRef.current = new Set(currentKeys)

    if (freshKey === null) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    setEnteringKey(freshKey)
  }, [entryKeysSignature])

  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0, behavior: 'auto' })
  }, [entryKeysSignature])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget
    const firstCard = track.querySelector<HTMLElement>('.home-open-entry-card')

    if (!firstCard) return

    const cardStep = firstCard.offsetWidth + 8
    const nextIndex = Math.round(track.scrollLeft / cardStep)

    setActiveIndex(Math.max(0, Math.min(entries.length - 1, nextIndex)))
  }

  if (entries.length === 0) return null

  return (
    <section
      className="home-open-entries"
      aria-labelledby="home-open-entries-title"
      data-entry-count={entries.length}
      data-node-id="497:12722"
    >
      <div className="home-open-entries__heading">
        <h2 id="home-open-entries-title" className="home-open-entries__title">
          Entradas abiertas
        </h2>
      </div>

      <div className="home-open-entries__carousel">
        <div
          className="home-open-entries__track"
          onScroll={handleScroll}
          ref={trackRef}
        >
          {entries.map((entry, index) => {
            const entryKey = entryKeys[index]

            return (
              <HomeOpenEntryCard
                entry={entry}
                isEntering={entryKey === enteringKey}
                isLeaving={exitingEntry?.isLeaving === true
                  && exitingEntry.side === entry.side}
                key={entry.side}
                onEnterEnd={() => setEnteringKey(
                  (currentKey) => (currentKey === entryKey ? null : currentKey),
                )}
                onLeaveEnd={onExitEnd}
                onSell={onSell}
              />
            )
          })}
        </div>

        {entries.length > 1 && (
          <div className="home-open-entries__bullets" aria-hidden="true">
            {entries.map((entry, index) => (
              <span
                className={`home-open-entries__bullet${index === activeIndex ? ' home-open-entries__bullet--active' : ''}`}
                key={`${entry.side}-bullet`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
