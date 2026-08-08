import { LutCube } from './lut'
import { transformPixels } from './pixelEffects'
import type { EditSettings, ImageSize } from './types'

function leakImageData(image: CanvasImageSource | null, width: number, height: number): ImageData | null {
  if (!image) return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('浏览器无法建立兼容画布')
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : (image as ImageBitmap).width
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : (image as ImageBitmap).height
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  return context.getImageData(0, 0, width, height)
}

export class CpuRenderer {
  readonly mode = 'cpu' as const

  async render(
    source: CanvasImageSource,
    canvas: HTMLCanvasElement,
    settings: EditSettings,
    lut: LutCube | null,
    leak: CanvasImageSource | null,
    size: ImageSize,
  ): Promise<void> {
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('浏览器无法建立兼容画布')
    context.clearRect(0, 0, size.width, size.height)
    context.drawImage(source, 0, 0, size.width, size.height)
    const pixels = context.getImageData(0, 0, size.width, size.height)
    transformPixels(pixels, settings, lut, leakImageData(leak, size.width, size.height))
    context.putImageData(pixels, 0, 0)
  }
}
