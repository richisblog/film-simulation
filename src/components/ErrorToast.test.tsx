import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AssetLoadError } from '../image/assetRequest'
import { LanguageProvider } from '../i18n'
import { ErrorToast } from './ErrorToast'

function renderEnglish(error: string | Error, onRetry?: () => void) {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: () => 'en',
    setItem: () => undefined,
  } })
  return render(<LanguageProvider><ErrorToast error={error} onClose={vi.fn()} onRetry={onRetry} /></LanguageProvider>)
}

it('shows safe timeout diagnostics and an actionable retry', () => {
  const onRetry = vi.fn()
  const error = new AssetLoadError('timeout', 'lut', 'INSTWARM', '本站', 2, undefined, 20_001)
  render(<ErrorToast error={error} onClose={vi.fn()} onRetry={onRetry} />)

  expect(screen.getByRole('alert')).toHaveTextContent('下载素材超时：INSTWARM')
  expect(screen.getByRole('alert')).toHaveTextContent('本站')
  expect(screen.getByRole('alert')).toHaveTextContent('第 2 次')
  expect(screen.getByText('阶段 超时 · 20001 ms')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重试加载' }))
  expect(onRetry).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '关闭错误' })).toBeInTheDocument()
})

it('does not offer retry for an unsupported browser error', () => {
  const error = new AssetLoadError('unsupported', 'lut', 'INSTWARM', '本站', 1, undefined, 0)
  render(<ErrorToast error={error} onClose={vi.fn()} onRetry={vi.fn()} />)

  expect(screen.queryByRole('button', { name: '重试加载' })).not.toBeInTheDocument()
})

it('continues to present ordinary editor messages without technical detail', () => {
  render(<ErrorToast error="请选择支持的照片" onClose={vi.fn()} />)

  expect(screen.getByRole('alert')).toHaveTextContent('请选择支持的照片')
  expect(screen.queryByText(/阶段/)).not.toBeInTheDocument()
})

it('renders structured asset failures entirely in English', () => {
  const error = new AssetLoadError('integrity', 'lut', 'INSTWARM', '本站', 2, undefined, 531)

  renderEnglish(error)

  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent('Downloaded asset is incomplete: INSTWARM (local site, attempt 2).')
  expect(alert).toHaveTextContent('Stage file integrity · 531 ms')
  expect(alert.textContent).not.toMatch(/[\u3400-\u9fff]/u)
})

it('does not expose an unknown Chinese internal error in English UI', () => {
  renderEnglish(new Error('内部未知错误'))

  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
  expect(screen.getByRole('alert').textContent).not.toMatch(/[\u3400-\u9fff]/u)
})
