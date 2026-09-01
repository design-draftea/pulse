import type { OutcomeSide } from './outcomeMarket'

export const PROTOTYPE_WALLET_STORAGE_KEY = 'pulse.prototype-wallet.v2'
export const LEGACY_PROTOTYPE_WALLET_STORAGE_KEY = 'pulse.prototype-wallet.v1'
export const PROTOTYPE_WALLET_VERSION = 2
export const INITIAL_BALANCE_CENTS = 200_000

const MAX_CREDIT_EVENT_IDS = 100
const MAX_MOVEMENTS = 100
const PARTICIPATION_EPSILON = 1e-8
const INITIAL_DEPOSIT_MOVEMENT_ID = 'initial-deposit'

export type WalletMovementType =
  | 'deposit'
  | 'withdrawal'
  | 'purchase'
  | 'sale'
  | 'win'
  | 'cancellation'

export interface PrototypeWalletMovement {
  id: string
  type: WalletMovementType
  amountCents: number
  occurredAt: number
  roundStart?: number
  side?: OutcomeSide
}

export interface PrototypeWalletPosition {
  up: number
  down: number
}

export interface PrototypeWalletCostBasis {
  up: number
  down: number
}

export interface PrototypeWalletState {
  version: typeof PROTOTYPE_WALLET_VERSION
  balanceCents: number
  positionsByRound: Record<string, PrototypeWalletPosition>
  costBasisCentsByRound: Record<string, PrototypeWalletCostBasis>
  totalPurchasesCents: number
  totalReceivedCents: number
  creditedEventIds: string[]
  movements: PrototypeWalletMovement[]
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

const isWalletMovementType = (value: unknown): value is WalletMovementType => (
  value === 'deposit'
  || value === 'withdrawal'
  || value === 'purchase'
  || value === 'sale'
  || value === 'win'
  || value === 'cancellation'
)

const hasValidMovementAmount = (
  type: WalletMovementType,
  amountCents: number,
) => (
  type === 'purchase' || type === 'withdrawal'
    ? amountCents < 0
    : amountCents > 0
)

const createInitialDepositMovement = (
  occurredAt: number,
): PrototypeWalletMovement => ({
  id: INITIAL_DEPOSIT_MOVEMENT_ID,
  type: 'deposit',
  amountCents: INITIAL_BALANCE_CENTS,
  occurredAt,
})

const normalizeMovement = (
  value: unknown,
): PrototypeWalletMovement | null => {
  if (typeof value !== 'object' || value === null) return null

  const movement = value as Partial<PrototypeWalletMovement>

  if (
    typeof movement.id !== 'string'
    || movement.id.length === 0
    || !isWalletMovementType(movement.type)
    || typeof movement.amountCents !== 'number'
    || !Number.isInteger(movement.amountCents)
    || !hasValidMovementAmount(movement.type, movement.amountCents)
    || !isNonNegativeFinite(movement.occurredAt)
    || (
      movement.roundStart !== undefined
      && !isValidRoundStart(movement.roundStart)
    )
    || (
      movement.side !== undefined
      && movement.side !== 'up'
      && movement.side !== 'down'
    )
  ) {
    return null
  }

  return {
    id: movement.id,
    type: movement.type,
    amountCents: movement.amountCents,
    occurredAt: movement.occurredAt,
    ...(movement.roundStart === undefined
      ? {}
      : { roundStart: movement.roundStart }),
    ...(movement.side === undefined ? {} : { side: movement.side }),
  }
}

const normalizeMovements = (
  values: unknown,
  fallbackInitialDepositOccurredAt: number,
) => {
  const parsedMovements = Array.isArray(values)
    ? values
      .map(normalizeMovement)
      .filter((movement): movement is PrototypeWalletMovement => movement !== null)
    : []
  const initialDeposit = parsedMovements.find(
    ({ id }) => id === INITIAL_DEPOSIT_MOVEMENT_ID,
  )
  const normalized = parsedMovements.filter(
    ({ id }) => id !== INITIAL_DEPOSIT_MOVEMENT_ID,
  )
  const unique = normalized.filter((movement, index, movements) => (
    movements.findLastIndex(({ id }) => id === movement.id) === index
  ))

  return [
    createInitialDepositMovement(
      initialDeposit?.occurredAt ?? fallbackInitialDepositOccurredAt,
    ),
    ...unique.slice(-(MAX_MOVEMENTS - 1)),
  ]
}

const appendMovement = (
  state: PrototypeWalletState,
  movement: PrototypeWalletMovement,
) => normalizeMovements(
  [...state.movements, movement],
  state.movements[0]?.occurredAt ?? state.updatedAt,
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
    | 'movements'
  >>,
): PrototypeWalletState => ({
  ...state,
  ...update,
  revision: state.revision + 1,
  updatedAt: Date.now(),
})

export const createInitialWalletState = (): PrototypeWalletState => {
  const createdAt = Date.now()

  return {
    version: PROTOTYPE_WALLET_VERSION,
    balanceCents: INITIAL_BALANCE_CENTS,
    positionsByRound: {},
    costBasisCentsByRound: {},
    totalPurchasesCents: 0,
    totalReceivedCents: 0,
    creditedEventIds: [],
    movements: [createInitialDepositMovement(createdAt)],
    revision: 0,
    updatedAt: createdAt,
  }
}

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
    const costBasisCentsByRound = Object.entries(positionsByRound)
      .reduce<Record<string, PrototypeWalletCostBasis>>((costBasis, [key]) => {
        const value = parsed.costBasisCentsByRound?.[key] as Partial<PrototypeWalletCostBasis> | undefined

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

    if (Object.keys(costBasisCentsByRound).length !== Object.keys(positionsByRound).length) {
      return createInitialWalletState()
    }
    const movements = normalizeMovements(parsed.movements, parsed.updatedAt)

    return {
      version: PROTOTYPE_WALLET_VERSION,
      balanceCents: parsed.balanceCents,
      positionsByRound,
      costBasisCentsByRound,
      totalPurchasesCents: parsed.totalPurchasesCents,
      totalReceivedCents: parsed.totalReceivedCents,
      creditedEventIds,
      movements,
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
    movements: appendMovement(state, {
      id: `purchase:${roundStart}:${side}:${state.revision + 1}`,
      type: 'purchase',
      amountCents: -amountCents,
      occurredAt: Date.now(),
      roundStart,
      side,
    }),
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
    movements: appendMovement(state, {
      id: `sale:${roundStart}:${side}:${state.revision + 1}`,
      type: 'sale',
      amountCents: amountReceivedCents,
      occurredAt: Date.now(),
      roundStart,
      side,
    }),
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
  const costBasisCentsByRound = { ...state.costBasisCentsByRound }
  delete positionsByRound[key]
  delete costBasisCentsByRound[key]

  if (state.creditedEventIds.includes(eventId)) {
    const nextState = updateWallet(state, {
      balanceCents: state.balanceCents,
      positionsByRound,
      costBasisCentsByRound,
      movements: state.movements,
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
    costBasisCentsByRound,
    totalReceivedCents: state.totalReceivedCents + payoutCents,
    creditedEventIds: nextCreditEventIds(
      state.creditedEventIds,
      eventId,
    ),
    movements: payoutCents > 0
      ? appendMovement(state, {
        id: `win:${roundStart}`,
        type: 'win',
        amountCents: payoutCents,
        occurredAt: Date.now(),
        roundStart,
        side: winner,
      })
      : state.movements,
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
    movements: appendMovement(state, {
      id: `win:${eventId}`,
      type: 'win',
      amountCents,
      occurredAt: Date.now(),
    }),
  })

  return {
    state: nextState,
    applied: true,
    balanceDeltaCents: amountCents,
  }
}
