import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { LutPreloadProgress } from '../image/catalog'
import { LutLoadProgress } from './LutLoadProgress'

it('shows completed count, percentage, and the most recently settled LUT', () => {
  const progress: LutPreloadProgress = {
    total: 36, completed: 12, succeeded: 11, failed: 1,
    active: 24, currentId: 'PT400', percent: 33, done: false,
  }

  render(<LutLoadProgress progress={progress} onRetry={vi.fn()} />)

  expect(screen.getByRole('status')).toHaveTextContent('正在准备胶片色彩')
  expect(screen.getByRole('status')).toHaveTextContent('已完成 12 / 36 · 33%')
  expect(screen.getByRole('status')).toHaveTextContent('刚完成第 12 个：柯达 Portra 400')
  expect(screen.getByRole('progressbar', { name: '胶片色彩加载进度' })).toHaveAttribute('value', '12')
})

it('keeps successful items usable and offers retry when part of the preload failed', () => {
  const retry = vi.fn()
  const progress: LutPreloadProgress = {
    total: 36, completed: 36, succeeded: 35, failed: 1,
    active: 0, currentId: 'INSTWARM', percent: 100, done: true,
  }

  render(<LutLoadProgress progress={progress} onRetry={retry} />)

  expect(screen.getByRole('status')).toHaveTextContent('35 个可用 · 1 个待重试')
  fireEvent.click(screen.getByRole('button', { name: '重试未完成色彩' }))
  expect(retry).toHaveBeenCalledOnce()
})

it('announces when every LUT is ready', () => {
  const progress: LutPreloadProgress = {
    total: 36, completed: 36, succeeded: 36, failed: 0,
    active: 0, currentId: 'VS200', percent: 100, done: true,
  }

  render(<LutLoadProgress progress={progress} onRetry={vi.fn()} />)

  expect(screen.getByRole('status')).toHaveTextContent('胶片色彩已就绪（36 / 36）')
})
