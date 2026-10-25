import { createHash } from 'node:crypto'
import { Context } from 'koishi'

export interface StaticCacheEntry {
  id: string
  source: string
  version: string
  fetchedAt: string
  sha256: string
  payload: string
}

declare module 'koishi' {
  interface Tables {
    miyoushe_static_cache: StaticCacheEntry
  }
}

export function createStaticCache(ctx: Context) {
  ctx.model.extend('miyoushe_static_cache', {
    id: 'string', source: 'string', version: 'string', fetchedAt: 'string',
    sha256: 'string', payload: 'text',
  }, { primary: 'id' })

  const pending = new Map<string, Promise<unknown>>()

  async function get<T>(id: string): Promise<T | undefined> {
    const rows = await ctx.database.get('miyoushe_static_cache', { id })
    const row = rows[0] as StaticCacheEntry | undefined
    if (!row) return undefined
    try {
      if (createHash('sha256').update(row.payload).digest('hex') !== row.sha256) return undefined
      return JSON.parse(row.payload) as T
    } catch {
      return undefined
    }
  }

  async function put(id: string, source: string, version: string, value: unknown) {
    const payload = JSON.stringify(value)
    await ctx.database.upsert('miyoushe_static_cache', [{
      id, source, version, fetchedAt: new Date().toISOString(),
      sha256: createHash('sha256').update(payload).digest('hex'), payload,
    }])
  }

  async function getOrFetch<T>(id: string, fetcher: () => Promise<{ source: string; version: string; data: T }>) {
    const cached = await get<T>(id)
    if (cached !== undefined) return cached
    const running = pending.get(id)
    if (running) return running as Promise<T | undefined>
    const task = fetcher().then(async result => {
      await put(id, result.source, result.version, result.data)
      return result.data
    }).catch(() => undefined).finally(() => pending.delete(id))
    pending.set(id, task)
    return task
  }

  return { get, put, getOrFetch }
}

export type StaticCache = ReturnType<typeof createStaticCache>
