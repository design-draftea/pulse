import assert from 'node:assert/strict'
import test from 'node:test'
import {
  selectColdSources,
  warmImageSources,
} from '../src/services/assetWarmup.ts'

test('seleciona apenas as origens ainda não aquecidas, sem repetir', () => {
  const cold = selectColdSources(
    ['/a.webp', '/b.webp', '/a.webp', '', '/c.webp'],
    new Set(['/b.webp']),
  )

  assert.deepEqual(cold, ['/a.webp', '/c.webp'])
})

test('busca cada origem uma única vez e registra as aquecidas', async () => {
  const warmed = new Set<string>()
  const requested: string[] = []

  const first = await warmImageSources(
    ['/a.webp', '/b.webp', '/a.webp'],
    warmed,
    async (source) => {
      requested.push(source)
    },
  )

  assert.deepEqual(requested, ['/a.webp', '/b.webp'])
  assert.deepEqual(first, ['/a.webp', '/b.webp'])

  const second = await warmImageSources(['/a.webp', '/b.webp'], warmed, async (source) => {
    requested.push(source)
  })

  assert.deepEqual(second, [])
  assert.deepEqual(requested, ['/a.webp', '/b.webp'])
})

test('uma falha não aquece a origem nem derruba as demais', async () => {
  const warmed = new Set<string>()

  const ready = await warmImageSources(
    ['/quebrada.webp', '/ok.webp'],
    warmed,
    async (source) => {
      if (source === '/quebrada.webp') {
        throw new Error('rede indisponível')
      }
    },
  )

  assert.deepEqual(ready, ['/ok.webp'])
  assert.equal(warmed.has('/ok.webp'), true)
  assert.equal(warmed.has('/quebrada.webp'), false)

  const retried: string[] = []
  await warmImageSources(['/quebrada.webp', '/ok.webp'], warmed, async (source) => {
    retried.push(source)
  })

  assert.deepEqual(retried, ['/quebrada.webp'])
})
