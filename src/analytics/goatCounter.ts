export interface GoatCounterOptions {
  siteUrl: string
  location: Pick<Location, 'hostname' | 'protocol'>
  document: Document
}

const SCRIPT_SELECTOR = 'script[data-goatcounter]'
const SCRIPT_URL = 'https://gc.zgo.at/count.js'
const TRACKING_SETTINGS = JSON.stringify({ path: '/', no_events: true })

export function startPageviewTracking(options: GoatCounterOptions): boolean {
  const origin = serviceOrigin(options.siteUrl)
  if (!origin || !isProductionPage(options.location)) return false
  if (options.document.querySelector(SCRIPT_SELECTOR)) return true

  const script = options.document.createElement('script')
  script.async = true
  script.src = SCRIPT_URL
  script.dataset.goatcounter = `${origin}/count`
  script.dataset.goatcounterSettings = TRACKING_SETTINGS
  options.document.head.append(script)
  return true
}

export async function readTotalPageviews(
  siteUrl: string,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  signal?: AbortSignal,
): Promise<string> {
  const origin = serviceOrigin(siteUrl)
  if (!origin) throw new Error('浏览量服务地址无效')

  try {
    const response = await fetcher(`${origin}/counter/TOTAL.json`, { signal })
    if (!response.ok) throw new Error('invalid status')
    const payload = await response.json() as { count?: unknown }
    if (typeof payload.count !== 'string' || !/^\d{1,3}(?:,\d{3})*$/.test(payload.count)) {
      throw new Error('invalid count')
    }
    return payload.count
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') throw reason
    throw new Error('浏览量响应无效', { cause: reason })
  }
}

function serviceOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

function isProductionPage(location: Pick<Location, 'hostname' | 'protocol'>): boolean {
  if (location.protocol !== 'https:') return false
  const hostname = location.hostname.toLowerCase()
  return !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)
}
