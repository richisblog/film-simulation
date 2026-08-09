import { afterEach, describe, expect, it, vi } from 'vitest'
import { startPageviewTracking, trackFilterExport } from './goatCounter'

const productionLocation = { hostname: 'film.richis.top', protocol: 'https:' }
const siteUrl = 'https://film-simulation.goatcounter.com'

afterEach(() => {
  vi.useRealTimers()
  document.querySelectorAll('script[data-goatcounter]').forEach((element) => element.remove())
  delete window.goatcounter
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

describe('trackFilterExport', () => {
  it('records every successful filtered export as an event', () => {
    const count = vi.fn()
    window.goatcounter = { count }

    expect(trackFilterExport({
      siteUrl,
      location: productionLocation,
      window,
      lutId: 'INSTWARM',
      lutName: '暖调拍立得',
    })).toBe(true)
    expect(count).toHaveBeenCalledOnce()
    expect(count).toHaveBeenCalledWith({
      path: 'export-filter-INSTWARM',
      title: '导出滤镜：暖调拍立得',
      event: true,
      no_session: true,
    })
  })

  it('keeps exports without a LUT in the preference denominator', () => {
    const count = vi.fn()
    window.goatcounter = { count }

    trackFilterExport({ siteUrl, location: productionLocation, window, lutId: null, lutName: null })

    expect(count).toHaveBeenCalledWith({
      path: 'export-filter-NONE',
      title: '导出滤镜：未使用滤镜',
      event: true,
      no_session: true,
    })
  })

  it('waits briefly for the asynchronous collector and sends exactly once', () => {
    vi.useFakeTimers()
    const count = vi.fn()

    trackFilterExport({
      siteUrl,
      location: productionLocation,
      window,
      lutId: 'INSTWARM',
      lutName: '暖调拍立得',
      retryIntervalMs: 100,
      maxWaitMs: 300,
    })
    vi.advanceTimersByTime(99)
    window.goatcounter = { count }
    vi.advanceTimersByTime(1_000)

    expect(count).toHaveBeenCalledOnce()
  })

  it('gives up silently when the collector remains unavailable', () => {
    vi.useFakeTimers()

    expect(() => {
      trackFilterExport({
        siteUrl,
        location: productionLocation,
        window,
        lutId: 'INSTWARM',
        lutName: '暖调拍立得',
        retryIntervalMs: 100,
        maxWaitMs: 300,
      })
      vi.advanceTimersByTime(1_000)
    }).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not schedule events for local, insecure, or invalid configurations', () => {
    vi.useFakeTimers()

    expect(trackFilterExport({
      siteUrl,
      location: { hostname: 'localhost', protocol: 'https:' },
      window,
      lutId: 'INSTWARM',
      lutName: '暖调拍立得',
    })).toBe(false)
    expect(trackFilterExport({
      siteUrl: 'http://analytics.invalid',
      location: productionLocation,
      window,
      lutId: 'INSTWARM',
      lutName: '暖调拍立得',
    })).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
