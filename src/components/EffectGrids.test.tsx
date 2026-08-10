import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { LeakDescriptor, LutDescriptor } from '../image/catalog'
import { DEFAULT_SETTINGS } from '../image/types'
import { Controls } from './Controls'

const luts: LutDescriptor[] = Array.from({ length: 36 }, (_, index) => ({
  id: index === 0 ? 'PT400' : `LUT_${index}`,
  asset: `lut-${index}.rgb`,
  cube_size: 64,
  byte_length: 786432,
  preview_asset: `previews/lut-${index}.rgb`,
  preview_cube_size: 16,
  preview_byte_length: 12288,
}))

const leaks: LeakDescriptor[] = Array.from({ length: 20 }, (_, index) => ({
  id: `LEAK_${index + 1}`,
  asset: `leak-${index + 1}.jpg`,
  byte_length: 1024,
}))

const thumbnailSource = {
  width: 120,
  height: 84,
  data: new Uint8ClampedArray(120 * 84 * 4),
  colorSpace: 'srgb',
} as ImageData

it('胶片和漏光分别组成三列纵向网格', () => {
  vi.stubGlobal('IntersectionObserver', class { observe() {}; disconnect() {} })
  render(<Controls
    settings={{ ...DEFAULT_SETTINGS, lutId: 'PT400' }}
    luts={luts}
    leaks={leaks}
    thumbnailSource={thumbnailSource}
    loadPreviewLut={vi.fn()}
    onChange={vi.fn()}
    onReset={vi.fn()}
  />)

  expect(screen.getByRole('radiogroup', { name: '胶片滤镜' }).children).toHaveLength(36)
  expect(screen.getByRole('button', { name: '选择原图' })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: '漏光效果' }).children).toHaveLength(21)
  expect(screen.getByRole('radio', { name: '关闭漏光' })).toBeInTheDocument()
})

it('标题旁的原图按钮取消当前 LUT', () => {
  vi.stubGlobal('IntersectionObserver', class { observe() {}; disconnect() {} })
  const onChange = vi.fn()
  render(<Controls
    settings={{ ...DEFAULT_SETTINGS, lutId: 'PT400' }}
    luts={luts}
    leaks={leaks}
    thumbnailSource={thumbnailSource}
    loadPreviewLut={vi.fn()}
    onChange={onChange}
    onReset={vi.fn()}
  />)

  fireEvent.click(screen.getByRole('button', { name: '选择原图' }))
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lutId: null }))
})

it('按 Dazz 相机分类，并为多配方相机打开二级菜单', () => {
  vi.stubGlobal('IntersectionObserver', class { observe() {}; disconnect() {} })
  const onChange = vi.fn()
  const dazzRecipes: LutDescriptor[] = ['ORIGINAL', 'FXN2'].map((variant) => ({
    id: `DAZZ_FXN_${variant}`, camera_id: 'FXN', name_zh: variant === 'ORIGINAL' ? '原版' : '偏暖', name_en: variant,
    source: 'dazz', asset: `full/${variant}.rgb`, cube_size: 64, byte_length: 1,
    preview_asset: `preview/${variant}.rgb`, preview_cube_size: 8, preview_byte_length: 1,
  }))
  render(<Controls settings={DEFAULT_SETTINGS} luts={[...luts, ...dazzRecipes]} leaks={leaks}
    lutGroups={[{ id: 'classic', luts }, { id: 'dazz', luts: dazzRecipes }]}
    cameras={[{ id: 'FXN', name_zh: 'FXN', name_en: 'FXN', default_recipe_id: dazzRecipes[0].id, recipe_ids: dazzRecipes.map(({ id }) => id) }]}
    leakGroups={[{ id: 'classic', leaks }, { id: 'dazz-general', leaks: [{ id: 'DAZZ_LEAK_GENERAL_01', asset: 'general/01.webp', byte_length: 1, source: 'dazz' }] }]}
    thumbnailSource={thumbnailSource} loadPreviewLut={vi.fn()} onChange={onChange} onReset={vi.fn()} />)

  expect(screen.getByText('DAZZ CAMERA · 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /FXN2 种偏向/ }))
  fireEvent.click(screen.getByRole('radio', { name: /偏暖/ }))
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lutId: 'DAZZ_FXN_FXN2' }))
  expect(screen.getByRole('radiogroup', { name: 'Dazz 通用漏光 · 1' })).toBeInTheDocument()
})
