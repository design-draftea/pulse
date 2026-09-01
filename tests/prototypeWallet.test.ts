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
  INITIAL_BALANCE_CENTS,
  PROTOTYPE_WALLET_VERSION,
  settleWalletRound,
} from '../src/services/prototypeWallet.ts'

const ROUND_START = 1_777_777_500_000

test('inicia a carteira com US$ 2.000,00 e sem posições', () => {
  const wallet = createInitialWalletState()

  assert.equal(wallet.balanceCents, INITIAL_BALANCE_CENTS)
  assert.equal(wallet.version, PROTOTYPE_WALLET_VERSION)
  assert.deepEqual(wallet.positionsByRound, {})
  assert.deepEqual(wallet.costBasisCentsByRound, {})
  assert.equal(wallet.totalPurchasesCents, 0)
  assert.equal(wallet.totalReceivedCents, 0)
  assert.deepEqual(wallet.creditedEventIds, [])
  assert.deepEqual(wallet.settledEntries, [])
})

test('restaura uma carteira válida e descarta armazenamento inválido', () => {
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
  assert.equal(
    deserializeWalletState('{"version":1,"balanceCents":-1}').balanceCents,
    INITIAL_BALANCE_CENTS,
  )
})

test('restaura uma entrada cancelada no histórico da carteira v2', () => {
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

  assert.deepEqual(
    deserializeWalletState(JSON.stringify(wallet)).settledEntries,
    wallet.settledEntries,
  )
})

test('compra parcial desconta centavos e adiciona a posição correta', () => {
  const result = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 12_345,
    participations: 150.75,
  })

  assert.equal(result.applied, true)
  assert.equal(result.balanceDeltaCents, -12_345)
  assert.equal(result.state.balanceCents, 187_655)
  assert.equal(result.state.totalPurchasesCents, 12_345)
  assert.deepEqual(getWalletPosition(result.state, ROUND_START), {
    up: 0,
    down: 150.75,
  })
  assert.deepEqual(getWalletCostBasis(result.state, ROUND_START), {
    up: 0,
    down: 12_345,
  })
})

test('permite usar todo o saldo e bloqueia compra acima dele', () => {
  const allIn = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: INITIAL_BALANCE_CENTS,
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
  const purchased = applyWalletPurchase(createInitialWalletState(), {
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
  assert.deepEqual(total.state.costBasisCentsByRound, {})
  assert.equal(total.state.totalReceivedCents, 7_833)
})

test('liquida posições e persiste entradas ganhas e perdidas com os dados da rodada', () => {
  const withUp = applyWalletPurchase(createInitialWalletState(), {
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
  assert.deepEqual(settled.state.costBasisCentsByRound, {})
  assert.deepEqual(settled.state.settledEntries, [
    {
      id: `${ROUND_START}:down`,
      roundStart: ROUND_START,
      roundEnd: ROUND_START + 900_000,
      side: 'down',
      outcome: 'lost',
      amountCents: 5_000,
      participations: 60,
      payoutCents: 0,
      targetPrice: 80_194.33,
      finalPrice: 80_195.64,
    },
    {
      id: `${ROUND_START}:up`,
      roundStart: ROUND_START,
      roundEnd: ROUND_START + 900_000,
      side: 'up',
      outcome: 'won',
      amountCents: 8_660,
      participations: 129.25,
      payoutCents: 12_925,
      targetPrice: 80_194.33,
      finalPrice: 80_195.64,
    },
  ])
  assert.deepEqual(
    deserializeWalletState(JSON.stringify(settled.state)).settledEntries,
    settled.state.settledEntries,
  )
})

test('derrota remove a posição sem crédito', () => {
  const purchased = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 10_000,
    participations: 125,
  }).state
  const settled = settleWalletRound(purchased, ROUND_START, 'up')

  assert.equal(settled.payoutCents, 0)
  assert.equal(settled.state.balanceCents, 190_000)
  assert.deepEqual(settled.state.positionsByRound, {})
})

test('vitória DOWN paga somente as participações DOWN', () => {
  const withDown = applyWalletPurchase(createInitialWalletState(), {
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
  const purchased = applyWalletPurchase(createInitialWalletState(), {
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
  const withOldPosition = applyWalletPurchase(createInitialWalletState(), {
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
  assert.equal(settled.state.balanceCents, INITIAL_BALANCE_CENTS)
})

test('protege liquidação e crédito de demonstração contra duplicidade', () => {
  const purchased = applyWalletPurchase(createInitialWalletState(), {
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
  assert.equal(duplicateDemo.state.totalReceivedCents, 24_925)
})

test('calcula métricas de perfil pelo preço atual e custo das rodadas pendentes', () => {
  const previousRound = ROUND_START - 900_000
  const withPending = applyWalletPurchase(createInitialWalletState(), {
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

  assert.deepEqual(getWalletProfileMetrics(withCurrent, ROUND_START, 12_000), {
    availableBalanceCents: 185_000,
    portfolioTotalCents: 202_000,
    totalPurchasesCents: 15_000,
    openEntriesCents: 17_000,
    totalReceivedCents: 0,
    netResultCents: 2_000,
  })
})

test('usa o custo da rodada atual quando a cotação está indisponível', () => {
  const purchased = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 12_345,
    participations: 150.75,
  }).state

  assert.deepEqual(getWalletProfileMetrics(purchased, ROUND_START, null), {
    availableBalanceCents: 187_655,
    portfolioTotalCents: INITIAL_BALANCE_CENTS,
    totalPurchasesCents: 12_345,
    openEntriesCents: 12_345,
    totalReceivedCents: 0,
    netResultCents: 0,
  })
})
