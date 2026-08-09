export const LUT_BYTE_CACHE_NAME = 'film-lut-bytes-v1'
const LUT_CACHE_PREFIX = 'film-lut-bytes-'

export interface LutByteCache {
  get(id: string, cubeSize: number, byteLength: number): Promise<Uint8Array | null>
  put(id: string, cubeSize: number, byteLength: number, bytes: Uint8Array): Promise<void>
  delete(id: string, cubeSize: number, byteLength: number): Promise<void>
  pruneOldVersions(): Promise<void>
}

export class BrowserLutByteCache implements LutByteCache {
  constructor(
    private readonly storage: CacheStorage | undefined = globalThis.caches,
    private readonly baseUrl = globalThis.document?.baseURI ?? globalThis.location?.href ?? 'http://localhost/',
  ) {}

  async get(id: string, cubeSize: number, byteLength: number): Promise<Uint8Array | null> {
    if (!this.storage) return null
    try {
      const cache = await this.storage.open(LUT_BYTE_CACHE_NAME)
      const key = this.key(id, cubeSize, byteLength)
      const response = await cache.match(key)
      if (!response) return null
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length === byteLength) return bytes
      await cache.delete(key)
      return null
    } catch {
      return null
    }
  }

  async put(id: string, cubeSize: number, byteLength: number, bytes: Uint8Array): Promise<void> {
    if (!this.storage || bytes.length !== byteLength) return
    try {
      const cache = await this.storage.open(LUT_BYTE_CACHE_NAME)
      const body = Uint8Array.from(bytes).buffer as ArrayBuffer
      await cache.put(this.key(id, cubeSize, byteLength), new Response(body))
    } catch {
      // Cache Storage is an optimization; network loading remains authoritative.
    }
  }

  async delete(id: string, cubeSize: number, byteLength: number): Promise<void> {
    if (!this.storage) return
    try {
      const cache = await this.storage.open(LUT_BYTE_CACHE_NAME)
      await cache.delete(this.key(id, cubeSize, byteLength))
    } catch {
      // A later byte-length/version key still prevents reuse of this entry.
    }
  }

  async pruneOldVersions(): Promise<void> {
    if (!this.storage) return
    try {
      const names = await this.storage.keys()
      await Promise.all(names
        .filter((name) => name.startsWith(LUT_CACHE_PREFIX) && name !== LUT_BYTE_CACHE_NAME)
        .map((name) => this.storage!.delete(name)))
    } catch {
      // Cache cleanup must never block the editor.
    }
  }

  private key(id: string, cubeSize: number, byteLength: number): string {
    const path = `__film_lut_cache__/${cubeSize}/${encodeURIComponent(id)}/${byteLength}`
    return new URL(path, this.baseUrl).href
  }
}
