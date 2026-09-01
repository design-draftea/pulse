import iconChevronRight from '../../assets/iconChevronRight.svg'
import iconDeposito from '../../assets/iconDeposito.svg'
import iconMoney from '../../assets/iconMoney.svg'
import iconSaque from '../../assets/iconSaque.svg'
import './Movements.css'

type MovementTone = 'positive' | 'negative'

interface MovementItem {
  id: string
  title: string
  time: string
  amount: string
  tone: MovementTone
  icon: string
}

interface MovementGroup {
  label: string
  items: MovementItem[]
}

const MOVEMENT_GROUPS: MovementGroup[] = [
  {
    label: 'Hoy',
    items: [
      {
        id: 'deposit-today',
        title: 'Depósito',
        time: '12:45',
        amount: '+ $200.00',
        tone: 'positive',
        icon: iconDeposito,
      },
      {
        id: 'win-today',
        title: 'Ganó BTC / 15 min',
        time: '12:45',
        amount: '+ $200.00',
        tone: 'positive',
        icon: iconMoney,
      },
    ],
  },
  {
    label: '01 Set. 2026',
    items: [
      {
        id: 'purchase-september',
        title: 'Compró BTC / 15 min',
        time: '16:54',
        amount: '- $90.00',
        tone: 'negative',
        icon: iconMoney,
      },
      {
        id: 'withdrawal-september',
        title: 'Retiro de ganancias',
        time: '16:54',
        amount: '- $90.00',
        tone: 'negative',
        icon: iconSaque,
      },
      {
        id: 'card-deposit-september',
        title: 'Depósito tarjeta',
        time: '12:45',
        amount: '+ $200.00',
        tone: 'positive',
        icon: iconDeposito,
      },
      {
        id: 'sale-september',
        title: 'Vendió BTC / 15 min',
        time: '12:45',
        amount: '+ $200.00',
        tone: 'positive',
        icon: iconMoney,
      },
      {
        id: 'cancelled-september',
        title: 'Cancelado BTC / 15 min',
        time: '12:45',
        amount: '+ $200.00',
        tone: 'positive',
        icon: iconMoney,
      },
    ],
  },
]

export function Movements() {
  return (
    <main
      className="movements"
      aria-label="Movimientos"
      data-node-id="381:6271"
    >
      {MOVEMENT_GROUPS.map((group) => (
        <section className="movements__group" key={group.label}>
          <h2 className="movements__date">{group.label}</h2>
          <ul className="movements__list">
            {group.items.map((item) => (
              <li className="movements__item" key={item.id}>
                <span className="movements__icon-wrap" aria-hidden="true">
                  <img className="movements__icon" src={item.icon} alt="" />
                </span>

                <span className="movements__info">
                  <span className="movements__title">{item.title}</span>
                  <time className="movements__time">{item.time}</time>
                </span>

                <span className="movements__value-wrap">
                  <span
                    className={`movements__value movements__value--${item.tone}`}
                  >
                    {item.amount}
                  </span>
                  <img
                    className="movements__chevron"
                    src={iconChevronRight}
                    alt=""
                    aria-hidden="true"
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="movements__spacing" aria-hidden="true" />
    </main>
  )
}
