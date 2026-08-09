import { assetRoots, type AssetRoot } from '../config/assets'
import { AssetLoadError, requestAsset, type AssetKind } from './assetRequest'
import { LutCube } from './lut'

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

const browserFetch: typeof fetch = (input, init) => globalThis.fetch.call(globalThis, input, init)

export class AssetCatalog {
  luts: LutDescriptor[] = []
  leaks: LeakDescriptor[] = []
  private loaded?: Promise<void>
  private readonly lutCache = new Map<string, LutCube>()
  private readonly previewLutCache = new Map<string, LutCube>()
  private readonly leakCache = new Map<string, HTMLImageElement>()
  private readonly lutInflight = new Map<string, Promise<LutCube>>()
  private readonly previewLutInflight = new Map<string, Promise<LutCube>>()

  constructor(
    private readonly base = './assets',
    private readonly fetcher: typeof fetch = browserFetch,
    private readonly roots: AssetRoot[] = assetRoots(import.meta.env.VITE_ASSET_BASE_URL, base),
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
  }

  async loadLut(id: string): Promise<LutCube> {
    await this.load()
    const cached = this.lutCache.get(id)
    if (cached) return cached
    const pending = this.lutInflight.get(id)
    if (pending) return pending
    const descriptor = this.requireLut(id)
    const request = this.loadCube(
      id, descriptor.asset, descriptor.cube_size, descriptor.byte_length, 'lut',
    ).then((lut) => {
      cacheBounded(this.lutCache, id, lut, 8)
      return lut
    }).finally(() => this.lutInflight.delete(id))
    this.lutInflight.set(id, request)
    return request
  }

  async loadPreviewLut(id: string): Promise<LutCube> {
    await this.load()
    const cached = this.previewLutCache.get(id)
    if (cached) return cached
    const pending = this.previewLutInflight.get(id)
    if (pending) return pending
    const descriptor = this.requireLut(id)
    const request = this.loadCube(
      id,
      descriptor.preview_asset,
      descriptor.preview_cube_size,
      descriptor.preview_byte_length,
      'preview-lut',
    ).then((lut) => {
      cacheBounded(this.previewLutCache, id, lut, 36)
      return lut
    }).finally(() => this.previewLutInflight.delete(id))
    this.previewLutInflight.set(id, request)
    return request
  }

  retryLut(id: string): Promise<LutCube> {
    this.lutCache.delete(id)
    this.lutInflight.delete(id)
    return this.loadLut(id)
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

  private async loadCube(
    id: string,
    asset: string,
    cubeSize: number,
    byteLength: number,
    assetKind: AssetKind,
  ): Promise<LutCube> {
    const bytes = await requestAsset(`luts/${asset}`, {
      roots: this.roots,
      assetKind,
      effectId: id,
      expectedByteLength: byteLength,
      fetcher: this.fetcher,
    })
    const raw = await this.decompressLut(bytes, asset, id, assetKind)
    return new LutCube(cubeSize, raw)
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
