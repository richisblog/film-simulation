import { expect, it } from 'vitest'
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

it('loads manifests once and selected LUT bytes on demand', async () => {
  const lut = new Uint8Array(2 * 2 * 2 * 3)
  const calls: string[] = []
  const fetcher = async (input: RequestInfo | URL) => {
    const path = String(input)
    calls.push(path)
    if (path.endsWith('/luts/manifest.json')) return new Response(JSON.stringify({ cube_size: 2, luts: [{ id: 'TEST', asset: 'TEST.rgb', cube_size: 2, byte_length: lut.length }] }))
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
    if (path.endsWith('/luts/manifest.json')) return new Response(JSON.stringify({ luts: [{ id: 'BAD', asset: 'BAD.rgb', cube_size: 2, byte_length: 24 }] }))
    if (path.endsWith('/light_leaks/manifest.json')) return new Response(JSON.stringify({ light_leaks: [] }))
    return new Response(new Uint8Array(3))
  }
  const catalog = new AssetCatalog('/assets', fetcher)
  await catalog.load()
  await expect(catalog.loadLut('BAD')).rejects.toThrow('LUT 资源长度校验失败')
})
