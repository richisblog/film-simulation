import { expect, it, vi } from 'vitest'
import { coverRect, createThumbnailSource } from './thumbnailSource'

it('中央裁切横图到 120 × 84', () => {
  expect(coverRect({ width: 400, height: 200 }, { width: 120, height: 84 }))
    .toEqual({ x: -24, y: 0, width: 168, height: 84 })
})

it('只缩放一次原图并返回固定大小的共享像素', () => {
  const result = { width: 120, height: 84 } as ImageData
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => result),
  }
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement
  const source = {} as CanvasImageSource

  expect(createThumbnailSource(source, { width: 400, height: 200 }, () => canvas)).toBe(result)
  expect(canvas.width).toBe(120)
  expect(canvas.height).toBe(84)
  expect(context.drawImage).toHaveBeenCalledWith(source, -24, 0, 168, 84)
  expect(context.getImageData).toHaveBeenCalledWith(0, 0, 120, 84)
})
