import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BTC_ROUND_DURATION_MS,
  fetchBtcRoundMinutePoints,
  getBtcRoundStart,
  getPreviousBtcRoundStarts,
} from '../src/services/marketData.ts'

test('calcula a rodada atual em blocos contínuos de 15 minutos', () => {
  const tenTwentyNine = Date.UTC(2026, 8, 1, 10, 29, 59)
  const tenFifteen = Date.UTC(2026, 8, 1, 10, 15, 0)

  assert.equal(getBtcRoundStart(tenTwentyNine), tenFifteen)
})

test('lista as 10 rodadas concluídas imediatamente anteriores', () => {
  const currentRoundStart = Date.UTC(2026, 8, 1, 10, 15, 0)
  const rounds = getPreviousBtcRoundStarts(currentRoundStart, 10)

  assert.equal(rounds.length, 10)
  assert.equal(rounds[0], Date.UTC(2026, 8, 1, 10, 0, 0))
  assert.equal(rounds[9], Date.UTC(2026, 8, 1, 7, 45, 0))
  assert.equal(rounds[0] - rounds[1], BTC_ROUND_DURATION_MS)
})

test('o histórico da ronda usa candles de 1 minuto e ignora o que está fora da janela', async () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 15, 0)
  const until = roundStart + 3 * 60_000
  const candle = (minute: number, open: number, close: number) => [
    (roundStart + minute * 60_000) / 1000,
    open,
    close,
    open,
    close,
  ]
  const originalFetch = globalThis.fetch
  let requestedUrl = ''

  globalThis.fetch = (async (input: string) => {
    requestedUrl = String(input)

    return {
      ok: true,
      json: async () => [
        candle(2, 108, 109),
        candle(1, 104, 108),
        candle(0, 100, 104),
        candle(3, 109, 111),
        candle(-1, 90, 100),
      ],
    }
  }) as typeof globalThis.fetch

  try {
    const points = await fetchBtcRoundMinutePoints(roundStart, until)

    assert.match(requestedUrl, /granularity=60/)
    assert.deepEqual(points, [
      { timestamp: roundStart, value: 100 },
      { timestamp: roundStart + 60_000, value: 104 },
      { timestamp: roundStart + 120_000, value: 108 },
      { timestamp: roundStart + 180_000, value: 109 },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('não consulta o histórico da ronda antes do primeiro minuto', async () => {
  const roundStart = Date.UTC(2026, 8, 1, 10, 15, 0)
  const originalFetch = globalThis.fetch
  let called = false

  globalThis.fetch = (async () => {
    called = true
    throw new Error('não deveria consultar')
  }) as typeof globalThis.fetch

  try {
    const points = await fetchBtcRoundMinutePoints(roundStart, roundStart + 30_000)

    assert.equal(called, false)
    assert.deepEqual(points, [])
  } finally {
    globalThis.fetch = originalFetch
  }
})
