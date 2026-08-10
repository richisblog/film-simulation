import { expect, it } from 'vitest'
import { CpuRenderer } from './cpuRenderer'
import type { EditSettings } from './types'

it('renders source pixels through the compatibility pipeline', async () => {
  const pixels = { data: new Uint8ClampedArray([200, 200, 200, 255]), width: 1, height: 1, colorSpace: 'srgb' } as ImageData
  const context = {
    clearRect() {}, drawImage() {},
    getImageData: () => pixels,
    putImageData: (next: ImageData) => { pixels.data.set(next.data) },
  } as unknown as CanvasRenderingContext2D
  const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement
  const settings: EditSettings = { lutId: null, exposure: 1, lutStrength: 100, grain: 0, vignette: 100, leakId: null, leakStrength: 0, seed: 1 }
  await new CpuRenderer().render({} as CanvasImageSource, canvas, settings, null, null, { width: 1, height: 1 })
  expect(canvas.width).toBe(1)
  expect(canvas.height).toBe(1)
  expect([...pixels.data]).toEqual([255, 255, 255, 255])
})
