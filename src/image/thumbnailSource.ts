import type { ImageSize } from './types'

export const THUMBNAIL_SIZE: ImageSize = { width: 120, height: 84 }

export function coverRect(source: ImageSize, target: ImageSize): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(target.width / source.width, target.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  return { x: (target.width - width) / 2, y: (target.height - height) / 2, width, height }
}

export function createThumbnailSource(
  source: CanvasImageSource,
  sourceSize: ImageSize,
  createCanvas: () => HTMLCanvasElement = () => document.createElement('canvas'),
): ImageData {
  const canvas = createCanvas()
  canvas.width = THUMBNAIL_SIZE.width
  canvas.height = THUMBNAIL_SIZE.height
  const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null
  if (!context) throw new Error('浏览器无法生成胶片缩略图')
  const rect = coverRect(sourceSize, THUMBNAIL_SIZE)
  context.drawImage(source, rect.x, rect.y, rect.width, rect.height)
  return context.getImageData(0, 0, THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height)
}
