import { assetRoots, type AssetRoot } from '../config/assets'
import { AssetLoadError, requestAsset, type AssetKind } from './assetRequest'
import { LutCube } from './lut'
import { BrowserLutByteCache, type LutByteCache } from './persistentLutCache'

export interface LutDescriptor {
  id: string
  asset: string
  cube_size: number
  byte_length: number
  preview_asset: string
  preview_cube_size: number
  preview_byte_length: number
}
export interface LeakDescriptor { id: string; asset: string; byte_length: number }

interface LutManifest { cube_size?: number; luts: LutDescriptor[] }
interface LeakManifest { light_leaks: LeakDescriptor[] }

export interface LutPreloadProgress {
  total: number
  completed: number
  succeeded: number
  failed: number
  active: number
  currentId: string | null
  percent: number
  done: boolean
}

const browserFetch: typeof fetch = (input, init) => globalThis.fetch.call(globalThis, input, init)

export class AssetCatalog {
  luts: LutDescriptor[] = []
  leaks: LeakDescriptor[] = []
  private loaded?: Promise<void>
  private readonly lutCache = new Map<string, LutCube>()
  private readonly leakCache = new Map<string, HTMLImageElement>()
  private readonly lutInflight = new Map<string, Promise<LutCube>>()
  private readonly preloadSucceeded = new Set<string>()
  private readonly preloadFailed = new Set<string>()

  constructor(
    private readonly base = './assets',
    private readonly fetcher: typeof fetch = browserFetch,
    private readonly roots: AssetRoot[] = assetRoots(import.meta.env.VITE_ASSET_BASE_URL, base),
    private readonly byteCache: LutByteCache = new BrowserLutByteCache(),
  ) {}

  load(): Promise<void> {
    if (!this.loaded) this.loaded = this.loadManifests()
    return this.loaded
  }

  private async loadManifests(): Promise<void> {
    const [lutResponse, leakResponse] = await Promise.all([
      this.fetcher(`${this.base}/luts/manifest.json`),
      this.fetcher(`${this.base}/light_leaks/manifest.json`),
    ])
    if (!lutResponse.ok || !leakResponse.ok) throw new Error('无法载入效果素材清单')
    const lutManifest = await lutResponse.json() as LutManifest
    const leakManifest = await leakResponse.json() as LeakManifest
    this.luts = lutManifest.luts
    this.leaks = leakManifest.light_leaks
    await this.byteCache.pruneOldVersions()
  }

  async loadLut(id: string): Promise<LutCube> {
    await this.load()
    const cached = this.lutCache.get(id)
    if (cached) return cached
    const pending = this.lutInflight.get(id)
    if (pending) return pending
    const descriptor = this.requireLut(id)
    const request = this.loadCanonicalCube(
      id, descriptor,
    ).then((lut) => {
      cacheBounded(this.lutCache, id, lut, 36)
      return lut
    }).finally(() => this.lutInflight.delete(id))
    this.lutInflight.set(id, request)
    return request
  }

  async loadPreviewLut(id: string): Promise<LutCube> {
    return this.loadLut(id)
  }

  retryLut(id: string): Promise<LutCube> {
    this.lutCache.delete(id)
    this.lutInflight.delete(id)
    return this.loadLut(id)
  }

  async preloadLuts(onProgress: (progress: LutPreloadProgress) => void): Promise<void> {
    await this.load()
    const ids = this.luts.map((item) => item.id).filter((id) => !this.preloadSucceeded.has(id))
    await this.preloadIds(ids, onProgress)
  }

  async retryFailedLuts(onProgress: (progress: LutPreloadProgress) => void): Promise<void> {
    await this.load()
    const ids = [...this.preloadFailed]
    for (const id of ids) {
      this.preloadFailed.delete(id)
      this.lutCache.delete(id)
      this.lutInflight.delete(id)
    }
    await this.preloadIds(ids, onProgress)
  }

  async loadLeak(id: string): Promise<HTMLImageElement> {
    await this.load()
    const cached = this.leakCache.get(id)
    if (cached) return cached
    const descriptor = this.leaks.find((item) => item.id === id)
    if (!descriptor) throw new Error(`未知漏光：${id}`)
    const bytes = await requestAsset(`light_leaks/${descriptor.asset}`, {
      roots: this.roots,
      assetKind: 'leak',
      effectId: id,
      expectedByteLength: descriptor.byte_length,
      fetcher: this.fetcher,
    })
    const copy = new Uint8Array(bytes)
    const url = URL.createObjectURL(new Blob([copy]))
    const image = new Image()
    image.src = url
    try { await image.decode() } finally { URL.revokeObjectURL(url) }
    cacheBounded(this.leakCache, id, image, 4)
    return image
  }

  private requireLut(id: string): LutDescriptor {
    const descriptor = this.luts.find((item) => item.id === id)
    if (!descriptor) throw new Error(`未知 LUT：${id}`)
    return descriptor
  }

  private async loadCanonicalCube(id: string, descriptor: LutDescriptor): Promise<LutCube> {
    const asset = descriptor.preview_asset
    const cubeSize = descriptor.preview_cube_size
    const byteLength = descriptor.preview_byte_length
    let bytes = await this.byteCache.get(id, cubeSize, byteLength)
    if (!bytes) {
      bytes = await requestAsset(`luts/${asset}`, {
        roots: this.roots,
        assetKind: 'lut',
        effectId: id,
        expectedByteLength: byteLength,
        fetcher: this.fetcher,
      })
      await this.byteCache.put(id, cubeSize, byteLength, bytes)
    }
    try {
      const raw = await this.decompressLut(bytes, asset, id, 'lut')
      return new LutCube(cubeSize, raw)
    } catch (reason) {
      await this.byteCache.delete(id, cubeSize, byteLength)
      throw reason
    }
  }

  private async preloadIds(ids: string[], onProgress: (progress: LutPreloadProgress) => void): Promise<void> {
    let active = ids.length
    const emit = (currentId: string | null) => {
      const total = this.luts.length
      const succeeded = this.preloadSucceeded.size
      const failed = this.preloadFailed.size
      const completed = succeeded + failed
      onProgress({
        total,
        completed,
        succeeded,
        failed,
        active,
        currentId,
        percent: total === 0 ? 100 : Math.round(completed / total * 100),
        done: active === 0 && completed === total,
      })
    }
    emit(null)
    await Promise.all(ids.map(async (id) => {
      try {
        await this.loadLut(id)
        this.preloadSucceeded.add(id)
        this.preloadFailed.delete(id)
      } catch {
        this.preloadFailed.add(id)
      } finally {
        active -= 1
        emit(id)
      }
    }))
  }

  private async decompressLut(bytes: Uint8Array, asset: string, id: string, assetKind: AssetKind): Promise<Uint8Array> {
    if (!asset.endsWith('.deflate')) return bytes
    const source = this.roots[0]?.label ?? '本站'
    if (typeof DecompressionStream === 'undefined') {
      throw new AssetLoadError('unsupported', assetKind, id, source, 1, undefined, 0)
    }
    try {
      const copy = new Uint8Array(bytes)
      const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate'))
      return new Uint8Array(await new Response(stream).arrayBuffer())
    } catch (reason) {
      if (reason instanceof AssetLoadError) throw reason
      throw new AssetLoadError('decompression', assetKind, id, source, 1, undefined, 0)
    }
  }
}

function cacheBounded<T>(cache: Map<string, T>, id: string, value: T, limit: number): void {
  cache.set(id, value)
  while (cache.size > limit) cache.delete(cache.keys().next().value!)
}
