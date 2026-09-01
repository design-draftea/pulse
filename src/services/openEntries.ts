import type {
  PrototypeWalletCostBasis,
  PrototypeWalletPosition,
} from './prototypeWallet'
import type { OutcomeSide } from './outcomeMarket'

const OPEN_ENTRY_SIDES: OutcomeSide[] = ['down', 'up']
const PARTICIPATION_EPSILON = 1e-8

export interface OpenEntrySummary {
  side: OutcomeSide
  participations: number
  amountCents: number
  averagePriceCents: number
  potentialPayoutCents: number
}

export const getOpenEntrySummaries = (
  position: PrototypeWalletPosition,
  costBasis: PrototypeWalletCostBasis,
): OpenEntrySummary[] => OPEN_ENTRY_SIDES.flatMap((side) => {
  const participations = position[side]

  if (participations <= PARTICIPATION_EPSILON) return []

  const amountCents = costBasis[side]

  return [{
    side,
    participations,
    amountCents,
    averagePriceCents: amountCents / participations,
    potentialPayoutCents: Math.round(participations * 100),
  }]
})
