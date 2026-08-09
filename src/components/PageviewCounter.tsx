import { useEffect, useState } from 'react'
import { readTotalPageviews, startPageviewTracking } from '../analytics/goatCounter'

interface PageviewCounterProps {
  siteUrl?: string
}

type CounterState = { status: 'loading' | 'unavailable' } | { status: 'ready'; count: string }

export function PageviewCounter({ siteUrl }: PageviewCounterProps) {
  const [state, setState] = useState<CounterState>({ status: 'loading' })

  useEffect(() => {
    if (!siteUrl) {
      setState({ status: 'unavailable' })
      return
    }

    startPageviewTracking({ siteUrl, location: window.location, document })
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5_000)
    let active = true

    readTotalPageviews(siteUrl, undefined, controller.signal)
      .then((count) => { if (active) setState({ status: 'ready', count }) })
      .catch(() => { if (active) setState({ status: 'unavailable' }) })
      .finally(() => window.clearTimeout(timeout))

    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [siteUrl])

  const label = state.status === 'ready'
    ? `已浏览 ${state.count} 次`
    : state.status === 'loading' ? '浏览量读取中' : '浏览量暂不可用'

  return <span className="social-btn social-views" role="status" aria-label="网站累计浏览量">
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path fill="currentColor" d="M12 5c5.5 0 9.6 5.2 9.8 5.4a2.5 2.5 0 0 1 0 3.2C21.6 13.8 17.5 19 12 19S2.4 13.8 2.2 13.6a2.5 2.5 0 0 1 0-3.2C2.4 10.2 6.5 5 12 5Zm0 2c-4.5 0-8 4.4-8.2 4.7a.5.5 0 0 0 0 .6C4 12.6 7.5 17 12 17s8-4.4 8.2-4.7a.5.5 0 0 0 0-.6C20 11.4 16.5 7 12 7Zm0 2.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Zm0 2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6Z" />
    </svg>
    <span>{label}</span>
  </span>
}
