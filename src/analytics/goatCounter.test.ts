import { afterEach, describe, expect, it, vi } from 'vitest'
import { readTotalPageviews, startPageviewTracking } from './goatCounter'

const productionLocation = { hostname: 'film.richis.top', protocol: 'https:' }
const siteUrl = 'https://film-simulation.goatcounter.com'

afterEach(() => {
  document.querySelectorAll('script[data-goatcounter]').forEach((element) => element.remove())
})

describe('startPageviewTracking', () => {
  it('injects one canonical pageview collector for a production page', () => {
    const options = { siteUrl, location: productionLocation, document }

    expect(startPageviewTracking(options)).toBe(true)
    expect(startPageviewTracking(options)).toBe(true)

    const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-goatcounter]')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://gc.zgo.at/count.js')
    expect(scripts[0].async).toBe(true)
    expect(scripts[0].dataset.goatcounter).toBe(`${siteUrl}/count`)
    expect(scripts[0].dataset.goatcounterSettings).toBe('{"path":"/","no_events":true}')
  })

  it.each([
    { hostname: 'localhost', protocol: 'https:' },
    { hostname: '127.0.0.1', protocol: 'https:' },
    { hostname: 'film.richis.top', protocol: 'http:' },
  ])('does not track an ineligible page at $protocol//$hostname', (location) => {
    expect(startPageviewTracking({ siteUrl, location, document })).toBe(false)
    expect(document.querySelector('script[data-goatcounter]')).toBeNull()
  })

  it.each(['', 'not a URL', 'http://film-simulation.goatcounter.com'])('rejects an unsafe service URL: %s', (unsafeUrl) => {
    expect(startPageviewTracking({ siteUrl: unsafeUrl, location: productionLocation, document })).toBe(false)
    expect(document.querySelector('script[data-goatcounter]')).toBeNull()
  })
})

describe('readTotalPageviews', () => {
  it('returns GoatCounter’s validated formatted total', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      count: '12,345',
      count_unique: '12,345',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const controller = new AbortController()

    await expect(readTotalPageviews(`${siteUrl}/`, fetcher, controller.signal)).resolves.toBe('12,345')
    expect(fetcher).toHaveBeenCalledWith(`${siteUrl}/counter/TOTAL.json`, {
      signal: controller.signal,
    })
  })

  it.each([
    new Response('', { status: 503 }),
    new Response(JSON.stringify({ count: '' }), { status: 200 }),
    new Response(JSON.stringify({ count: 'many' }), { status: 200 }),
    new Response(JSON.stringify({ count_unique: '12' }), { status: 200 }),
  ])('rejects an unavailable or malformed counter response', async (response) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
    await expect(readTotalPageviews(siteUrl, fetcher)).rejects.toThrow('浏览量响应无效')
  })

  it('rejects an unsafe counter service URL before making a request', async () => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(readTotalPageviews('http://stats.example.com', fetcher)).rejects.toThrow('浏览量服务地址无效')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
