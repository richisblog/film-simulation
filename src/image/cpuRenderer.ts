import { LutCube } from './lut'
import type { LoadedDazzPipeline } from './catalog'
import { executeDazzPipeline } from './dazzPipeline'
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
    pipeline: LoadedDazzPipeline | null,
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
    const leakPixels = leakImageData(leak, size.width, size.height)
    if (!pipeline) {
      transformPixels(pixels, settings, lut, leakPixels)
    } else {
      transformPixels(pixels, { ...settings, lutStrength: 0, grain: 0, vignette: 0 }, null, leakPixels)
      const before = new Uint8ClampedArray(pixels.data)
      const textures = await decodePipelineTextures(pipeline)
      executeDazzPipeline(pixels, pipeline, { textures })
      const strength = settings.lutStrength / 100
      for (let offset = 0; offset < pixels.data.length; offset += 4) for (let channel = 0; channel < 3; channel += 1) {
        pixels.data[offset + channel] = before[offset + channel] + (pixels.data[offset + channel] - before[offset + channel]) * strength
      }
      transformPixels(pixels, { ...settings, exposure: 0, lutStrength: 0, leakStrength: 0 }, null, null)
    }
    context.putImageData(pixels, 0, 0)
  }
}

async function decodePipelineTextures(pipeline: LoadedDazzPipeline): Promise<Map<string, ImageData>> {
  const result = new Map<string, ImageData>()
  for (const stage of pipeline.stages) {
    if (stage.type !== 'grain' || stage.amount === null || result.has(stage.textureId)) continue
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(stage.texture)]))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('浏览器无法解码 Dazz 颗粒纹理')
    context.drawImage(bitmap, 0, 0)
    result.set(stage.textureId, context.getImageData(0, 0, bitmap.width, bitmap.height))
    bitmap.close()
  }
  return result
}
