import { LutCube } from './lut'
import type { EditSettings } from './types'

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const mix = (first: number, second: number, amount: number) => first + (second - first) * amount

export function screenChannel(base: number, overlay: number): number {
  return 255 - Math.round(((255 - base) * (255 - overlay)) / 255)
}

function random01(seed: number, x: number, y: number): number {
  let value = (seed ^ Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca6b)) | 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return (value >>> 0) / 4294967296
}

function leakCoordinate(x: number, y: number, width: number, height: number, leak: ImageData): number {
  const scale = Math.max(width / leak.width, height / leak.height)
  const renderedWidth = leak.width * scale
  const renderedHeight = leak.height * scale
  const sourceX = Math.floor(((x + (renderedWidth - width) / 2) / scale)).valueOf()
  const sourceY = Math.floor(((y + (renderedHeight - height) / 2) / scale)).valueOf()
  return (Math.max(0, Math.min(leak.height - 1, sourceY)) * leak.width + Math.max(0, Math.min(leak.width - 1, sourceX))) * 4
}

export function transformPixels(
  image: ImageData,
  settings: EditSettings,
  lut: LutCube | null,
  leak: ImageData | null,
): ImageData {
  const lutAmount = settings.lutStrength / 100
  const exposureMultiplier = 2 ** settings.exposure
  const grainAmount = settings.grain / 100
  const vignetteAmount = settings.vignette / 100
  const leakAmount = settings.leakStrength / 100
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4
      let red = image.data[offset]
      let green = image.data[offset + 1]
      let blue = image.data[offset + 2]
      red *= exposureMultiplier
      green *= exposureMultiplier
      blue *= exposureMultiplier
      if (leak && leakAmount > 0) {
        const leakOffset = leakCoordinate(x, y, image.width, image.height, leak)
        red = mix(red, screenChannel(red, leak.data[leakOffset]), leakAmount)
        green = mix(green, screenChannel(green, leak.data[leakOffset + 1]), leakAmount)
        blue = mix(blue, screenChannel(blue, leak.data[leakOffset + 2]), leakAmount)
      }
      if (lut && lutAmount > 0) {
        const sampled = lut.sample(red, green, blue)
        red = mix(red, sampled[0], lutAmount)
        green = mix(green, sampled[1], lutAmount)
        blue = mix(blue, sampled[2], lutAmount)
      }
      if (grainAmount > 0) {
        const noise = (random01(settings.seed, x, y) - 0.5) * 2 * grainAmount * 80
        red += noise
        green += noise
        blue += noise
      }
      if (vignetteAmount > 0) {
        const nx = image.width === 1 ? 0 : x * 2 / (image.width - 1) - 1
        const ny = image.height === 1 ? 0 : y * 2 / (image.height - 1) - 1
        const distance = Math.min(1, Math.sqrt((nx * nx + ny * ny) / 2))
        const factor = 1 - vignetteAmount * distance * distance * distance
        red *= factor
        green *= factor
        blue *= factor
      }
      image.data[offset] = clampByte(red)
      image.data[offset + 1] = clampByte(green)
      image.data[offset + 2] = clampByte(blue)
    }
  }
  return image
}
