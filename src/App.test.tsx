import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import App from './App'

let storedValues: Map<string, string>

beforeEach(() => {
  storedValues = new Map([['film-simulation-language', 'zh-CN']])
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, value),
    removeItem: (key: string) => storedValues.delete(key),
  } })
})

it('shows a local-only privacy promise and accessible file picker', () => {
  render(<App />)
  expect(screen.getByText('胶片模拟')).toBeInTheDocument()
  expect(screen.getByText('本地胶片暗房')).toBeInTheDocument()
  expect(screen.queryByText(/REWIND|LOCAL FILM LAB/)).not.toBeInTheDocument()
  expect(screen.getByText(/胶片仿色测试/)).toBeInTheDocument()
  expect(document.querySelector('input[type="file"]')).toHaveAttribute('accept', expect.stringContaining('image/heic'))
  const footerItems = [...document.querySelector('.support-links')!.children]
  expect(footerItems.map((item) => item.textContent?.trim())).toEqual([
    'GitHub Star',
    '小红书',
  ])
  expect(screen.queryByRole('status', { name: '网站累计浏览量' })).not.toBeInTheDocument()
  expect(screen.getByText('为持续优化使用体验，本页面会记录匿名访问及导出所用的滤镜类型；不会上传或保存您的照片、文件名及个人信息。')).toHaveClass('analytics-privacy-note')
})

it('keeps the empty state and explains an unsupported file', async () => {
  render(<App />)
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(['x'], 'notes.txt')] } })
  expect(await screen.findByRole('alert')).toHaveTextContent('请选择 JPEG、PNG、WebP')
  expect(screen.getByRole('button', { name: '选择照片' })).toBeInTheDocument()
})

it('honors persisted Chinese and can switch to persistent English UI', () => {
  render(<App />)
  expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }))
  expect(screen.getByText('Film Simulation')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Choose Photo' })).toBeInTheDocument()
  expect(document.documentElement).toHaveAttribute('lang', 'en')
  expect(window.localStorage.getItem('film-simulation-language')).toBe('en')
})
