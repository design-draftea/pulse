import { useState } from 'react'
import iconChevronRight from '../../assets/iconChevronRight.svg'
import type { PrototypeWalletMovement } from '../../services/prototypeWallet'
import { MovementDetailModal } from './MovementDetailModal'
import {
  formatMovementAmount,
  formatMovementTime,
  MONTH_LABELS,
  movementIcons,
  movementTitles,
} from './movementPresentation'
import './Movements.css'

interface MovementsProps {
  movements: PrototypeWalletMovement[]
}

interface MovementGroup {
  key: string
  label: string
  items: PrototypeWalletMovement[]
}

const getDateKey = (date: Date) => (
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
)

const getDateLabel = (date: Date, today: Date) => {
  if (getDateKey(date) === getDateKey(today)) return 'Hoy'

  return [
    String(date.getDate()).padStart(2, '0'),
    MONTH_LABELS[date.getMonth()],
    date.getFullYear(),
  ].join(' ')
}

const groupMovements = (
  movements: PrototypeWalletMovement[],
): MovementGroup[] => {
  const today = new Date()

  return [...movements].reverse().reduce<MovementGroup[]>((groups, movement) => {
    const occurredAt = new Date(movement.occurredAt)
    const key = getDateKey(occurredAt)
    const currentGroup = groups.at(-1)

    if (currentGroup?.key === key) {
      currentGroup.items.push(movement)
      return groups
    }

    groups.push({
      key,
      label: getDateLabel(occurredAt, today),
      items: [movement],
    })
    return groups
  }, [])
}

export function Movements({ movements }: MovementsProps) {
  const [selectedMovement, setSelectedMovement] = useState<PrototypeWalletMovement | null>(null)
  const movementGroups = groupMovements(movements)

  return (
    <main
      className="movements"
      aria-label="Movimientos"
      data-node-id="381:6271"
    >
      {movementGroups.map((group) => (
        <section className="movements__group" key={group.key}>
          <h2 className="movements__date">{group.label}</h2>
          <ul className="movements__list">
            {group.items.map((item) => {
              const occurredAt = new Date(item.occurredAt)
              const isPositive = item.amountCents >= 0

              return (
                <li className="movements__item" key={item.id}>
                  <button
                    className="movements__item-button"
                    type="button"
                    aria-label={`Ver detalle: ${movementTitles[item.type]}${item.side ? `, ${item.side.toUpperCase()}` : ''}, ${formatMovementAmount(item.amountCents)}`}
                    onClick={() => setSelectedMovement(item)}
                  >
                    <span className="movements__icon-wrap" aria-hidden="true">
                      <img
                        className="movements__icon"
                        src={movementIcons[item.type]}
                        alt=""
                      />
                    </span>

                    <span className="movements__info">
                      <span className="movements__title">
                        {movementTitles[item.type]}
                      </span>
                      <span className="movements__meta">
                        <time dateTime={occurredAt.toISOString()}>
                          {formatMovementTime(occurredAt)}
                        </time>
                        {item.side && (
                          <span className={`movements__side movements__side--${item.side}`}>
                            {item.side.toUpperCase()}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="movements__value-wrap">
                      <span
                        className={`movements__value movements__value--${isPositive ? 'positive' : 'negative'}`}
                      >
                        {formatMovementAmount(item.amountCents)}
                      </span>
                      <img
                        className="movements__chevron"
                        src={iconChevronRight}
                        alt=""
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <div className="movements__spacing" aria-hidden="true" />

      {selectedMovement && (
        <MovementDetailModal
          movement={selectedMovement}
          onClose={() => setSelectedMovement(null)}
        />
      )}
    </main>
  )
}
