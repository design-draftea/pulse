import type { OutcomeSide } from './outcomeMarket'

export const PROTOTYPE_WALLET_STORAGE_KEY = 'pulse.prototype-wallet.v1'
export const PROTOTYPE_WALLET_VERSION = 1
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

export interface PrototypeWalletState {
  version: typeof PROTOTYPE_WALLET_VERSION
  balanceCents: number
  positionsByRound: Record<string, PrototypeWalletPosition>
  creditedEventIds: string[]
  movements: PrototypeWalletMovement[]
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
  update: Pick<
    PrototypeWalletState,
    'balanceCents' | 'positionsByRound' | 'creditedEventIds' | 'movements'
  >,
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
    const movements = normalizeMovements(parsed.movements, parsed.updatedAt)

    return {
      version: PROTOTYPE_WALLET_VERSION,
      balanceCents: parsed.balanceCents,
      positionsByRound,
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
  delete positionsByRound[key]

  if (state.creditedEventIds.includes(eventId)) {
    const nextState = updateWallet(state, {
      balanceCents: state.balanceCents,
      positionsByRound,
      creditedEventIds: state.creditedEventIds,
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
    positionsByRound: state.positionsByRound,
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
