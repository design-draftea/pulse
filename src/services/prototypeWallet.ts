import type { OutcomeSide } from './outcomeMarket'

export const PROTOTYPE_WALLET_STORAGE_KEY = 'pulse.prototype-wallet.v1'
export const PROTOTYPE_WALLET_VERSION = 1
export const INITIAL_BALANCE_CENTS = 200_000

const MAX_CREDIT_EVENT_IDS = 100
const PARTICIPATION_EPSILON = 1e-8

export interface PrototypeWalletPosition {
  up: number
  down: number
}

export interface PrototypeWalletState {
  version: typeof PROTOTYPE_WALLET_VERSION
  balanceCents: number
  positionsByRound: Record<string, PrototypeWalletPosition>
  creditedEventIds: string[]
  revision: number
  updatedAt: number
}

export interface WalletMutationResult {
  state: PrototypeWalletState
  applied: boolean
  balanceDeltaCents: number
}

export interface WalletSettlementResult extends WalletMutationResult {
  payoutCents: number
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

const isNonNegativeFinite = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
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
  update: Pick<
    PrototypeWalletState,
    'balanceCents' | 'positionsByRound' | 'creditedEventIds'
  >,
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
  creditedEventIds: [],
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

    return {
      version: PROTOTYPE_WALLET_VERSION,
      balanceCents: parsed.balanceCents,
      positionsByRound,
      creditedEventIds,
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
  const positionsByRound = {
    ...state.positionsByRound,
    [key]: {
      ...position,
      [side]: position[side] + participations,
    },
  }
  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents - amountCents,
    positionsByRound,
    creditedEventIds: state.creditedEventIds,
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

  if (
    remainingPosition.up <= PARTICIPATION_EPSILON
    && remainingPosition.down <= PARTICIPATION_EPSILON
  ) {
    delete positionsByRound[key]
  } else {
    positionsByRound[key] = remainingPosition
  }

  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents + amountReceivedCents,
    positionsByRound,
    creditedEventIds: state.creditedEventIds,
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
  delete positionsByRound[key]

  if (state.creditedEventIds.includes(eventId)) {
    const nextState = updateWallet(state, {
      balanceCents: state.balanceCents,
      positionsByRound,
      creditedEventIds: state.creditedEventIds,
    })

    return {
      state: nextState,
      applied: false,
      balanceDeltaCents: 0,
      payoutCents: 0,
    }
  }

  const payoutCents = Math.max(0, Math.round(position[winner] * 100))
  const nextState = updateWallet(state, {
    balanceCents: state.balanceCents + payoutCents,
    positionsByRound,
    creditedEventIds: nextCreditEventIds(
      state.creditedEventIds,
      eventId,
    ),
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
    positionsByRound: state.positionsByRound,
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
