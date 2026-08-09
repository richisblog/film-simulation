import { expect, it, vi } from 'vitest'
import { AssetCatalog } from './catalog'

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

it('loads manifests once and selected full LUT bytes on demand', async () => {
  const lut = new Uint8Array(2 * 2 * 2 * 3)
  const calls: string[] = []
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    calls.push(path)
    if (path.endsWith('/luts/manifest.json')) return new Response(JSON.stringify({ cube_size: 2, luts: [{
      id: 'TEST', asset: 'TEST.rgb', cube_size: 2, byte_length: lut.length,
      preview_asset: 'previews/TEST.rgb', preview_cube_size: 2, preview_byte_length: lut.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [{ id: 'LEAK_01', asset: 'leak.jpg', byte_length: 3 }] }))
    if (path.endsWith('/luts/TEST.rgb')) return new Response(lut)
    throw new Error(`unexpected ${path}`)
  }
  const catalog = new AssetCatalog('/assets', fetcher)
  await catalog.load()
  const first = await catalog.loadLut('TEST')
  const second = await catalog.loadLut('TEST')
  expect(first).toBe(second)
  expect(first.size).toBe(2)
  expect(calls.filter((path) => path.endsWith('manifest.json'))).toHaveLength(2)
  expect(calls.filter((path) => path.endsWith('TEST.rgb'))).toHaveLength(1)
})

it('rejects an asset with a manifest byte-length mismatch', async () => {
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest.json')) return new Response(JSON.stringify({ luts: [{
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

it('loads lightweight preview and full LUT assets through separate paths', async () => {
  const preview = new Uint8Array(2 ** 3 * 3).fill(2)
  const full = new Uint8Array(3 ** 3 * 3).fill(3)
  const calls: string[] = []
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    calls.push(path)
    if (path.endsWith('/luts/manifest.json')) return new Response(JSON.stringify({ luts: [{
      id: 'TEST', asset: 'TEST.full.rgb', cube_size: 3, byte_length: full.length,
      preview_asset: 'previews/TEST.preview.rgb', preview_cube_size: 2, preview_byte_length: preview.length,
    }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    if (path.endsWith('/luts/previews/TEST.preview.rgb')) return new Response(preview)
    if (path.endsWith('/luts/TEST.full.rgb')) return new Response(full)
    throw new Error(`unexpected ${path}`)
  }
  const catalog = new AssetCatalog('/assets', fetcher)

  const previewLut = await catalog.loadPreviewLut('TEST')
  expect(previewLut.size).toBe(2)
  expect(calls).toContain('/assets/luts/previews/TEST.preview.rgb')
  expect(calls).not.toContain('/assets/luts/TEST.full.rgb')

  const fullLut = await catalog.loadLut('TEST')
  expect(fullLut.size).toBe(3)
  expect(calls).toContain('/assets/luts/TEST.full.rgb')
})

it.each([
  ['full', (catalog: AssetCatalog) => catalog.loadLut('TEST')],
  ['preview', (catalog: AssetCatalog) => catalog.loadPreviewLut('TEST')],
] as const)('deduplicates concurrent %s LUT loading and returns one cube instance', async (_kind, load) => {
  const bytes = new Uint8Array(2 ** 3 * 3)
  let release: ((response: Response) => void) | undefined
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest.json')) return new Response(JSON.stringify({ luts: [{
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
  expect(fetcher.mock.calls.filter(([url]) => !String(url).endsWith('manifest.json'))).toHaveLength(1)
  release!(new Response(bytes))

  const [firstCube, secondCube] = await Promise.all([first, second])
  expect(firstCube).toBe(secondCube)
})

it('removes rejected in-flight work so an explicit retry can request again', async () => {
  const bytes = new Uint8Array(2 ** 3 * 3)
  let binaryCalls = 0
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/luts/manifest.json')) return new Response(JSON.stringify({ luts: [{
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
