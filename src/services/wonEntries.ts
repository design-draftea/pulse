import type { PrototypeWalletSettledEntry } from './prototypeWallet'

export const getWonEntries = (
  entries: PrototypeWalletSettledEntry[],
): PrototypeWalletSettledEntry[] => (
  entries
    .filter((entry) => entry.outcome === 'won' && entry.payoutCents > 0)
    .toSorted((left, right) => (
      right.roundStart - left.roundStart
      || (left.side === 'down' ? -1 : 1)
    ))
)

export const getPastEntries = (
  entries: PrototypeWalletSettledEntry[],
): PrototypeWalletSettledEntry[] => (
  entries.toSorted((left, right) => (
    right.roundStart - left.roundStart
    || (left.side === 'down' ? -1 : 1)
  ))
)
