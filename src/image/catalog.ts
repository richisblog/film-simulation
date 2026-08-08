import { LutCube } from './lut'

export interface LutDescriptor { id: string; asset: string; cube_size: number; byte_length: number }
export interface LeakDescriptor { id: string; asset: string; byte_length: number }

interface LutManifest { cube_size?: number; luts: LutDescriptor[] }
interface LeakManifest { light_leaks: LeakDescriptor[] }

export class AssetCatalog {
  luts: LutDescriptor[] = []
  leaks: LeakDescriptor[] = []
  private loaded?: Promise<void>
  private lutCache = new Map<string, LutCube>()
  private leakCache = new Map<string, HTMLImageElement>()

  constructor(
    private readonly base = './assets',
    private readonly fetcher: typeof fetch = (input, init) => globalThis.fetch.call(globalThis, input, init),
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
    const descriptor = this.luts.find((item) => item.id === id)
    if (!descriptor) throw new Error(`未知 LUT：${id}`)
    const response = await this.fetchWithTimeout(`${this.base}/luts/${descriptor.asset}`, `下载 LUT 超时：${id}`)
    if (!response.ok) throw new Error(`无法下载 LUT：${id}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length !== descriptor.byte_length) throw new Error(`LUT 资源长度校验失败：${id}`)
    const raw = await this.decompressLut(bytes, descriptor.asset, id)
    const lut = new LutCube(descriptor.cube_size, raw)
    this.lutCache.set(id, lut)
    while (this.lutCache.size > 8) this.lutCache.delete(this.lutCache.keys().next().value!)
    return lut
  }

  async loadLeak(id: string): Promise<HTMLImageElement> {
    await this.load()
    const cached = this.leakCache.get(id)
    if (cached) return cached
    const descriptor = this.leaks.find((item) => item.id === id)
    if (!descriptor) throw new Error(`未知漏光：${id}`)
    const response = await this.fetchWithTimeout(`${this.base}/light_leaks/${descriptor.asset}`, `下载漏光超时：${id}`)
    if (!response.ok) throw new Error(`无法下载漏光：${id}`)
    const blob = await response.blob()
    if (blob.size !== descriptor.byte_length) throw new Error(`漏光资源长度校验失败：${id}`)
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.src = url
    try { await image.decode() } finally { URL.revokeObjectURL(url) }
    this.leakCache.set(id, image)
    while (this.leakCache.size > 4) this.leakCache.delete(this.leakCache.keys().next().value!)
    return image
  }

  private async decompressLut(bytes: Uint8Array, asset: string, id: string): Promise<Uint8Array> {
    if (!asset.endsWith('.deflate')) return bytes
    if (typeof DecompressionStream === 'undefined') throw new Error(`当前浏览器不支持解压 LUT：${id}`)
    try {
      const copy = new Uint8Array(bytes.length)
      copy.set(bytes)
      const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate'))
      return new Uint8Array(await new Response(stream).arrayBuffer())
    } catch {
      throw new Error(`LUT 解压失败：${id}`)
    }
  }

  private async fetchWithTimeout(url: string, timeoutMessage: string): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      return await this.fetcher(url, { signal: controller.signal })
    } catch (reason) {
      if (controller.signal.aborted) throw new Error(timeoutMessage)
      throw reason
    } finally {
      clearTimeout(timer)
    }
  }
}
