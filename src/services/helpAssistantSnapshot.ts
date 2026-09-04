import type {
  ExecutionQuote,
  OutcomeMarketStatus,
  OutcomeSide,
} from './outcomeMarket'

/**
 * Retrato do estado real do protótipo no instante da pergunta.
 *
 * O assistente não tem modelo nem backend: toda resposta com número sai daqui,
 * dos mesmos valores que a interface está exibindo. Campos ausentes ou `null`
 * significam dado indisponível e produzem uma resposta honesta de
 * indisponibilidade, nunca um número inventado.
 */
export interface HelpAssistantLiveSnapshot {
  market: HelpAssistantMarketSnapshot
  now: number
  pendingRoundsCount: number
  position: Record<OutcomeSide, number>
  positionCostCents: Record<OutcomeSide, number>
  previousRounds: HelpAssistantPreviousRound[]
  quoteBuy?: (side: OutcomeSide, amount: number) => ExecutionQuote | null
  quoteSell?: (side: OutcomeSide, participations: number) => ExecutionQuote | null
  round: HelpAssistantRoundSnapshot
  /** Entradas já liquidadas, em qualquer ordem. */
  settledEntries: HelpAssistantSettledEntry[]
  wallet: HelpAssistantWalletSnapshot
}

export interface HelpAssistantSettledEntry {
  amountCents: number
  outcome: 'won' | 'lost' | 'canceled' | 'sold'
  participations: number
  payoutCents: number
  roundEnd: number
  side: OutcomeSide
}

export interface HelpAssistantMarketSnapshot {
  prices: Record<OutcomeSide, number | null>
  status: OutcomeMarketStatus
}

export interface HelpAssistantPreviousRound {
  result: OutcomeSide
  roundStart: number
}

export interface HelpAssistantRoundSnapshot {
  currentPrice: number | null
  endTime: string
  isClosing: boolean
  remainingSeconds: number
  targetPrice: number | null
}

export interface HelpAssistantWalletSnapshot {
  availableBalanceCents: number
  netResultCents: number
  openEntriesCents: number
  portfolioTotalCents: number
}

export interface HelpAssistantSnapshotInput {
  isRoundClosing: boolean
  market: HelpAssistantMarketSnapshot
  now: number
  pendingRoundStarts: number[]
  position: Record<OutcomeSide, number>
  positionCostCents: Record<OutcomeSide, number>
  previousRounds: HelpAssistantPreviousRound[]
  quoteBuy?: (side: OutcomeSide, amount: number) => ExecutionQuote | null
  quoteSell?: (side: OutcomeSide, participations: number) => ExecutionQuote | null
  round: {
    currentPrice: number | null
    endTime: string
    remainingSeconds: number
    targetPrice: number | null
  }
  settledEntries: HelpAssistantSettledEntry[]
  wallet: HelpAssistantWalletSnapshot
}

export const buildHelpAssistantSnapshot = (
  input: HelpAssistantSnapshotInput,
): HelpAssistantLiveSnapshot => ({
  market: input.market,
  now: input.now,
  pendingRoundsCount: input.pendingRoundStarts.length,
  position: input.position,
  positionCostCents: input.positionCostCents,
  previousRounds: input.previousRounds,
  quoteBuy: input.quoteBuy,
  quoteSell: input.quoteSell,
  round: {
    currentPrice: input.round.currentPrice,
    endTime: input.round.endTime,
    isClosing: input.isRoundClosing,
    remainingSeconds: input.round.remainingSeconds,
    targetPrice: input.round.targetPrice,
  },
  settledEntries: input.settledEntries,
  wallet: input.wallet,
})

export const hasLivePrices = (
  snapshot: HelpAssistantLiveSnapshot,
): snapshot is HelpAssistantLiveSnapshot & {
  market: { prices: Record<OutcomeSide, number> }
} => (
  snapshot.market.prices.up !== null
  && snapshot.market.prices.down !== null
  && snapshot.market.status !== 'unavailable'
)

export const getPositionSide = (
  snapshot: HelpAssistantLiveSnapshot,
): OutcomeSide | null => {
  const hasUp = snapshot.position.up > 0
  const hasDown = snapshot.position.down > 0

  if (hasUp && hasDown) return null
  if (hasUp) return 'up'
  if (hasDown) return 'down'
  return null
}

export const hasAnyPosition = (snapshot: HelpAssistantLiveSnapshot) => (
  snapshot.position.up > 0 || snapshot.position.down > 0
)
