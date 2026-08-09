import { describe, expect, it, vi } from 'vitest'
import type { AssetRoot } from '../config/assets'
import { AssetLoadError, requestAsset } from './assetRequest'

const cdnAndSite: AssetRoot[] = [
  { base: 'https://cdn.example.com/assets', label: 'CDN' },
  { base: './assets', label: '本站' },
]
const siteOnly: AssetRoot[] = [{ base: './assets', label: '本站' }]
const context = { assetKind: 'lut' as const, effectId: 'INSTWARM' }

describe('requestAsset', () => {
  it('keeps the deadline active until the complete response body is consumed', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: () => new Promise<ArrayBuffer>(() => undefined),
    } as Response))

    const result = requestAsset('luts/INSTWARM.rgb.deflate', {
      ...context, roots: siteOnly, fetcher, timeoutMs: 5, retryDelayMs: 0,
    })

    await expect(result).rejects.toMatchObject({
      category: 'timeout', source: '本站', attempt: 2,
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('falls back from a CDN network failure to packaged same-origin bytes', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('connection failed'))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))

    await expect(requestAsset('luts/INSTWARM.rgb.deflate', {
      ...context, roots: cdnAndSite, fetcher, expectedByteLength: 3, retryDelayMs: 0,
    })).resolves.toEqual(new Uint8Array([1, 2, 3]))
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://cdn.example.com/assets/luts/INSTWARM.rgb.deflate',
      './assets/luts/INSTWARM.rgb.deflate',
    ])
  })

  it.each([404, 503])('falls back from CDN HTTP %s to same-origin', async (status) => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(new Response(new Uint8Array([7])))

    await expect(requestAsset('luts/TEST.rgb', {
      ...context, roots: cdnAndSite, fetcher, expectedByteLength: 1, retryDelayMs: 0,
    })).resolves.toEqual(new Uint8Array([7]))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('does not retry a same-origin HTTP 404', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }))

    await expect(requestAsset('luts/MISSING.rgb', {
      ...context, roots: siteOnly, fetcher, retryDelayMs: 0,
    })).rejects.toMatchObject({ category: 'http', status: 404, attempt: 1 })
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('retries one transient same-origin failure exactly once', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response(new Uint8Array([9, 8])))

    await expect(requestAsset('luts/TEST.rgb', {
      ...context, roots: siteOnly, fetcher, expectedByteLength: 2, retryDelayMs: 0,
    })).resolves.toEqual(new Uint8Array([9, 8]))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('falls back when CDN bytes have the wrong compressed length', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1])))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))

    await expect(requestAsset('luts/TEST.rgb', {
      ...context, roots: cdnAndSite, fetcher, expectedByteLength: 3, retryDelayMs: 0,
    })).resolves.toEqual(new Uint8Array([1, 2, 3]))
  })

  it('returns a safe structured final diagnostic', async () => {
    let current = 100
    const fetcher = vi.fn(async () => { current += 25; throw new TypeError('secret URL query') })

    const error = await requestAsset('luts/INSTWARM.rgb.deflate?private=name.jpg', {
      ...context,
      roots: siteOnly,
      fetcher,
      retryDelayMs: 0,
      now: () => current,
    }).catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(AssetLoadError)
    if (!(error instanceof AssetLoadError)) throw error
    expect(error).toMatchObject({
      category: 'network', assetKind: 'lut', effectId: 'INSTWARM', source: '本站', attempt: 2,
    })
    expect(error.diagnostic).toEqual({
      category: 'network', assetKind: 'lut', effectId: 'INSTWARM', source: '本站', attempt: 2,
      status: undefined, elapsedMs: 25,
    })
    expect(JSON.stringify(error.diagnostic)).not.toContain('name.jpg')
    expect(JSON.stringify(error.diagnostic)).not.toContain('secret URL query')
  })
})
