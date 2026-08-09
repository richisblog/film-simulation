import { expect, it, vi } from 'vitest'
import { AssetCatalog } from './catalog'
import type { LutByteCache } from './persistentLutCache'

class MemoryLutByteCache implements LutByteCache {
  readonly entries = new Map<string, Uint8Array>()
  readonly deleted: string[] = []

  private key(id: string, cubeSize: number, byteLength: number) {
    return `${id}:${cubeSize}:${byteLength}`
  }

  async get(id: string, cubeSize: number, byteLength: number) {
    const bytes = this.entries.get(this.key(id, cubeSize, byteLength))
    return bytes ? Uint8Array.from(bytes) : null
  }

  async put(id: string, cubeSize: number, byteLength: number, bytes: Uint8Array) {
    this.entries.set(this.key(id, cubeSize, byteLength), Uint8Array.from(bytes))
  }

  async delete(id: string, cubeSize: number, byteLength: number) {
    const key = this.key(id, cubeSize, byteLength)
    this.deleted.push(key)
    this.entries.delete(key)
  }

  async pruneOldVersions() {}
}

it('calls the browser fetch function with the Window receiver', async () => {
  const original = window.fetch
  const receivers: unknown[] = []
  window.fetch = function (this: unknown, input: RequestInfo | URL) {
    receivers.push(this)
    const body = String(input).includes('light_leaks') ? { light_leaks: [] } : { luts: [] }
    return Promise.resolve(new Response(JSON.stringify(body)))
  }
  try {
    await new AssetCatalog('/assets').load()
    expect(receivers).toEqual([window, window])
  } finally {
    window.fetch = original
  }
})

it('loads manifests once and selected canonical 8-cube bytes on demand', async () => {
  const lut = new Uint8Array(2 * 2 * 2 * 3)
  const calls: string[] = []
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    calls.push(path)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ cube_size: 2, luts: [{
      id: 'TEST', asset: 'TEST.rgb', cube_size: 2, byte_length: lut.length,
      preview_asset: 'previews/TEST.rgb', preview_cube_size: 2, preview_byte_length: lut.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [{ id: 'LEAK_01', asset: 'leak.jpg', byte_length: 3 }] }))
    if (path.endsWith('/luts/previews/TEST.rgb')) return new Response(lut)
    throw new Error(`unexpected ${path}`)
  }
  const catalog = new AssetCatalog('/assets', fetcher)
  await catalog.load()
  const first = await catalog.loadLut('TEST')
  const second = await catalog.loadLut('TEST')
  expect(first).toBe(second)
  expect(first.size).toBe(2)
  expect(calls.filter((path) => path.includes('manifest'))).toHaveLength(2)
  expect(calls).toContain('/assets/luts/manifest-8cube-v1.json')
  expect(calls.filter((path) => path.endsWith('TEST.rgb'))).toHaveLength(1)
})

it('rejects an asset with a manifest byte-length mismatch', async () => {
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ luts: [{
      id: 'BAD', asset: 'BAD.rgb', cube_size: 2, byte_length: 24,
      preview_asset: 'previews/BAD.rgb', preview_cube_size: 2, preview_byte_length: 24,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    return new Response(new Uint8Array(3))
  }
  const catalog = new AssetCatalog('/assets', fetcher)
  await catalog.load()
  await expect(catalog.loadLut('BAD')).rejects.toThrow('素材文件不完整')
})

it('shares one canonical preview asset and cube across main and thumbnail APIs', async () => {
  const preview = new Uint8Array(2 ** 3 * 3).fill(2)
  const calls: string[] = []
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    calls.push(path)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ luts: [{
      id: 'TEST', asset: 'TEST.full.rgb', cube_size: 3, byte_length: 81,
      preview_asset: 'previews/TEST.preview.rgb', preview_cube_size: 2, preview_byte_length: preview.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    if (path.endsWith('/luts/previews/TEST.preview.rgb')) return new Response(preview)
    if (path.endsWith('/luts/TEST.full.rgb')) throw new Error('64-cube asset must not be requested')
    throw new Error(`unexpected ${path}`)
  }
  const catalog = new AssetCatalog('/assets', fetcher)

  const [mainLut, previewLut] = await Promise.all([
    catalog.loadLut('TEST'),
    catalog.loadPreviewLut('TEST'),
  ])
  expect(mainLut).toBe(previewLut)
  expect(mainLut.size).toBe(2)
  expect(calls.filter((path) => path.endsWith('/luts/previews/TEST.preview.rgb'))).toHaveLength(1)
  expect(calls).not.toContain('/assets/luts/TEST.full.rgb')
})

it('uses validated persistent bytes without making a binary network request', async () => {
  const bytes = new Uint8Array(2 ** 3 * 3).fill(7)
  const byteCache = new MemoryLutByteCache()
  await byteCache.put('TEST', 2, bytes.length, bytes)
  const binaryCalls: string[] = []
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ luts: [{
      id: 'TEST', asset: 'TEST.full.rgb', cube_size: 64, byte_length: 10,
      preview_asset: 'previews/TEST.rgb', preview_cube_size: 2, preview_byte_length: bytes.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    binaryCalls.push(path)
    throw new Error('persistent hit must not fetch')
  }
  const catalog = new AssetCatalog('/assets', fetcher, undefined, byteCache)

  await expect(catalog.loadLut('TEST')).resolves.toMatchObject({ size: 2 })
  expect(binaryCalls).toEqual([])
})

it('persists validated network bytes for the next page load', async () => {
  const bytes = new Uint8Array(2 ** 3 * 3).fill(5)
  const byteCache = new MemoryLutByteCache()
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ luts: [{
      id: 'TEST', asset: 'TEST.full.rgb', cube_size: 64, byte_length: 10,
      preview_asset: 'previews/TEST.rgb', preview_cube_size: 2, preview_byte_length: bytes.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    return new Response(bytes)
  }
  const catalog = new AssetCatalog('/assets', fetcher, undefined, byteCache)

  await catalog.loadLut('TEST')

  expect(await byteCache.get('TEST', 2, bytes.length)).toEqual(bytes)
})

it('evicts persistent compressed bytes when decompression fails', async () => {
  const corrupt = new Uint8Array([1, 2, 3, 4])
  const byteCache = new MemoryLutByteCache()
  await byteCache.put('BAD', 2, corrupt.length, corrupt)
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ luts: [{
      id: 'BAD', asset: 'BAD.full.rgb.deflate', cube_size: 64, byte_length: 10,
      preview_asset: 'previews/BAD.rgb.deflate', preview_cube_size: 2, preview_byte_length: corrupt.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    throw new Error('persistent hit must not fetch')
  }
  const catalog = new AssetCatalog('/assets', fetcher, undefined, byteCache)

  await expect(catalog.loadLut('BAD')).rejects.toThrow('素材解压失败')
  expect(byteCache.deleted).toEqual([`BAD:2:${corrupt.length}`])
})

it('starts all 36 preloads together, isolates failure, and retries only the missing LUT', async () => {
  const bytes = new Uint8Array(2 ** 3 * 3)
  const descriptors = Array.from({ length: 36 }, (_, index) => {
    const id = `LUT${String(index).padStart(2, '0')}`
    return {
      id, asset: `${id}.full.rgb`, cube_size: 64, byte_length: 10,
      preview_asset: `previews/${id}.rgb`, preview_cube_size: 2, preview_byte_length: bytes.length,
    }
  })
  const releases = new Map<string, (response: Response) => void>()
  const binaryCalls: string[] = []
  let retrying = false
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ luts: descriptors }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    const id = path.match(/(LUT\d{2})\.rgb$/)?.[1]
    if (!id) throw new Error(`unexpected ${path}`)
    binaryCalls.push(id)
    if (retrying) return new Response(bytes)
    return new Promise<Response>((resolve) => releases.set(id, resolve))
  }
  const catalog = new AssetCatalog('/assets', fetcher, undefined, new MemoryLutByteCache())
  const snapshots: Array<{ completed: number; succeeded: number; failed: number; active: number; done: boolean }> = []

  const preload = catalog.preloadLuts((progress) => snapshots.push(progress))
  await vi.waitFor(() => expect(releases.size).toBe(36))
  for (const [id, release] of releases) release(id === 'LUT35' ? new Response(null, { status: 404 }) : new Response(bytes))
  await preload

  expect(snapshots.at(-1)).toMatchObject({ completed: 36, succeeded: 35, failed: 1, active: 0, done: true })
  expect(snapshots.map((item) => item.completed)).toEqual([...snapshots.map((_, index) => index)])

  retrying = true
  binaryCalls.length = 0
  await catalog.retryFailedLuts(() => undefined)
  expect(binaryCalls).toEqual(['LUT35'])
})

it.each([
  ['full', (catalog: AssetCatalog) => catalog.loadLut('TEST')],
  ['preview', (catalog: AssetCatalog) => catalog.loadPreviewLut('TEST')],
] as const)('deduplicates concurrent %s LUT loading and returns one cube instance', async (_kind, load) => {
  const bytes = new Uint8Array(2 ** 3 * 3)
  let release: ((response: Response) => void) | undefined
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ luts: [{
      id: 'TEST', asset: 'TEST.rgb', cube_size: 2, byte_length: bytes.length,
      preview_asset: 'previews/TEST.rgb', preview_cube_size: 2, preview_byte_length: bytes.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    return new Promise<Response>((resolve) => { release = resolve })
  })
  const catalog = new AssetCatalog('/assets', fetcher)
  await catalog.load()

  const first = load(catalog)
  const second = load(catalog)
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  expect(fetcher.mock.calls.filter(([url]) => !String(url).includes('manifest'))).toHaveLength(1)
  release!(new Response(bytes))

  const [firstCube, secondCube] = await Promise.all([first, second])
  expect(firstCube).toBe(secondCube)
})

it('removes rejected in-flight work so an explicit retry can request again', async () => {
  const bytes = new Uint8Array(2 ** 3 * 3)
  let binaryCalls = 0
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest-8cube-v1.json')) return new Response(JSON.stringify({ luts: [{
      id: 'TEST', asset: 'TEST.rgb', cube_size: 2, byte_length: bytes.length,
      preview_asset: 'previews/TEST.rgb', preview_cube_size: 2, preview_byte_length: bytes.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    binaryCalls += 1
    return binaryCalls === 1 ? new Response(null, { status: 404 }) : new Response(bytes)
  })
  const catalog = new AssetCatalog('/assets', fetcher)

  await expect(catalog.loadLut('TEST')).rejects.toThrow()
  await expect(catalog.retryLut('TEST')).resolves.toMatchObject({ size: 2 })
  expect(binaryCalls).toBe(2)
})
