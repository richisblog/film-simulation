import { expect, it } from 'vitest'
import type { LoadedDazzPipeline } from './catalog'
import { executeDazzPipeline } from './dazzPipeline'
import { LutCube } from './lut'

const identity = new LutCube(2, new Uint8Array([
  0, 0, 0, 255, 0, 0, 0, 255, 0, 255, 255, 0,
  0, 0, 255, 255, 0, 255, 0, 255, 255, 255, 255, 255,
]))

it('executes native stages in manifest order and skips unresolved null lowlight amount', () => {
  const trace: string[] = []
  const pipeline: LoadedDazzPipeline = { id: 'FQS', stages: [
    { type: 'optical_blur', radius: 6, angle: 0, quality: 5 },
    { type: 'grain', textureId: 'GRAIN_OU', texture: new Uint8Array(), amount: 1 },
    { type: 'lut', lutId: 'OU_LIGHT', lut: identity, inputEncoding: 'srgb' },
    { type: 'grain', textureId: 'GRAIN_OU_LOWLIGHT', texture: new Uint8Array(), amount: null },
    { type: 'lut', lutId: 'OU_COLOR', lut: identity, inputEncoding: 'srgb' },
  ] }
  const image = { data: new Uint8ClampedArray([90, 100, 110, 255]), width: 1, height: 1, colorSpace: 'srgb' } as ImageData

  executeDazzPipeline(image, pipeline, { trace, textures: new Map() })

  expect(trace).toEqual(['optical_blur', 'grain:GRAIN_OU', 'lut:OU_LIGHT', 'lut:OU_COLOR'])
})
