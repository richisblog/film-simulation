import { render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LutCube } from '../image/lut'
import { LutThumbnail } from './LutThumbnail'

const identityLut = new LutCube(2, new Uint8Array([
  0, 0, 0, 255, 0, 0, 0, 255, 0, 255, 255, 0,
  0, 0, 255, 255, 0, 255, 0, 255, 255, 255, 255, 255,
]))

const source = {
  width: 2,
  height: 2,
  data: new Uint8ClampedArray([
    20, 40, 60, 255, 80, 100, 120, 255,
    140, 160, 180, 255, 200, 220, 240, 255,
  ]),
  colorSpace: 'srgb',
} as ImageData

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('只在卡片进入可见区域后加载并绘制 LUT', async () => {
  let notify: IntersectionObserverCallback = () => undefined
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
    root = null
    rootMargin = ''
    thresholds = []
  })
  const putImageData = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData } as unknown as CanvasRenderingContext2D)
  const loadLut = vi.fn(async () => identityLut)
  const { container } = render(<div className="film-grid"><LutThumbnail source={source} lutId="PT400" loadLut={loadLut} /></div>)

  expect(loadLut).not.toHaveBeenCalled()
  notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)

  await waitFor(() => expect(loadLut).toHaveBeenCalledWith('PT400'))
  await waitFor(() => expect(putImageData).toHaveBeenCalledOnce())
  expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
})

it('缩略图加载失败时保留可点击卡片所需的画布', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData: vi.fn() } as unknown as CanvasRenderingContext2D)
  const loadLut = vi.fn(async () => { throw new Error('网络失败') })
  const { container } = render(<LutThumbnail source={source} lutId="PT400" loadLut={loadLut} />)

  await waitFor(() => expect(loadLut).toHaveBeenCalledOnce())
  expect(container.querySelector('canvas')).toBeInTheDocument()
})
