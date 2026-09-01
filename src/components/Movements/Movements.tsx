import iconChevronRight from '../../assets/iconChevronRight.svg'
import iconDeposito from '../../assets/iconDeposito.svg'
import iconMoney from '../../assets/iconMoney.svg'
import iconSaque from '../../assets/iconSaque.svg'
import type {
  PrototypeWalletMovement,
  WalletMovementType,
} from '../../services/prototypeWallet'
import './Movements.css'

interface MovementsProps {
  movements: PrototypeWalletMovement[]
}

interface MovementGroup {
  key: string
  label: string
  items: PrototypeWalletMovement[]
}

const MONTH_LABELS = [
  'Ene.',
  'Feb.',
  'Mar.',
  'Abr.',
  'May.',
  'Jun.',
  'Jul.',
  'Ago.',
  'Set.',
  'Oct.',
  'Nov.',
  'Dic.',
]

const movementTitles: Record<WalletMovementType, string> = {
  deposit: 'Depósito',
  withdrawal: 'Retiro de ganancias',
  purchase: 'Compró BTC / 15 min',
  sale: 'Vendió BTC / 15 min',
  win: 'Ganó BTC / 15 min',
  cancellation: 'Cancelado BTC / 15 min',
}

const movementIcons: Record<WalletMovementType, string> = {
  deposit: iconDeposito,
  withdrawal: iconSaque,
  purchase: iconMoney,
  sale: iconMoney,
  win: iconMoney,
  cancellation: iconMoney,
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

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

const formatMovementAmount = (amountCents: number) => (
  `${amountCents >= 0 ? '+' : '-'} ${currencyFormatter.format(
    Math.abs(amountCents) / 100,
  )}`
)

export function Movements({ movements }: MovementsProps) {
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
                    <time
                      className="movements__time"
                      dateTime={occurredAt.toISOString()}
                    >
                      {timeFormatter.format(occurredAt)}
                    </time>
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
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <div className="movements__spacing" aria-hidden="true" />
    </main>
  )
}
