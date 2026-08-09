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
    private readonly fallbackStorage: Storage | undefined = browserLocalStorage(),
  ) {}

  async get(id: string, cubeSize: number, byteLength: number): Promise<Uint8Array | null> {
    if (this.storage) {
      try {
        const cache = await this.storage.open(LUT_BYTE_CACHE_NAME)
        const key = this.key(id, cubeSize, byteLength)
        const response = await cache.match(key)
        if (response) {
          const bytes = new Uint8Array(await response.arrayBuffer())
          if (bytes.length === byteLength) return bytes
          await cache.delete(key)
        }
      } catch {
        // Continue to the small localStorage fallback.
      }
    }
    return this.getFallback(id, cubeSize, byteLength)
  }

  async put(id: string, cubeSize: number, byteLength: number, bytes: Uint8Array): Promise<void> {
    if (bytes.length !== byteLength) return
    if (this.storage) {
      try {
        const cache = await this.storage.open(LUT_BYTE_CACHE_NAME)
        const body = Uint8Array.from(bytes).buffer as ArrayBuffer
        await cache.put(this.key(id, cubeSize, byteLength), new Response(body))
      } catch {
        // Continue to the small localStorage fallback.
      }
    }
    this.putFallback(id, cubeSize, byteLength, bytes)
  }

  async delete(id: string, cubeSize: number, byteLength: number): Promise<void> {
    if (this.storage) {
      try {
        const cache = await this.storage.open(LUT_BYTE_CACHE_NAME)
        await cache.delete(this.key(id, cubeSize, byteLength))
      } catch {
        // The versioned key prevents reuse even if cleanup is unavailable.
      }
    }
    try { this.fallbackStorage?.removeItem(this.localKey(id, cubeSize, byteLength)) } catch { /* no-op */ }
  }

  async pruneOldVersions(): Promise<void> {
    if (this.storage) {
      try {
        const names = await this.storage.keys()
        await Promise.all(names
          .filter((name) => name.startsWith(LUT_CACHE_PREFIX) && name !== LUT_BYTE_CACHE_NAME)
          .map((name) => this.storage!.delete(name)))
      } catch {
        // Cache cleanup must never block the editor.
      }
    }
    this.pruneFallback()
  }

  private key(id: string, cubeSize: number, byteLength: number): string {
    const path = `__film_lut_cache__/${cubeSize}/${encodeURIComponent(id)}/${byteLength}`
    return new URL(path, this.baseUrl).href
  }

  private localKey(id: string, cubeSize: number, byteLength: number): string {
    return `${LUT_BYTE_CACHE_NAME}:${cubeSize}:${encodeURIComponent(id)}:${byteLength}`
  }

  private getFallback(id: string, cubeSize: number, byteLength: number): Uint8Array | null {
    if (!this.fallbackStorage) return null
    const key = this.localKey(id, cubeSize, byteLength)
    try {
      const encoded = this.fallbackStorage.getItem(key)
      if (!encoded) return null
      const bytes = decodeBase64(encoded)
      if (bytes.length === byteLength) return bytes
      this.fallbackStorage.removeItem(key)
    } catch {
      try { this.fallbackStorage.removeItem(key) } catch { /* no-op */ }
    }
    return null
  }

  private putFallback(id: string, cubeSize: number, byteLength: number, bytes: Uint8Array): void {
    try { this.fallbackStorage?.setItem(this.localKey(id, cubeSize, byteLength), encodeBase64(bytes)) } catch { /* no-op */ }
  }

  private pruneFallback(): void {
    if (!this.fallbackStorage) return
    try {
      const keys = Array.from({ length: this.fallbackStorage.length }, (_, index) => this.fallbackStorage!.key(index))
      for (const key of keys) {
        if (key?.startsWith(LUT_CACHE_PREFIX) && !key.startsWith(`${LUT_BYTE_CACHE_NAME}:`)) {
          this.fallbackStorage.removeItem(key)
        }
      }
    } catch {
      // Local storage cleanup is also optional.
    }
  }
}

function browserLocalStorage(): Storage | undefined {
  const runtime = globalThis as typeof globalThis & { process?: { release?: { name?: string } } }
  if (runtime.process?.release?.name === 'node') return undefined
  try { return globalThis.document?.defaultView?.localStorage } catch { return undefined }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
