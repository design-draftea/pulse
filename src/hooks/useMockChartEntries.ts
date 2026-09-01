import { useEffect, useRef, useState } from 'react'
import type { PriceChartEntry } from '../components/PriceChart'
import { getNextEntryDelay } from '../components/entryFeedCadence'

const ENTRY_SEQUENCE: Array<Pick<PriceChartEntry, 'amount' | 'direction'>> = [
  { amount: 20, direction: 'down' },
  { amount: 85, direction: 'up' },
  { amount: 3, direction: 'down' },
  { amount: 1245.69, direction: 'up' },
  { amount: 50, direction: 'up' },
]

const INITIAL_ENTRY: Pick<PriceChartEntry, 'amount' | 'direction'> = {
  amount: 40,
  direction: 'up',
}

export function useMockChartEntries(isActive: boolean) {
  const [entries, setEntries] = useState<PriceChartEntry[]>([])
  const entryCountRef = useRef(0)

  useEffect(() => {
    let timer = 0

    if (!isActive) return

    entryCountRef.current = 0

    const pushEntry = (
      entry: Pick<PriceChartEntry, 'amount' | 'direction'>,
    ) => {
      entryCountRef.current += 1
      const timestamp = Date.now()

      setEntries([{
        ...entry,
        id: `entry-${timestamp}-${entryCountRef.current}`,
        timestamp,
      }])
    }

    const scheduleNextEntry = () => {
      timer = window.setTimeout(() => {
        const nextEntry = ENTRY_SEQUENCE[
          (entryCountRef.current - 1) % ENTRY_SEQUENCE.length
        ]

        pushEntry(nextEntry)
        scheduleNextEntry()
      }, getNextEntryDelay())
    }

    timer = window.setTimeout(() => {
      pushEntry(INITIAL_ENTRY)
      scheduleNextEntry()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isActive])

  return isActive ? entries : []
}
