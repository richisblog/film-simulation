import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../i18n'
import { InstallPrompt } from './InstallPrompt'

const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'

beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: iphoneSafari })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })
})

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('InstallPrompt copy', () => {
  it.each([
    ['zh-CN', '添加「胶片模拟」到主屏幕', '知道了'],
    ['en', 'Add Film Simulation to Home Screen', 'Got it'],
  ] as const)('renders entirely in %s', async (language, title, confirm) => {
    vi.useFakeTimers()
    window.localStorage.setItem('film-simulation-language', language)

    render(<LanguageProvider><InstallPrompt /></LanguageProvider>)
    await act(async () => { vi.advanceTimersByTime(1_200) })

    expect(screen.getByRole('dialog')).toHaveTextContent(title)
    expect(screen.getByRole('button', { name: confirm })).toBeInTheDocument()
  })
})
