import assert from 'node:assert/strict'
import test from 'node:test'
import { getOpenEntrySummaries } from '../src/services/openEntries.ts'
import {
  applyWalletPurchase,
  applyWalletSale,
  createInitialWalletState,
  deserializeWalletState,
  getWalletCostBasis,
  getWalletPosition,
} from '../src/services/prototypeWallet.ts'

const ROUND_START = 1_777_777_500_000

test('agrega compras do mesmo lado e calcula o preço médio ponderado', () => {
  const firstPurchase = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 10_000,
    participations: 200,
  }).state
  const secondPurchase = applyWalletPurchase(firstPurchase, {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 5_000,
    participations: 50,
  }).state

  assert.deepEqual(
    getOpenEntrySummaries(
      getWalletPosition(secondPurchase, ROUND_START),
      getWalletCostBasis(secondPurchase, ROUND_START),
    ),
    [{
      side: 'up',
      participations: 250,
      amountCents: 15_000,
      averagePriceCents: 60,
      potentialPayoutCents: 25_000,
    }],
  )
})

test('mantém DOWN e UP em cards separados e na ordem do Figma', () => {
  const withUp = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 20_000,
    participations: 298.51,
  }).state
  const withBoth = applyWalletPurchase(withUp, {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 20_000,
    participations: 588.24,
  }).state
  const entries = getOpenEntrySummaries(
    getWalletPosition(withBoth, ROUND_START),
    getWalletCostBasis(withBoth, ROUND_START),
  )

  assert.deepEqual(entries.map(({ side }) => side), ['down', 'up'])
  assert.equal(entries[0]?.amountCents, 20_000)
  assert.equal(entries[1]?.amountCents, 20_000)
})

test('reduz o custo proporcionalmente na venda parcial e remove na total', () => {
  const purchased = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'down',
    amountCents: 20_000,
    participations: 400,
  }).state
  const partial = applyWalletSale(purchased, {
    roundStart: ROUND_START,
    side: 'down',
    amountReceivedCents: 6_000,
    participations: 100,
  }).state
  const remainingEntries = getOpenEntrySummaries(
    getWalletPosition(partial, ROUND_START),
    getWalletCostBasis(partial, ROUND_START),
  )

  assert.equal(remainingEntries[0]?.participations, 300)
  assert.equal(remainingEntries[0]?.amountCents, 15_000)
  assert.equal(remainingEntries[0]?.averagePriceCents, 50)

  const total = applyWalletSale(partial, {
    roundStart: ROUND_START,
    side: 'down',
    amountReceivedCents: 15_000,
    participations: 300,
  }).state

  assert.deepEqual(
    getOpenEntrySummaries(
      getWalletPosition(total, ROUND_START),
      getWalletCostBasis(total, ROUND_START),
    ),
    [],
  )
})

test('preserva posições e custo-base ao restaurar a carteira', () => {
  const wallet = applyWalletPurchase(createInitialWalletState(), {
    roundStart: ROUND_START,
    side: 'up',
    amountCents: 12_345,
    participations: 150.75,
  }).state
  const restored = deserializeWalletState(JSON.stringify(wallet))

  assert.deepEqual(
    getWalletPosition(restored, ROUND_START),
    getWalletPosition(wallet, ROUND_START),
  )
  assert.deepEqual(
    getWalletCostBasis(restored, ROUND_START),
    getWalletCostBasis(wallet, ROUND_START),
  )
})
