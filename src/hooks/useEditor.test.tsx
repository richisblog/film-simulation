import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { AssetCatalog } from '../image/catalog'
import { AssetLoadError } from '../image/assetRequest'
import { LutCube } from '../image/lut'
import { useEditor } from './useEditor'

afterEach(() => vi.restoreAllMocks())

it('retries the currently selected LUT without changing editor settings', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const failure = new AssetLoadError('timeout', 'lut', 'INSTWARM', '本站', 2, undefined, 40_000)
  const cube = new LutCube(2, new Uint8Array(2 ** 3 * 3))
  const catalog = {
    luts: [], leaks: [], load: vi.fn(async () => undefined),
    loadLut: vi.fn(async () => { throw failure }),
    retryLut: vi.fn(async () => cube),
    preloadLuts: vi.fn(async () => undefined),
    retryFailedLuts: vi.fn(async () => undefined),
    loadPreviewLut: vi.fn(async () => cube),
    loadLeak: vi.fn(),
  } as unknown as AssetCatalog
  const { result } = renderHook(() => useEditor(catalog))

  act(() => result.current.setSettings({ ...result.current.settings, lutId: 'INSTWARM', grain: 73, vignette: 41 }))
  await waitFor(() => expect(result.current.error).toBe(failure))
  const settingsBeforeRetry = result.current.settings

  act(() => result.current.retryError())

  await waitFor(() => expect(catalog.retryLut).toHaveBeenCalledWith('INSTWARM'))
  await waitFor(() => expect(result.current.lut).toBe(cube))
  expect(result.current.settings).toEqual(settingsBeforeRetry)
  expect(result.current.error).toBeNull()
  expect(console.error).toHaveBeenCalledWith('素材加载失败', failure.diagnostic)
})

it('starts non-blocking LUT preload on mount and publishes progress', async () => {
  const progress = {
    total: 36, completed: 12, succeeded: 11, failed: 1,
    active: 24, currentId: 'PT400', percent: 33, done: false,
  }
  const descriptor = {
    id: 'PT400', asset: 'PT400.full.rgb', cube_size: 64, byte_length: 10,
    preview_asset: 'previews/PT400.rgb', preview_cube_size: 8, preview_byte_length: 100,
  }
  const catalog = {
    luts: [descriptor], leaks: [], load: vi.fn(async () => undefined),
    preloadLuts: vi.fn(async (emit: (value: typeof progress) => void) => emit(progress)),
    retryFailedLuts: vi.fn(async () => undefined),
    loadLut: vi.fn(), retryLut: vi.fn(), loadPreviewLut: vi.fn(), loadLeak: vi.fn(),
  } as unknown as AssetCatalog

  const { result } = renderHook(() => useEditor(catalog))

  await waitFor(() => expect(catalog.preloadLuts).toHaveBeenCalledOnce())
  expect(result.current.luts).toEqual([descriptor])
  expect(result.current.lutProgress).toEqual(progress)

  act(() => result.current.retryFailedLuts())
  await waitFor(() => expect(catalog.retryFailedLuts).toHaveBeenCalledOnce())
})

it('preserves an unexpected loading error object for safe presentation-layer localization', async () => {
  const failure = new Error('内部未知错误')
  const catalog = {
    luts: [], leaks: [], load: vi.fn(async () => undefined),
    preloadLuts: vi.fn(async () => undefined), retryFailedLuts: vi.fn(async () => undefined),
    loadLut: vi.fn(async () => { throw failure }), retryLut: vi.fn(), loadPreviewLut: vi.fn(), loadLeak: vi.fn(),
  } as unknown as AssetCatalog
  const { result } = renderHook(() => useEditor(catalog))

  act(() => result.current.setSettings({ ...result.current.settings, lutId: 'INSTWARM' }))

  await waitFor(() => expect(result.current.error).toBe(failure))
})
