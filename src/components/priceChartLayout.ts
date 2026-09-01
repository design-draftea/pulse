export type PriceChartEntry = {
  id: string
  amount: number
  direction: 'up' | 'down'
  timestamp: number
}

export type PositionedPriceChartEntry = {
  entry: PriceChartEntry
  progress: number
  opacity: number
  x: number
  y: number
}

export const ENTRY_FEED_LIFETIME = 3200

const ENTRY_FEED_X = 22
const ENTRY_FEED_START_Y = 172
const ENTRY_FEED_END_Y = 56
const ENTRY_FEED_FADE_IN_DURATION = 360
const ENTRY_FEED_FADE_OUT_DURATION = 520

const clampUnit = (value: number) => Math.min(1, Math.max(0, value))

const getEntryOpacity = (age: number) => {
  const fadeIn = clampUnit(age / ENTRY_FEED_FADE_IN_DURATION)
  const remainingLifetime = ENTRY_FEED_LIFETIME - age
  const fadeOut = clampUnit(
    remainingLifetime / ENTRY_FEED_FADE_OUT_DURATION,
  )

  return Math.min(fadeIn, fadeOut)
}

export const layoutPriceChartEntries = (
  entries: PriceChartEntry[],
  renderTime: number,
): PositionedPriceChartEntry[] =>
  entries
    .filter(({ amount, timestamp }) => {
      const age = renderTime - timestamp

      return (
        Number.isFinite(amount) &&
        amount > 0 &&
        Number.isFinite(timestamp) &&
        age >= 0 &&
        age <= ENTRY_FEED_LIFETIME
      )
    })
    .slice()
    .sort((first, second) => first.timestamp - second.timestamp)
    .map((entry) => {
      const age = renderTime - entry.timestamp
      const progress = clampUnit(age / ENTRY_FEED_LIFETIME)

      return {
        entry,
        progress,
        opacity: getEntryOpacity(age),
        x: ENTRY_FEED_X,
        y:
          ENTRY_FEED_START_Y +
          (ENTRY_FEED_END_Y - ENTRY_FEED_START_Y) * progress,
      }
    })
