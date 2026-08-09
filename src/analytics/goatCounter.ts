export interface GoatCounterOptions {
  siteUrl: string
  location: Pick<Location, 'hostname' | 'protocol'>
  document: Document
}

interface GoatCounterEvent {
  path: string
  title: string
  event: true
  no_session: true
}

interface GoatCounterClient {
  count: (event: GoatCounterEvent) => void
}

declare global {
  interface Window {
    goatcounter?: GoatCounterClient
  }
}

export interface FilterExportTrackingOptions {
  siteUrl: string
  location: Pick<Location, 'hostname' | 'protocol'>
  window: Window
  language: Language
  lutId: string | null
  lutName: string | null
  retryIntervalMs?: number
  maxWaitMs?: number
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

export function trackFilterExport(options: FilterExportTrackingOptions): boolean {
  if (!serviceOrigin(options.siteUrl) || !isProductionPage(options.location)) return false

  const event: GoatCounterEvent = options.lutId
    ? {
        path: `export-filter-${options.lutId}`,
        title: options.language === 'en'
          ? `Export filter: ${options.lutName ?? options.lutId}`
          : `导出滤镜：${options.lutName ?? options.lutId}`,
        event: true,
        no_session: true,
      }
    : {
        path: 'export-filter-NONE',
        title: options.language === 'en' ? 'Export filter: No filter' : '导出滤镜：未使用滤镜',
        event: true,
        no_session: true,
      }
  const retryIntervalMs = options.retryIntervalMs ?? 100
  const maxWaitMs = options.maxWaitMs ?? 3_000

  const sendWhenReady = (elapsedMs: number) => {
    if (options.window.goatcounter?.count) {
      try {
        options.window.goatcounter.count(event)
      } catch {
        // Optional telemetry must never affect export.
      }
      return
    }
    if (elapsedMs >= maxWaitMs) return
    options.window.setTimeout(() => sendWhenReady(elapsedMs + retryIntervalMs), retryIntervalMs)
  }

  sendWhenReady(0)
  return true
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
import type { Language } from '../i18n'
