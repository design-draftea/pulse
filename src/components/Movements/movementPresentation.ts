import iconDeposito from '../../assets/iconDeposito.svg'
import iconMoney from '../../assets/iconMoney.svg'
import iconSaque from '../../assets/iconSaque.svg'
import type { WalletMovementType } from '../../services/prototypeWallet'

export const MONTH_LABELS = [
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

export const movementTitles: Record<WalletMovementType, string> = {
  deposit: 'Depósito',
  withdrawal: 'Retiro de ganancias',
  purchase: 'Compró BTC / 15 min',
  sale: 'Vendió BTC / 15 min',
  win: 'Ganó BTC / 15 min',
  cancellation: 'Cancelado BTC / 15 min',
}

export const movementIcons: Record<WalletMovementType, string> = {
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

export const formatMovementAmount = (amountCents: number) => (
  `${amountCents >= 0 ? '+' : '-'} ${currencyFormatter.format(
    Math.abs(amountCents) / 100,
  )}`
)

export const formatMovementTime = (date: Date) => timeFormatter.format(date)

export const formatMovementDate = (date: Date) => [
  String(date.getDate()).padStart(2, '0'),
  MONTH_LABELS[date.getMonth()],
  date.getFullYear(),
].join(' ')
