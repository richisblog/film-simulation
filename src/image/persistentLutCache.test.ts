import { describe, expect, test } from 'vitest'
import { BrowserLutByteCache, LUT_BYTE_CACHE_NAME } from './persistentLutCache'

class MemoryCache {
  readonly entries = new Map<string, Response>()

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(String(request))?.clone()
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(String(request), response.clone())
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(String(request))
  }
}

class MemoryCacheStorage {
  readonly stores = new Map<string, MemoryCache>()

  async open(name: string): Promise<Cache> {
    let cache = this.stores.get(name)
    if (!cache) {
      cache = new MemoryCache()
      this.stores.set(name, cache)
    }
    return cache as unknown as Cache
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()]
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name)
  }
}

class MemoryLocalStorage {
  readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('BrowserLutByteCache', () => {
  test('returns an independent copy of validated persistent bytes', async () => {
    const storage = new MemoryCacheStorage()
    const cache = new BrowserLutByteCache(storage as unknown as CacheStorage, 'https://film.test/')
    const bytes = new Uint8Array([1, 2, 3, 4])

    await cache.put('PT400', 8, 4, bytes)
    bytes[0] = 99

    expect(await cache.get('PT400', 8, 4)).toEqual(new Uint8Array([1, 2, 3, 4]))
  })

  test('deletes an entry whose stored byte length no longer matches the manifest', async () => {
    const storage = new MemoryCacheStorage()
    const cache = new BrowserLutByteCache(storage as unknown as CacheStorage, 'https://film.test/')
    await cache.put('PT400', 8, 4, new Uint8Array([1, 2, 3, 4]))
    const raw = storage.stores.get(LUT_BYTE_CACHE_NAME)!
    const [key] = raw.entries.keys()
    raw.entries.set(key, new Response(new Uint8Array([1])))

    expect(await cache.get('PT400', 8, 4)).toBeNull()
    expect(raw.entries.size).toBe(0)
  })

  test('treats unavailable or rejecting Cache Storage as a safe cache miss', async () => {
    const rejecting = {
      open: async () => { throw new DOMException('denied', 'SecurityError') },
      keys: async () => { throw new DOMException('denied', 'SecurityError') },
      delete: async () => { throw new DOMException('denied', 'SecurityError') },
    } as unknown as CacheStorage
    const cache = new BrowserLutByteCache(rejecting, 'https://film.test/')

    await expect(cache.get('PT400', 8, 4)).resolves.toBeNull()
    await expect(cache.put('PT400', 8, 4, new Uint8Array(4))).resolves.toBeUndefined()
    await expect(cache.delete('PT400', 8, 4)).resolves.toBeUndefined()
    await expect(cache.pruneOldVersions()).resolves.toBeUndefined()
  })

  test('persists through localStorage when Cache Storage is unavailable', async () => {
    const local = new MemoryLocalStorage() as unknown as Storage
    const bytes = new Uint8Array([9, 8, 7, 6])
    const firstPage = new BrowserLutByteCache(undefined, 'https://film.test/', local)
    await firstPage.put('PT400', 8, bytes.length, bytes)

    const reopenedPage = new BrowserLutByteCache(undefined, 'https://film.test/', local)

    expect(await reopenedPage.get('PT400', 8, bytes.length)).toEqual(bytes)
  })

  test('uses the local copy when a browser loses a successful Cache Storage write between pages', async () => {
    const local = new MemoryLocalStorage() as unknown as Storage
    const bytes = new Uint8Array([4, 3, 2, 1])
    const firstPageCaches = new MemoryCacheStorage()
    const firstPage = new BrowserLutByteCache(firstPageCaches as unknown as CacheStorage, 'https://film.test/', local)
    await firstPage.put('PT400', 8, bytes.length, bytes)

    const reopenedWithEmptyCaches = new BrowserLutByteCache(
      new MemoryCacheStorage() as unknown as CacheStorage,
      'https://film.test/',
      local,
    )

    expect(await reopenedWithEmptyCaches.get('PT400', 8, bytes.length)).toEqual(bytes)
  })

  test('prunes only older application-owned LUT cache versions', async () => {
    const storage = new MemoryCacheStorage()
    await storage.open('film-lut-bytes-v0')
    await storage.open(LUT_BYTE_CACHE_NAME)
    await storage.open('workbox-runtime')
    const cache = new BrowserLutByteCache(storage as unknown as CacheStorage, 'https://film.test/')

    await cache.pruneOldVersions()

    expect(await storage.keys()).toEqual([LUT_BYTE_CACHE_NAME, 'workbox-runtime'])
  })
})
