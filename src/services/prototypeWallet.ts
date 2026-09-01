import type { OutcomeSide } from './outcomeMarket'

export const PROTOTYPE_WALLET_STORAGE_KEY = 'pulse.prototype-wallet.v2'
export const LEGACY_PROTOTYPE_WALLET_STORAGE_KEY = 'pulse.prototype-wallet.v1'
export const PROTOTYPE_WALLET_VERSION = 2
export const INITIAL_BALANCE_CENTS = 200_000

const MAX_CREDIT_EVENT_IDS = 100
const MAX_SETTLED_ENTRIES = 100
const PARTICIPATION_EPSILON = 1e-8
const ROUND_DURATION_MS = 15 * 60 * 1000

export interface PrototypeWalletPosition {
  up: number
  down: number
}

export interface PrototypeWalletCostBasis {
  up: number
  down: number
}

export interface PrototypeWalletSettledEntry {
  id: string
  roundStart: number
  roundEnd: number
  side: OutcomeSide
  outcome: 'won' | 'lost' | 'canceled'
  amountCents: number
  participations: number
  payoutCents: number
  targetPrice: number | null
  finalPrice: number | null
}

export interface PrototypeWalletState {
  version: typeof PROTOTYPE_WALLET_VERSION
  balanceCents: number
  positionsByRound: Record<string, PrototypeWalletPosition>
  costBasisCentsByRound: Record<string, PrototypeWalletCostBasis>
  totalPurchasesCents: number
  totalReceivedCents: number
  creditedEventIds: string[]
  settledEntries: PrototypeWalletSettledEntry[]
  revision: number
  updatedAt: number
}

export interface PrototypeWalletProfileMetrics {
  availableBalanceCents: number
  portfolioTotalCents: number
  totalPurchasesCents: number
  openEntriesCents: number
  totalReceivedCents: number
  netResultCents: number
}

export interface WalletMutationResult {
  state: PrototypeWalletState
  applied: boolean
  balanceDeltaCents: number
}

export interface WalletSettlementResult extends WalletMutationResult {
  payoutCents: number
}

export interface WalletRoundResultDetails {
  roundEnd?: number
  targetPrice?: number | null
  finalPrice?: number | null
}

interface WalletPurchase {
  roundStart: number
  side: OutcomeSide
  amountCents: number
  participations: number
}

interface WalletSale {
  roundStart: number
  side: OutcomeSide
  amountReceivedCents: number
  participations: number
}

const emptyPosition = (): PrototypeWalletPosition => ({ up: 0, down: 0 })
const emptyCostBasis = (): PrototypeWalletCostBasis => ({ up: 0, down: 0 })

const isNonNegativeFinite = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
)

const isNonNegativeInteger = (value: unknown): value is number => (
  Number.isInteger(value) && isNonNegativeFinite(value)
)

const isValidRoundStart = (value: number) => (
  Number.isInteger(value) && value > 0
)

const nextCreditEventIds = (eventIds: string[], eventId: string) => (
  [...eventIds.filter((value) => value !== eventId), eventId]
    .slice(-MAX_CREDIT_EVENT_IDS)
)

const updateWallet = (
  state: PrototypeWalletState,
  update: Partial<Pick<
    PrototypeWalletState,
    | 'balanceCents'
    | 'positionsByRound'
    | 'costBasisCentsByRound'
    | 'totalPurchasesCents'
    | 'totalReceivedCents'
    | 'creditedEventIds'
    | 'settledEntries'
  >>,
): PrototypeWalletState => ({
  ...state,
  ...update,
  revision: state.revision + 1,
  updatedAt: Date.now(),
})

export const createInitialWalletState = (): PrototypeWalletState => ({
  version: PROTOTYPE_WALLET_VERSION,
  balanceCents: INITIAL_BALANCE_CENTS,
  positionsByRound: {},
  costBasisCentsByRound: {},
  totalPurchasesCents: 0,
  totalReceivedCents: 0,
  creditedEventIds: [],
  settledEntries: [],
  revision: 0,
  updatedAt: Date.now(),
})

export const deserializeWalletState = (
  serialized: string | null,
): PrototypeWalletState => {
  if (!serialized) return createInitialWalletState()

  try {
    const parsed = JSON.parse(serialized) as Partial<PrototypeWalletState>

    if (
      parsed.version !== PROTOTYPE_WALLET_VERSION
      || !Number.isInteger(parsed.balanceCents)
      || !isNonNegativeFinite(parsed.balanceCents)
      || typeof parsed.positionsByRound !== 'object'
      || parsed.positionsByRound === null
      || typeof parsed.costBasisCentsByRound !== 'object'
      || parsed.costBasisCentsByRound === null
      || !isNonNegativeInteger(parsed.totalPurchasesCents)
      || !isNonNegativeInteger(parsed.totalReceivedCents)
      || !Array.isArray(parsed.creditedEventIds)
      || !Number.isInteger(parsed.revision)
      || !isNonNegativeFinite(parsed.revision)
      || !isNonNegativeFinite(parsed.updatedAt)
    ) {
      return createInitialWalletState()
    }

    const positionsByRound = Object.entries(parsed.positionsByRound)
      .reduce<Record<string, PrototypeWalletPosition>>((positions, [key, value]) => {
        const roundStart = Number(key)
        const position = value as Partial<PrototypeWalletPosition>

        if (
          !isValidRoundStart(roundStart)
          || !isNonNegativeFinite(position.up)
          || !isNonNegativeFinite(position.down)
          || (position.up <= PARTICIPATION_EPSILON
            && position.down <= PARTICIPATION_EPSILON)
        ) {
          return positions
        }

        positions[key] = {
          up: position.up,
          down: position.down,
        }
        return positions
      }, {})
    const creditedEventIds = [...new Set(
      parsed.creditedEventIds.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    )].slice(-MAX_CREDIT_EVENT_IDS)
    const settledEntries: PrototypeWalletSettledEntry[] = Array.isArray(parsed.settledEntries)
      ? parsed.settledEntries.flatMap((rawEntry) => {
          const entry = rawEntry as Partial<PrototypeWalletSettledEntry>
          const hasValidPrices = (
            (entry.targetPrice === null
              || (typeof entry.targetPrice === 'number'
                && Number.isFinite(entry.targetPrice)
                && entry.targetPrice > 0))
            && (entry.finalPrice === null
              || (typeof entry.finalPrice === 'number'
                && Number.isFinite(entry.finalPrice)
                && entry.finalPrice > 0))
          )

          if (
            typeof entry.id !== 'string'
            || entry.id.length === 0
            || !isValidRoundStart(entry.roundStart ?? 0)
            || !Number.isInteger(entry.roundEnd)
            || (entry.roundEnd ?? 0) <= (entry.roundStart ?? 0)
            || (entry.side !== 'up' && entry.side !== 'down')
            || (
              entry.outcome !== 'won'
              && entry.outcome !== 'lost'
              && entry.outcome !== 'canceled'
            )
            || !isNonNegativeInteger(entry.amountCents)
            || !isNonNegativeFinite(entry.participations)
            || (entry.participations ?? 0) <= PARTICIPATION_EPSILON
            || !isNonNegativeInteger(entry.payoutCents)
            || !hasValidPrices
          ) return []

          return [{
            id: entry.id,
            roundStart: entry.roundStart,
            roundEnd: entry.roundEnd,
            side: entry.side,
            outcome: entry.outcome,
            amountCents: entry.amountCents,
            participations: entry.participations,
            payoutCents: entry.payoutCents,
            targetPrice: entry.targetPrice,
            finalPrice: entry.finalPrice,
          } as PrototypeWalletSettledEntry]
        }).filter((entry, index, entries) => (
          entries.findIndex(({ id }) => id === entry.id) === index
        )).slice(-MAX_SETTLED_ENTRIES)
      : []
    const costBasisCentsByRound = Object.entries(positionsByRound)
      .reduce<Record<string, PrototypeWalletCostBasis>>((costBasis, [key]) => {
        const value = parsed.costBasisCentsByRound?.[key] as
          | Partial<PrototypeWalletCostBasis>
          | undefined

        if (
          !value
          || !isNonNegativeInteger(value.up)
          || !isNonNegativeInteger(value.down)
        ) {
          return costBasis
        }

        costBasis[key] = {
          up: value.up,
          down: value.down,
        }
        return costBasis
      }, {})

    if (
      Object.keys(costBasisCentsByRound).length
      !== Object.keys(positionsByRound).length
    ) {
      return createInitialWalletState()
    }

    return {
      version: PROTOTYPE_WALLET_VERSION,
      balanceCents: parsed.balanceCents,
      positionsByRound,
      costBasisCentsByRound,
      totalPurchasesCents: parsed.totalPurchasesCents,
      totalReceivedCents: parsed.totalReceivedCents,
      creditedEventIds,
      settledEntries,
      revision: parsed.revision,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return createInitialWalletState()
  }
}

export const getWalletPosition = (
  state: PrototypeWalletState,
  roundStart: number,
): PrototypeWalletPosition => (
  state.positionsByRound[String(roundStart)] ?? emptyPosition()
)

export const getWalletCostBasis = (
  state: PrototypeWalletState,
  roundStart: number,
): PrototypeWalletCostBasis => (
  state.costBasisCentsByRound[String(roundStart)] ?? emptyCostBasis()
)

export const getWalletProfileMetrics = (
  state: PrototypeWalletState,
  currentRoundStart: number,
  currentRoundMarketValueCents: number | null,
): PrototypeWalletProfileMetrics => {
  const currentRoundKey = String(currentRoundStart)
  const currentRoundCostBasis = state.costBasisCentsByRound[currentRoundKey]
  const currentRoundFallbackCents = currentRoundCostBasis
    ? currentRoundCostBasis.up + currentRoundCostBasis.down
    : 0
  const currentRoundValueCents = isNonNegativeInteger(currentRoundMarketValueCents)
    ? currentRoundMarketValueCents
    : currentRoundFallbackCents
  const pendingEntriesCents = Object.entries(state.costBasisCentsByRound)
    .reduce((total, [roundKey, costBasis]) => (
      roundKey === currentRoundKey
        ? total
        : total + costBasis.up + costBasis.down
    ), 0)
  const openEntriesCents = currentRoundValueCents + pendingEntriesCents
  const portfolioTotalCents = state.balanceCents + openEntriesCents

  return {
    availableBalanceCents: state.balanceCents,
    portfolioTotalCents,
    totalPurchasesCents: state.totalPurchasesCents,
    openEntriesCents,
    totalReceivedCents: state.totalReceivedCents,
    netResultCents: portfolioTotalCents - INITIAL_BALANCE_CENTS,
  }
}

export const getPendingWalletRoundStarts = (
  state: PrototypeWalletState,
  currentRoundStart: number,
) => Object.keys(state.positionsByRound)
  .map(Number)
  .filter((roundStart) => (
    isValidRoundStart(roundStart) && roundStart < currentRoundStart
  ))
  .sort((first, second) => first - second)

export const applyWalletPurchase = (
  state: PrototypeWalletState,
  purchase: WalletPurchase,
): WalletMutationResult => {
  const {
    roundStart,
    side,
    amountCents,
    participations,
  } = purchase

  if (
    !isValidRoundStart(roundStart)
    || !Number.isInteger(amountCents)
    || amountCents <= 0
    || amountCents > state.balanceCents
    || !Number.isFinite(participations)
    || participations <= 0
  ) {
    return { state, applied: false, balanceDeltaCents: 0 }
  }

  const key = String(roundStart)
  const position = getWalletPosition(state, roundStart)
  const costBasis = getWalletCostBasis(state, roundStart)
  const positionsByRound = {
    ...state.positionsByRound,
    [key]: {
      ...position,
      [side]: position[side] + participations,
    },
  }
  const costBasisCentsByRound = {
    ...state.costBasisCentsByRound,
    [key]: {
      ...costBasis,
      [side]: costBasis[side] + amountCents,
    },
  }
  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents - amountCents,
    positionsByRound,
    costBasisCentsByRound,
    totalPurchasesCents: state.totalPurchasesCents + amountCents,
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: -amountCents,
  }
}

export const applyWalletSale = (
  state: PrototypeWalletState,
  sale: WalletSale,
): WalletMutationResult => {
  const {
    roundStart,
    side,
    amountReceivedCents,
    participations,
  } = sale
  const key = String(roundStart)
  const position = getWalletPosition(state, roundStart)
  const costBasis = getWalletCostBasis(state, roundStart)

  if (
    !isValidRoundStart(roundStart)
    || !Number.isInteger(amountReceivedCents)
    || amountReceivedCents < 0
    || !Number.isFinite(participations)
    || participations <= 0
    || participations > position[side] + PARTICIPATION_EPSILON
  ) {
    return { state, applied: false, balanceDeltaCents: 0 }
  }

  const remainingPosition = {
    ...position,
    [side]: Math.max(0, position[side] - participations),
  }
  const positionsByRound = { ...state.positionsByRound }
  const costBasisCentsByRound = { ...state.costBasisCentsByRound }
  const soldRatio = Math.min(1, participations / position[side])
  const soldCostBasisCents = Math.round(costBasis[side] * soldRatio)
  const remainingCostBasis = {
    ...costBasis,
    [side]: Math.max(0, costBasis[side] - soldCostBasisCents),
  }

  if (
    remainingPosition.up <= PARTICIPATION_EPSILON
    && remainingPosition.down <= PARTICIPATION_EPSILON
  ) {
    delete positionsByRound[key]
    delete costBasisCentsByRound[key]
  } else {
    positionsByRound[key] = remainingPosition
    costBasisCentsByRound[key] = remainingCostBasis
  }

  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents + amountReceivedCents,
    positionsByRound,
    costBasisCentsByRound,
    totalReceivedCents: state.totalReceivedCents + amountReceivedCents,
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: amountReceivedCents,
  }
}

export const settleWalletRound = (
  state: PrototypeWalletState,
  roundStart: number,
  winner: OutcomeSide,
  details: WalletRoundResultDetails = {},
): WalletSettlementResult => {
  const key = String(roundStart)
  const eventId = `round:${roundStart}`
  const position = state.positionsByRound[key]

  if (!position) {
    return {
      state,
      applied: false,
      balanceDeltaCents: 0,
      payoutCents: 0,
    }
  }

  const positionsByRound = { ...state.positionsByRound }
  const costBasis = getWalletCostBasis(state, roundStart)
  const costBasisCentsByRound = { ...state.costBasisCentsByRound }
  delete positionsByRound[key]
  delete costBasisCentsByRound[key]

  if (state.creditedEventIds.includes(eventId)) {
    const nextState = updateWallet(state, {
      balanceCents: state.balanceCents,
      positionsByRound,
      costBasisCentsByRound,
    })

    return {
      state: nextState,
      applied: false,
      balanceDeltaCents: 0,
      payoutCents: 0,
    }
  }

  const payoutCents = Math.max(0, Math.round(position[winner] * 100))
  const roundEnd = Number.isInteger(details.roundEnd)
    && (details.roundEnd ?? 0) > roundStart
    ? details.roundEnd as number
    : roundStart + ROUND_DURATION_MS
  const targetPrice = typeof details.targetPrice === 'number'
    && Number.isFinite(details.targetPrice)
    && details.targetPrice > 0
    ? details.targetPrice
    : null
  const finalPrice = typeof details.finalPrice === 'number'
    && Number.isFinite(details.finalPrice)
    && details.finalPrice > 0
    ? details.finalPrice
    : null
  const settledEntries = (['down', 'up'] as const).flatMap((side) => {
    if (position[side] <= PARTICIPATION_EPSILON) return []

    return [{
      id: `${roundStart}:${side}`,
      roundStart,
      roundEnd,
      side,
      outcome: side === winner ? 'won' as const : 'lost' as const,
      amountCents: costBasis[side],
      participations: position[side],
      payoutCents: side === winner
        ? Math.max(0, Math.round(position[side] * 100))
        : 0,
      targetPrice,
      finalPrice,
    }]
  })
  const nextSettledEntries = [
    ...(state.settledEntries ?? []).filter((entry) => (
      settledEntries.every(({ id }) => id !== entry.id)
    )),
    ...settledEntries,
  ].slice(-MAX_SETTLED_ENTRIES)
  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents + payoutCents,
    positionsByRound,
    costBasisCentsByRound,
    totalReceivedCents: state.totalReceivedCents + payoutCents,
    creditedEventIds: nextCreditEventIds(
      state.creditedEventIds,
      eventId,
    ),
    settledEntries: nextSettledEntries,
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: payoutCents,
    payoutCents,
  }
}

export const creditWalletEvent = (
  state: PrototypeWalletState,
  eventId: string,
  amountCents: number,
): WalletMutationResult => {
  if (
    !eventId
    || state.creditedEventIds.includes(eventId)
    || !Number.isInteger(amountCents)
    || amountCents <= 0
  ) {
    return { state, applied: false, balanceDeltaCents: 0 }
  }

  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents + amountCents,
    totalReceivedCents: state.totalReceivedCents + amountCents,
    creditedEventIds: nextCreditEventIds(
      state.creditedEventIds,
      eventId,
    ),
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: amountCents,
  }
}
