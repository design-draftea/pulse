import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMarketPriceTrendState,
  getActiveMarketPriceDirection,
  PRICE_TREND_IDLE_MS,
  updateMarketPriceTrend,
} from '../src/services/marketPriceDirection.ts'

test('confirma uma direção somente após duas leituras consecutivas', () => {
  let state = createMarketPriceTrendState()

  state = updateMarketPriceTrend(state, 100, 0)
  state = updateMarketPriceTrend(state, 101, 400)
  assert.equal(state.desiredDirection, null)

  state = updateMarketPriceTrend(state, 102, 800)
  assert.equal(state.desiredDirection, 'up')
  assert.equal(getActiveMarketPriceDirection(state, 800), 'up')
})

test('não inverte por uma única leitura contrária', () => {
  let state = createMarketPriceTrendState()

  state = updateMarketPriceTrend(state, 100, 0)
  state = updateMarketPriceTrend(state, 101, 300)
  state = updateMarketPriceTrend(state, 102, 600)
  state = updateMarketPriceTrend(state, 99, 1_800)

  assert.equal(state.desiredDirection, 'up')

  state = updateMarketPriceTrend(state, 98, 2_100)
  assert.equal(state.desiredDirection, 'down')
})

test('usa a tendência da janela para ignorar um ruído isolado', () => {
  let state = createMarketPriceTrendState()

  state = updateMarketPriceTrend(state, 100, 0)
  state = updateMarketPriceTrend(state, 101, 400)
  state = updateMarketPriceTrend(state, 102, 800)
  state = updateMarketPriceTrend(state, 101.8, 1_000)

  assert.equal(state.desiredDirection, 'up')
  assert.equal(state.candidateDirection, null)
})

test('fica neutra após dois segundos sem movimento relevante', () => {
  let state = createMarketPriceTrendState()

  state = updateMarketPriceTrend(state, 100, 0)
  state = updateMarketPriceTrend(state, 101, 400)
  state = updateMarketPriceTrend(state, 102, 800)

  assert.equal(
    getActiveMarketPriceDirection(state, 800 + PRICE_TREND_IDLE_MS),
    'up',
  )
  assert.equal(
    getActiveMarketPriceDirection(state, 801 + PRICE_TREND_IDLE_MS),
    null,
  )
})
