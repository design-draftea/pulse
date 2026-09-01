import assert from 'node:assert/strict'
import test from 'node:test'
import type { PrototypeWalletSettledEntry } from '../src/services/prototypeWallet.ts'
import { getPastEntries, getWonEntries } from '../src/services/wonEntries.ts'

const entry = (
  id: string,
  roundStart: number,
  outcome: 'won' | 'lost' | 'canceled',
  side: 'up' | 'down',
): PrototypeWalletSettledEntry => ({
  id,
  roundStart,
  roundEnd: roundStart + 900_000,
  side,
  outcome,
  amountCents: 10_000,
  participations: 125,
  payoutCents: outcome === 'won' ? 12_500 : 0,
  targetPrice: 80_000,
  finalPrice: side === 'up' ? 80_010 : 79_990,
})

test('lista somente entradas ganhas em ordem da mais recente', () => {
  const entries = [
    entry('older', 1_000_000, 'won', 'down'),
    entry('lost', 3_000_000, 'lost', 'up'),
    entry('newer', 2_000_000, 'won', 'up'),
  ]

  assert.deepEqual(getWonEntries(entries).map(({ id }) => id), ['newer', 'older'])
  assert.deepEqual(entries.map(({ id }) => id), ['older', 'lost', 'newer'])
})

test('não exibe vitória sem pagamento', () => {
  const invalidWinner = { ...entry('zero', 1_000_000, 'won', 'up'), payoutCents: 0 }

  assert.deepEqual(getWonEntries([invalidWinner]), [])
})

test('pasadas reúne ganadas, perdidas e canceladas da mais recente para a mais antiga', () => {
  const entries = [
    entry('won', 1_000_000, 'won', 'down'),
    entry('canceled', 3_000_000, 'canceled', 'down'),
    entry('lost', 2_000_000, 'lost', 'up'),
  ]

  assert.deepEqual(
    getPastEntries(entries).map(({ id }) => id),
    ['canceled', 'lost', 'won'],
  )
  assert.deepEqual(entries.map(({ id }) => id), ['won', 'canceled', 'lost'])
})
