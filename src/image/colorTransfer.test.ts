import { expect, it } from 'vitest'
import { linearToSrgb, srgbToLinear } from './colorTransfer'

it.each([0, 0.04045, 0.5, 1])('round trips IEC sRGB value %s', (value) => {
  expect(linearToSrgb(srgbToLinear(value))).toBeCloseTo(value, 6)
})

it('matches canonical IEC sRGB transfer points', () => {
  expect(srgbToLinear(0)).toBe(0)
  expect(srgbToLinear(0.04045)).toBeCloseTo(0.0031308, 6)
  expect(srgbToLinear(0.5)).toBeCloseTo(0.21404114, 6)
  expect(srgbToLinear(1)).toBe(1)
})
