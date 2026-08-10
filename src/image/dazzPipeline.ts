import type { LoadedDazzPipeline } from './catalog'

export interface PipelineContext {
  textures: Map<string, ImageData>
  trace?: string[]
}

export function executeDazzPipeline(image: ImageData, pipeline: LoadedDazzPipeline, context: PipelineContext): ImageData {
  for (const stage of pipeline.stages) {
    if (stage.type === 'optical_blur') {
      context.trace?.push('optical_blur')
      boxBlur(image, Math.min(12, Math.max(0, Math.round(stage.radius))))
    } else if (stage.type === 'lut') {
      context.trace?.push(`lut:${stage.lutId}`)
      applyLut(image, stage.lut)
    } else if (stage.amount !== null) {
      context.trace?.push(`grain:${stage.textureId}`)
      const texture = context.textures.get(stage.textureId)
      if (texture) dazzGrainApproximation(image, texture, stage.amount)
    }
  }
  return image
}

function applyLut(image: ImageData, lut: import('./lut').LutCube): void {
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const [r, g, b] = lut.sample(image.data[offset], image.data[offset + 1], image.data[offset + 2])
    image.data[offset] = r; image.data[offset + 1] = g; image.data[offset + 2] = b
  }
}

// Dazz's resource and graph are recovered, but this private Core Image blend kernel is not.
// Keep the approximation named explicitly; see docs/DAZZ_FQS_PIPELINE.md.
export function dazzGrainApproximation(image: ImageData, texture: ImageData, amount: number): void {
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    const target = (y * image.width + x) * 4
    const source = ((y % texture.height) * texture.width + (x % texture.width)) * 4
    const noise = ((texture.data[source] + texture.data[source + 1] + texture.data[source + 2]) / 3 - 127.5) * amount * 0.35
    image.data[target] += noise; image.data[target + 1] += noise; image.data[target + 2] += noise
  }
}

function boxBlur(image: ImageData, radius: number): void {
  if (radius < 1 || image.width * image.height <= 1) return
  const source = new Uint8ClampedArray(image.data)
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    const left = Math.max(0, x - radius), right = Math.min(image.width - 1, x + radius)
    let r = 0, g = 0, b = 0
    for (let sx = left; sx <= right; sx += 1) { const o = (y * image.width + sx) * 4; r += source[o]; g += source[o + 1]; b += source[o + 2] }
    const o = (y * image.width + x) * 4, count = right - left + 1
    image.data[o] = r / count; image.data[o + 1] = g / count; image.data[o + 2] = b / count
  }
}
