import { describe, expect, it } from 'vitest'
import { isAcceptedImageFile, outputFilename } from './formats'
import { LutCube } from './lut'
import { screenChannel, transformPixels } from './pixelEffects'
import { targetSize } from './sizing'
import type { EditSettings } from './types'

const defaults: EditSettings = {
  lutId: null,
  exposure: 0,
  lutStrength: 100,
  grain: 0,
  vignette: 0,
  leakId: null,
  leakStrength: 0,
  seed: 7,
}

const imageData = (values: number[], width: number, height: number) => ({
  data: new Uint8ClampedArray(values), width, height, colorSpace: 'srgb',
}) as ImageData

describe('input formats', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.PNG', ''],
    ['photo.webp', 'image/webp'],
    ['photo.HEIC', ''],
    ['photo.heif', 'image/heif'],
  ])('accepts supported local file %s', (name, type) => {
    expect(isAcceptedImageFile(new File(['x'], name, { type }))).toBe(true)
  })

  it('rejects unrelated files even when a MIME is absent', () => {
    expect(isAcceptedImageFile(new File(['x'], 'notes.txt'))).toBe(false)
  })

  it('adds a safe suffix and requested extension', () => {
    expect(outputFilename('summer.trip.jpeg', 'image/webp')).toBe('summer.trip-胶片模拟.webp')
    expect(outputFilename('.jpeg', 'image/jpeg')).toBe('照片-胶片模拟.jpg')
    expect(outputFilename('summer.jpeg', 'image/jpeg', 'en')).toBe('summer-film-simulation.jpg')
  })
})

describe('output sizing', () => {
  it('preserves ratio with hand-calculated rounding', () => {
    expect(targetSize({ width: 6000, height: 4000 }, 4096)).toEqual({ width: 4096, height: 2731 })
  })

  it('never upscales a smaller source', () => {
    expect(targetSize({ width: 1200, height: 800 }, 4096)).toEqual({ width: 1200, height: 800 })
  })
})

describe('LUT and effects', () => {
  const identity2 = new Uint8Array([
    0, 0, 0, 255, 0, 0, 0, 255, 0, 255, 255, 0,
    0, 0, 255, 255, 0, 255, 0, 255, 255, 255, 255, 255,
  ])

  it('samples identity cube corners and interpolated center', () => {
    const lut = new LutCube(2, identity2)
    expect(lut.sample(255, 0, 255)).toEqual([255, 0, 255])
    expect(lut.sample(128, 128, 128)).toEqual([128, 128, 128])
  })

  it('keeps input unchanged when LUT strength is zero', () => {
    const image = imageData([20, 40, 60, 255], 1, 1)
    const inverted = new LutCube(2, new Uint8Array(identity2.map((value) => 255 - value)))
    transformPixels(image, { ...defaults, lutStrength: 0 }, inverted, null)
    expect([...image.data]).toEqual([20, 40, 60, 255])
  })

  it('adjusts source channels by photographic exposure stops', () => {
    const brighter = imageData([60, 100, 140, 255], 1, 1)
    const darker = imageData([60, 100, 140, 255], 1, 1)

    transformPixels(brighter, { ...defaults, exposure: 1 }, null, null)
    transformPixels(darker, { ...defaults, exposure: -1 }, null, null)

    expect([...brighter.data]).toEqual([120, 200, 255, 255])
    expect([...darker.data]).toEqual([30, 50, 70, 255])
  })

  it('applies exposure before LUT color mapping', () => {
    const image = imageData([64, 64, 64, 255], 1, 1)
    const inverted = new LutCube(2, new Uint8Array(identity2.map((value) => 255 - value)))

    transformPixels(image, { ...defaults, exposure: 1 }, inverted, null)

    expect([...image.data]).toEqual([127, 127, 127, 255])
  })

  it('uses deterministic monochrome grain for the same seed', () => {
    const first = imageData([128, 128, 128, 255], 1, 1)
    const second = imageData([128, 128, 128, 255], 1, 1)
    transformPixels(first, { ...defaults, grain: 40, seed: 99 }, null, null)
    transformPixels(second, { ...defaults, grain: 40, seed: 99 }, null, null)
    expect([...first.data]).toEqual([...second.data])
    expect(first.data[0]).toBe(first.data[1])
    expect(first.data[1]).toBe(first.data[2])
  })

  it('darkens vignette corners while preserving the center', () => {
    const pixels = [...new Uint8ClampedArray(3 * 3 * 4).fill(255)]
    const image = imageData(pixels, 3, 3)
    transformPixels(image, { ...defaults, vignette: 100 }, null, null)
    expect(image.data[0]).toBe(0)
    expect(image.data[(1 * 3 + 1) * 4]).toBe(255)
  })

  it('screen-blends channels with integer rounding', () => {
    expect(screenChannel(128, 128)).toBe(192)
  })
})
