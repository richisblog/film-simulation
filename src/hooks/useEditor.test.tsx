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
