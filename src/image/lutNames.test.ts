import { expect, it } from 'vitest'
import { LUT_DISPLAY_NAMES, lutDisplayName } from './lutNames'

it('为全部 36 个 LUT 提供唯一中文显示名', () => {
  expect(Object.keys(LUT_DISPLAY_NAMES)).toHaveLength(36)
  expect(new Set(Object.values(LUT_DISPLAY_NAMES)).size).toBe(36)
  expect(lutDisplayName('FJ200')).toBe('富士 C200')
  expect(lutDisplayName('PT400')).toBe('柯达 Portra 400')
  expect(lutDisplayName('VS200')).toBe('爱克发 Vista 200')
})

it('不向用户暴露未知内部 ID', () => {
  expect(lutDisplayName('PRIVATE_ID')).toBe('未命名胶片')
})
