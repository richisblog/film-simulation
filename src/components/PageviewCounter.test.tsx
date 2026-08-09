import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { readTotalPageviews } from '../analytics/goatCounter'
import { PageviewCounter } from './PageviewCounter'

vi.mock('../analytics/goatCounter', () => ({
  startPageviewTracking: vi.fn(() => true),
  readTotalPageviews: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(readTotalPageviews).mockReset()
})

it('moves from loading to the formatted cumulative pageview total', async () => {
  let resolveCount!: (count: string) => void
  vi.mocked(readTotalPageviews).mockReturnValue(new Promise((resolve) => { resolveCount = resolve }))

  render(<PageviewCounter siteUrl="https://film-simulation.goatcounter.com" />)
  expect(screen.getByRole('status', { name: '网站累计浏览量' })).toHaveTextContent('浏览量读取中')

  resolveCount('12,345')
  expect(await screen.findByText('已浏览 12,345 次')).toBeVisible()
})

it('shows a stable unavailable state when the counter request fails', async () => {
  vi.mocked(readTotalPageviews).mockRejectedValue(new Error('blocked'))
  render(<PageviewCounter siteUrl="https://film-simulation.goatcounter.com" />)
  expect(await screen.findByText('浏览量暂不可用')).toBeVisible()
})

it('disables itself cleanly when no analytics site is configured', async () => {
  render(<PageviewCounter />)
  expect(await screen.findByText('浏览量暂不可用')).toBeVisible()
})
