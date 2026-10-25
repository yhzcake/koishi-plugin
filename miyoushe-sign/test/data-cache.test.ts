import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStaticCache } from '../src/data-cache'

function context() {
  const rows = new Map<string, any>()
  return {
    model: { extend() {} },
    database: {
      async get(_table: string, query: Record<string, unknown>) {
        const row = rows.get(String(query.id))
        return row ? [row] : []
      },
      async upsert(_table: string, values: any[]) {
        for (const value of values) rows.set(value.id, value)
      },
    },
  }
}

test('static cache persists valid data and deduplicates concurrent fetches', async () => {
  const cache = createStaticCache(context() as never)
  let calls = 0
  const fetcher = async () => {
    calls++
    await new Promise(resolve => setTimeout(resolve, 1))
    return { source: 'https://example.test/data.json', version: 'v1', data: { id: 'new' } }
  }
  const [first, second] = await Promise.all([
    cache.getOrFetch('resource', fetcher),
    cache.getOrFetch('resource', fetcher),
  ])
  assert.deepEqual(first, { id: 'new' })
  assert.deepEqual(second, { id: 'new' })
  assert.equal(calls, 1)
  assert.deepEqual(await cache.getOrFetch('resource', async () => { throw new Error('must not fetch') }), { id: 'new' })
})

test('static cache ignores tampered payload', async () => {
  const ctx = context()
  const cache = createStaticCache(ctx as never)
  await cache.put('resource', 'source', 'v1', { valid: true })
  const row = (await ctx.database.get('miyoushe_static_cache', { id: 'resource' }))[0]
  row.payload = JSON.stringify({ valid: false })
  assert.equal(await cache.get('resource'), undefined)
})
