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
  source?: 'classic' | 'dazz'
  camera_id?: string
  name_zh?: string
  name_en?: string
  stages?: string[]
}
export interface LeakDescriptor { id: string; asset: string; byte_length: number; source?: 'classic' | 'dazz' }

export interface DazzCameraDescriptor {
  id: string
  name_zh: string
  name_en: string
  default_recipe_id: string
  recipe_ids: string[]
}
export interface LutGroup { id: 'classic' | 'dazz'; luts: LutDescriptor[] }
export interface LeakGroup { id: string; leaks: LeakDescriptor[] }

interface LutManifest { cube_size?: number; luts: LutDescriptor[] }
interface LeakManifest { light_leaks: LeakDescriptor[] }
interface DazzLutManifest { cameras?: DazzCameraDescriptor[]; recipes?: LutDescriptor[] }
interface DazzLeakManifest { groups?: Array<{ id: string; light_leaks: LeakDescriptor[] }> }

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
const LUT_MANIFEST = 'manifest-8cube-v1.json'

export class AssetCatalog {
  luts: LutDescriptor[] = []
  leaks: LeakDescriptor[] = []
  cameras: DazzCameraDescriptor[] = []
  lutGroups: LutGroup[] = []
  leakGroups: LeakGroup[] = []
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
    const optionalFetch = (url: string) => Promise.resolve().then(() => this.fetcher(url)).catch(() => new Response(null, { status: 404 }))
    const [lutResponse, leakResponse, dazzLutResponse, dazzLeakResponse] = await Promise.all([
      this.fetcher(`${this.base}/luts/${LUT_MANIFEST}`),
      this.fetcher(`${this.base}/light_leaks/manifest.json`),
      optionalFetch(`${this.base}/dazz/luts/manifest-v1.json`),
      optionalFetch(`${this.base}/dazz/light_leaks/manifest-v1.json`),
    ])
    if (!lutResponse.ok || !leakResponse.ok) throw new Error('无法载入效果素材清单')
    const lutManifest = await lutResponse.json() as LutManifest
    const leakManifest = await leakResponse.json() as LeakManifest
    const dazzLutManifest = dazzLutResponse.ok ? await dazzLutResponse.json().catch(() => ({})) as DazzLutManifest : {}
    const dazzLeakManifest = dazzLeakResponse.ok ? await dazzLeakResponse.json().catch(() => ({})) as DazzLeakManifest : {}
    const classicLuts = (lutManifest.luts ?? []).map((item) => ({ ...item, source: 'classic' as const }))
    const dazzLuts = (dazzLutManifest.recipes ?? []).map((item) => ({ ...item, source: 'dazz' as const }))
    const classicLeaks = (leakManifest.light_leaks ?? []).map((item) => ({ ...item, source: 'classic' as const }))
    const dazzLeakGroups = (dazzLeakManifest.groups ?? []).map((group) => ({
      id: group.id,
      leaks: group.light_leaks.map((item) => ({ ...item, source: 'dazz' as const })),
    }))
    this.cameras = dazzLutManifest.cameras ?? []
    this.lutGroups = [{ id: 'classic', luts: classicLuts }, { id: 'dazz', luts: dazzLuts }]
    this.leakGroups = [{ id: 'classic', leaks: classicLeaks }, ...dazzLeakGroups]
    this.luts = [...classicLuts, ...dazzLuts]
    this.leaks = this.leakGroups.flatMap(({ leaks }) => leaks)
    await this.byteCache.pruneOldVersions()
  }

  async loadLut(id: string): Promise<LutCube> {
    await this.load()
    const cached = this.lutCache.get(id)
    if (cached) return cached
    const pending = this.lutInflight.get(id)
    if (pending) return pending
    const descriptor = this.requireLut(id)
    const request = this.loadCubeAsset(id, descriptor, 'preview').then((lut) => {
      cacheBounded(this.lutCache, id, lut, Math.max(76, this.luts.length))
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
    const assetPath = descriptor.source === 'dazz' ? `dazz/light_leaks/${descriptor.asset}` : `light_leaks/${descriptor.asset}`
    const bytes = await requestAsset(assetPath, {
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

  private async loadCubeAsset(id: string, descriptor: LutDescriptor, kind: 'full' | 'preview'): Promise<LutCube> {
    const preview = kind === 'preview'
    const asset = preview ? descriptor.preview_asset : descriptor.asset
    const cubeSize = preview ? descriptor.preview_cube_size : descriptor.cube_size
    const byteLength = preview ? descriptor.preview_byte_length : descriptor.byte_length
    const cacheId = descriptor.source === 'dazz' ? `${id}:${kind}` : id
    let bytes = await this.byteCache.get(cacheId, cubeSize, byteLength)
    if (!bytes) {
      const assetPath = descriptor.source === 'dazz' ? `dazz/luts/${asset}` : `luts/${asset}`
      bytes = await requestAsset(assetPath, {
        roots: this.roots,
        assetKind: 'lut',
        effectId: id,
        expectedByteLength: byteLength,
        fetcher: this.fetcher,
      })
      await this.byteCache.put(cacheId, cubeSize, byteLength, bytes)
    }
    try {
      const raw = await this.decompressLut(bytes, asset, id, 'lut')
      return new LutCube(cubeSize, raw)
    } catch (reason) {
      await this.byteCache.delete(cacheId, cubeSize, byteLength)
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
