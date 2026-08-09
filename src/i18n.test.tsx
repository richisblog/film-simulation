import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LanguageProvider, manifestHref, resolveInitialLanguage, useLanguage } from './i18n'

function LanguageHarness() {
  const { language, setLanguage, copy } = useLanguage()
  return <div>
    <span>{language}</span>
    <span>{copy.title}</span>
    <button type="button" onClick={() => setLanguage('en')}>English</button>
  </div>
}

beforeEach(() => {
  const values = new Map<string, string>()
  const storage: Storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
  window.localStorage.clear()
  document.documentElement.lang = ''
  document.title = ''
  document.head.innerHTML = `
    <meta name="description" content="">
    <meta name="apple-mobile-web-app-title" content="">
    <link rel="manifest" href="./manifest-zh.webmanifest">
  `
})

afterEach(() => cleanup())

describe('resolveInitialLanguage', () => {
  it('uses Chinese for any Chinese browser locale and English for all others', () => {
    expect(resolveInitialLanguage(null, ['zh-HK', 'en-US'])).toBe('zh-CN')
    expect(resolveInitialLanguage(null, ['fr-FR', 'en-US'])).toBe('en')
  })

  it('gives a valid persisted choice priority and ignores invalid storage', () => {
    expect(resolveInitialLanguage('en', ['zh-CN'])).toBe('en')
    expect(resolveInitialLanguage('zh-CN', ['en-US'])).toBe('zh-CN')
    expect(resolveInitialLanguage('invalid', ['zh-TW'])).toBe('zh-CN')
  })
})

describe('LanguageProvider', () => {
  it('synchronizes the English document identity and persists an explicit switch', () => {
    window.localStorage.setItem('film-simulation-language', 'zh-CN')
    render(<LanguageProvider><LanguageHarness /></LanguageProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByText('Film Simulation')).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(document.title).toBe('Film Simulation')
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      'content',
      'A film simulation tool that processes photos locally in your browser',
    )
    expect(document.querySelector('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Film Simulation')
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute('href', './manifest-en.webmanifest')
    expect(window.localStorage.getItem('film-simulation-language')).toBe('en')
  })

  it('keeps the current session usable when persistence is unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('blocked') } })
    try {
      render(<LanguageProvider><LanguageHarness /></LanguageProvider>)
      fireEvent.click(screen.getByRole('button', { name: 'English' }))
      expect(screen.getByText('Film Simulation')).toBeInTheDocument()
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
    }
  })
})

it('maps each language to its localized install manifest', () => {
  expect(manifestHref('zh-CN')).toBe('./manifest-zh.webmanifest')
  expect(manifestHref('en')).toBe('./manifest-en.webmanifest')
})
