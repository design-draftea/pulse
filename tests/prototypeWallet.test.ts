import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyWalletPurchase,
  applyWalletSale,
  creditWalletEvent,
  createInitialWalletState,
  deserializeWalletState,
  getPendingWalletRoundStarts,
  getWalletCostBasis,
  getWalletProfileMetrics,
  getWalletPosition,
  INITIAL_DEPOSIT_CENTS,
  PROTOTYPE_WALLET_VERSION,
  SEEDED_AVAILABLE_BALANCE_CENTS,
  settleWalletRound,
  type PrototypeWalletState,
} from '../src/services/prototypeWallet.ts'

const ROUND_START = 1_777_777_500_000

const createOperationTestWallet = (): PrototypeWalletState => {
  const wallet = createInitialWalletState()

  return {
    ...wallet,
    balanceCents: INITIAL_DEPOSIT_CENTS,
    totalPurchasesCents: 0,
    totalReceivedCents: 0,
    movements: [wallet.movements[0]],
    settledEntries: [],
  }
}

const localDayNumber = (timestamp: number) => {
  const date = new Date(timestamp)

  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

test('inicia a carteira-persona com depósito, histórico e sem posições abertas', () => {
  const wallet = createInitialWalletState()
  const profileMetrics = getWalletProfileMetrics(wallet, ROUND_START, null)

  assert.equal(wallet.balanceCents, SEEDED_AVAILABLE_BALANCE_CENTS)
  assert.equal(wallet.version, PROTOTYPE_WALLET_VERSION)
  assert.deepEqual(wallet.positionsByRound, {})
  assert.deepEqual(wallet.costBasisCentsByRound, {})
  assert.equal(wallet.totalPurchasesCents, 32_000)
  assert.equal(wallet.totalReceivedCents, 36_000)
  assert.deepEqual(wallet.creditedEventIds, [])
  assert.deepEqual(
    wallet.movements.map(({ type, amountCents }) => ({
      amountCents,
      type,
    })),
    [
      { type: 'deposit', amountCents: INITIAL_DEPOSIT_CENTS },
      { type: 'purchase', amountCents: -10_000 },
      { type: 'win', amountCents: 16_000 },
      { type: 'purchase', amountCents: -6_000 },
      { type: 'purchase', amountCents: -12_000 },
      { type: 'win', amountCents: 20_000 },
      { type: 'purchase', amountCents: -4_000 },
    ],
  )
  assert.deepEqual(
    wallet.settledEntries.map((entry) => ({
      amountCents: entry.amountCents,
      finalPrice: entry.finalPrice,
      outcome: entry.outcome,
      participations: entry.participations,
      payoutCents: entry.payoutCents,
      side: entry.side,
      targetPrice: entry.targetPrice,
    })),
    [
      {
        side: 'up',
        outcome: 'won',
        amountCents: 10_000,
        participations: 160,
        payoutCents: 16_000,
        targetPrice: 80_014.42,
        finalPrice: 80_031.15,
      },
      {
        side: 'down',
        outcome: 'lost',
        amountCents: 6_000,
        participations: 75,
        payoutCents: 0,
        targetPrice: 80_214.63,
        finalPrice: 80_236.19,
      },
      {
        side: 'down',
        outcome: 'won',
        amountCents: 12_000,
        participations: 200,
        payoutCents: 20_000,
        targetPrice: 80_327.58,
        finalPrice: 80_294.11,
      },
      {
        side: 'up',
        outcome: 'lost',
        amountCents: 4_000,
        participations: 100,
        payoutCents: 0,
        targetPrice: 80_266.34,
        finalPrice: 80_252.91,
      },
    ],
  )
  assert.deepEqual(profileMetrics, {
    availableBalanceCents: SEEDED_AVAILABLE_BALANCE_CENTS,
    portfolioTotalCents: SEEDED_AVAILABLE_BALANCE_CENTS,
    totalPurchasesCents: 32_000,
    openEntriesCents: 0,
    totalReceivedCents: 36_000,
    netResultCents: 4_000,
  })

  const createdLocalDay = localDayNumber(wallet.updatedAt)
  assert.equal(
    createdLocalDay - localDayNumber(wallet.movements[0].occurredAt),
    4 * 24 * 60 * 60 * 1000,
  )
  assert.deepEqual(
    wallet.settledEntries.map(({ roundStart, roundEnd }) => {
      const start = new Date(roundStart)

      return {
        daysAgo: (createdLocalDay - localDayNumber(roundStart))
          / (24 * 60 * 60 * 1000),
        hour: start.getHours(),
        minute: start.getMinutes(),
        duration: roundEnd - roundStart,
      }
    }),
    [
      { daysAgo: 3, hour: 10, minute: 0, duration: 900_000 },
      { daysAgo: 2, hour: 15, minute: 15, duration: 900_000 },
      { daysAgo: 1, hour: 9, minute: 30, duration: 900_000 },
      { daysAgo: 1, hour: 16, minute: 45, duration: 900_000 },
    ],
  )
})

test('compra do usuário cria a única posição aberta sem alterar o histórico inicial', () => {
  const wallet = createInitialWalletState()
  const originalSettledEntries = wallet.settledEntries
  const result = applyWalletPurchase(wallet, {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 10_000,
    participations: 125,
  })

  assert.equal(result.applied, true)
  assert.equal(result.state.balanceCents, SEEDED_AVAILABLE_BALANCE_CENTS - 10_000)
  assert.deepEqual(result.state.positionsByRound, {
    [String(ROUND_START)]: { up: 125, down: 0 },
  })
  assert.equal(Object.keys(result.state.positionsByRound).length, 1)
  assert.deepEqual(result.state.settledEntries, originalSettledEntries)
  assert.equal(result.state.totalPurchasesCents, 42_000)
  assert.equal(result.state.movements.length, 8)
})

test('restaura uma entrada cancelada junto do histórico de movimientos', () => {
  const wallet = createInitialWalletState()
  wallet.settledEntries = [{
    id: `${ROUND_START}:down:canceled`,
    roundStart: ROUND_START,
    roundEnd: ROUND_START + 900_000,
    side: 'down',
    outcome: 'canceled',
    amountCents: 20_000,
    participations: 588.24,
    payoutCents: 0,
    targetPrice: 80_194.33,
    finalPrice: 80_195.64,
  }]

  const restored = deserializeWalletState(JSON.stringify(wallet))

  assert.deepEqual(restored.settledEntries, wallet.settledEntries)
  assert.deepEqual(restored.movements, wallet.movements)
})

test('restaura uma carteira v3 válida e reinicia versões anteriores ou estado inválido', () => {
  const wallet = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 10_000,
    participations: 149.25,
  }).state

  assert.deepEqual(
    deserializeWalletState(JSON.stringify(wallet)),
    wallet,
  )
  const legacyWallet: Record<string, unknown> = { ...wallet }
  delete legacyWallet.movements
  const migratedWallet = deserializeWalletState(JSON.stringify(legacyWallet))

  assert.equal(migratedWallet.movements.length, 1)
  assert.equal(migratedWallet.movements[0]?.type, 'deposit')
  assert.equal(
    migratedWallet.movements[0]?.amountCents,
    INITIAL_DEPOSIT_CENTS,
  )
  const depositTimestamp = wallet.movements[0]?.occurredAt
  const restoredAfterLaterUpdate = deserializeWalletState(JSON.stringify({
    ...wallet,
    updatedAt: wallet.updatedAt + 60_000,
  }))

  assert.equal(
    restoredAfterLaterUpdate.movements[0]?.occurredAt,
    depositTimestamp,
  )
  assert.equal(
    deserializeWalletState('{"version":1,"balanceCents":200000}').version,
    PROTOTYPE_WALLET_VERSION,
  )
  assert.equal(
    deserializeWalletState(JSON.stringify({
      ...wallet,
      version: 2,
      balanceCents: 1,
    })).balanceCents,
    SEEDED_AVAILABLE_BALANCE_CENTS,
  )
  assert.equal(
    deserializeWalletState('{"version":3,"balanceCents":-1}').balanceCents,
    SEEDED_AVAILABLE_BALANCE_CENTS,
  )
  assert.deepEqual(
    deserializeWalletState('{"version":1,"balanceCents":200000}').positionsByRound,
    {},
  )
})

test('compra parcial desconta centavos e adiciona a posição correta', () => {
  const result = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 12_345,
    participations: 150.75,
  })

  assert.equal(result.applied, true)
  assert.equal(result.balanceDeltaCents, -12_345)
  assert.equal(result.state.balanceCents, 187_655)
  assert.deepEqual(getWalletPosition(result.state, ROUND_START), {
    up: 0,
    down: 150.75,
  })
  assert.deepEqual(
    result.state.movements.map(({ type, amountCents }) => ({
      type,
      amountCents,
    })),
    [
      { type: 'deposit', amountCents: INITIAL_DEPOSIT_CENTS },
      { type: 'purchase', amountCents: -12_345 },
    ],
  )
  assert.deepEqual(getWalletCostBasis(result.state, ROUND_START), {
    up: 0,
    down: 12_345,
  })
  assert.equal(result.state.totalPurchasesCents, 12_345)
  assert.equal(result.state.totalReceivedCents, 0)
})

test('permite usar todo o saldo e bloqueia compra acima dele', () => {
  const allIn = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: INITIAL_DEPOSIT_CENTS,
    participations: 2_500,
  })
  const rejected = applyWalletPurchase(allIn.state, {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 1,
    participations: 1,
  })

  assert.equal(allIn.applied, true)
  assert.equal(allIn.state.balanceCents, 0)
  assert.equal(rejected.applied, false)
  assert.equal(rejected.state, allIn.state)
})

test('venda parcial e total creditam o grossValue sem deixar posição negativa', () => {
  const purchased = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 10_000,
    participations: 100,
  }).state
  const partial = applyWalletSale(purchased, {
    roundStart: ROUND_START,
    side: 'up',
    amountReceivedCents: 3_333,
    participations: 40,
  })
  const total = applyWalletSale(partial.state, {
    roundStart: ROUND_START,
    side: 'up',
    amountReceivedCents: 4_500,
    participations: 60,
  })

  assert.equal(partial.state.balanceCents, 193_333)
  assert.equal(getWalletPosition(partial.state, ROUND_START).up, 60)
  assert.equal(getWalletCostBasis(partial.state, ROUND_START).up, 6_000)
  assert.equal(partial.state.totalReceivedCents, 3_333)
  assert.equal(total.state.balanceCents, 197_833)
  assert.deepEqual(total.state.positionsByRound, {})
  assert.deepEqual(
    total.state.movements.map(({ type, amountCents }) => ({
      type,
      amountCents,
    })),
    [
      { type: 'deposit', amountCents: INITIAL_DEPOSIT_CENTS },
      { type: 'purchase', amountCents: -10_000 },
      { type: 'sale', amountCents: 3_333 },
      { type: 'sale', amountCents: 4_500 },
    ],
  )
  assert.deepEqual(total.state.costBasisCentsByRound, {})
  assert.equal(total.state.totalReceivedCents, 7_833)
})

test('liquida somente as participações restantes do lado vencedor', () => {
  const withUp = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 10_000,
    participations: 149.25,
  }).state
  const withBoth = applyWalletPurchase(withUp, {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 5_000,
    participations: 60,
  }).state
  const sold = applyWalletSale(withBoth, {
    roundStart: ROUND_START,
    side: 'up',
    amountReceivedCents: 2_000,
    participations: 20,
  }).state
  const settled = settleWalletRound(sold, ROUND_START, 'up', {
    roundEnd: ROUND_START + 900_000,
    targetPrice: 80_194.33,
    finalPrice: 80_195.64,
  })

  assert.equal(settled.payoutCents, 12_925)
  assert.equal(settled.state.balanceCents, 199_925)
  assert.deepEqual(settled.state.positionsByRound, {})
  assert.deepEqual(
    settled.state.movements.at(-1),
    {
      id: `win:${ROUND_START}`,
      type: 'win',
      amountCents: 12_925,
      occurredAt: settled.state.movements.at(-1)?.occurredAt,
      roundStart: ROUND_START,
      side: 'up',
    },
  )
  assert.deepEqual(settled.state.costBasisCentsByRound, {})
  assert.equal(settled.state.totalPurchasesCents, 15_000)
  assert.equal(settled.state.totalReceivedCents, 14_925)
  assert.deepEqual(settled.state.settledEntries.map((entry) => ({
    side: entry.side,
    outcome: entry.outcome,
    amountCents: entry.amountCents,
    participations: entry.participations,
    payoutCents: entry.payoutCents,
    targetPrice: entry.targetPrice,
    finalPrice: entry.finalPrice,
  })), [
    {
      side: 'down',
      outcome: 'lost',
      amountCents: 5_000,
      participations: 60,
      payoutCents: 0,
      targetPrice: 80_194.33,
      finalPrice: 80_195.64,
    },
    {
      side: 'up',
      outcome: 'won',
      amountCents: 8_660,
      participations: 129.25,
      payoutCents: 12_925,
      targetPrice: 80_194.33,
      finalPrice: 80_195.64,
    },
  ])
})

test('derrota remove a posição sem crédito', () => {
  const purchased = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 10_000,
    participations: 125,
  }).state
  const settled = settleWalletRound(purchased, ROUND_START, 'up')

  assert.equal(settled.payoutCents, 0)
  assert.equal(settled.state.balanceCents, 190_000)
  assert.deepEqual(settled.state.positionsByRound, {})
  assert.deepEqual(
    settled.state.movements.map(({ type }) => type),
    ['deposit', 'purchase'],
  )
  assert.deepEqual(settled.state.costBasisCentsByRound, {})
  assert.equal(settled.state.totalReceivedCents, 0)
})

test('vitória DOWN paga somente as participações DOWN', () => {
  const withDown = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 8_000,
    participations: 112.34,
  }).state
  const withBoth = applyWalletPurchase(withDown, {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 4_000,
    participations: 50,
  }).state
  const settled = settleWalletRound(withBoth, ROUND_START, 'down')

  assert.equal(settled.payoutCents, 11_234)
  assert.equal(settled.state.balanceCents, 199_234)
})

test('compra seguida de venda total não gera pagamento no encerramento', () => {
  const purchased = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 10_000,
    participations: 100,
  }).state
  const sold = applyWalletSale(purchased, {
    roundStart: ROUND_START,
    side: 'up',
    amountReceivedCents: 7_500,
    participations: 100,
  }).state
  const settled = settleWalletRound(sold, ROUND_START, 'up')

  assert.equal(settled.applied, false)
  assert.equal(settled.payoutCents, 0)
  assert.equal(settled.state.balanceCents, 197_500)
})

test('identifica rodadas pendentes restauradas após F5', () => {
  const oldRound = ROUND_START - 900_000
  const currentRound = ROUND_START + 900_000
  const withOldPosition = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: oldRound,
    side: 'up',
    amountCents: 10_000,
    participations: 100,
  }).state

  const restored = deserializeWalletState(JSON.stringify(withOldPosition))
  const settled = settleWalletRound(restored, oldRound, 'up')

  assert.deepEqual(
    getPendingWalletRoundStarts(restored, currentRound),
    [oldRound],
  )
  assert.equal(settled.payoutCents, 10_000)
  assert.equal(settled.state.balanceCents, INITIAL_DEPOSIT_CENTS)
})

test('protege liquidação e crédito de demonstração contra duplicidade', () => {
  const purchased = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 10_000,
    participations: 100,
  }).state
  const firstSettlement = settleWalletRound(purchased, ROUND_START, 'up')
  const duplicateSettlement = settleWalletRound(
    firstSettlement.state,
    ROUND_START,
    'up',
  )
  const firstDemo = creditWalletEvent(
    duplicateSettlement.state,
    `preview-win:${ROUND_START}`,
    14_925,
  )
  const duplicateDemo = creditWalletEvent(
    firstDemo.state,
    `preview-win:${ROUND_START}`,
    14_925,
  )

  assert.equal(firstSettlement.payoutCents, 10_000)
  assert.equal(duplicateSettlement.payoutCents, 0)
  assert.equal(firstDemo.applied, true)
  assert.equal(duplicateDemo.applied, false)
  assert.equal(duplicateDemo.state.balanceCents, 214_925)
  assert.equal(
    duplicateDemo.state.movements.filter(({ type }) => type === 'win').length,
    2,
  )
  assert.equal(duplicateDemo.state.totalReceivedCents, 24_925)
})

test('calcula métricas de perfil pelo preço atual e usa custo nas rodadas pendentes', () => {
  const previousRound = ROUND_START - 900_000
  const withPending = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: previousRound,
    side: 'down',
    amountCents: 5_000,
    participations: 60,
  }).state
  const withCurrent = applyWalletPurchase(withPending, {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 10_000,
    participations: 149.25,
  }).state
  const metrics = getWalletProfileMetrics(withCurrent, ROUND_START, 12_000)

  assert.deepEqual(metrics, {
    availableBalanceCents: 185_000,
    portfolioTotalCents: 202_000,
    totalPurchasesCents: 15_000,
    openEntriesCents: 17_000,
    totalReceivedCents: 0,
    netResultCents: 2_000,
  })
})

test('usa o custo da rodada atual quando a cotação de venda está indisponível', () => {
  const purchased = applyWalletPurchase(createOperationTestWallet(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 12_345,
    participations: 150.75,
  }).state

  assert.deepEqual(getWalletProfileMetrics(purchased, ROUND_START, null), {
    availableBalanceCents: 187_655,
    portfolioTotalCents: INITIAL_DEPOSIT_CENTS,
    totalPurchasesCents: 12_345,
    openEntriesCents: 12_345,
    totalReceivedCents: 0,
    netResultCents: 0,
  })
})
