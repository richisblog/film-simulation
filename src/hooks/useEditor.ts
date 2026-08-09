import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AssetCatalog, type LeakDescriptor, type LutDescriptor } from '../image/catalog'
import { AssetLoadError } from '../image/assetRequest'
import { decodeImageFile, type DecodedImage } from '../image/decode'
import { isAcceptedImageFile } from '../image/formats'
import { LutCube } from '../image/lut'
import { DEFAULT_SETTINGS, type EditSettings } from '../image/types'

export function useEditor(catalogOverride?: AssetCatalog) {
  const catalog = useMemo(() => catalogOverride ?? new AssetCatalog('./assets'), [catalogOverride])
  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<DecodedImage | null>(null)
  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS)
  const [luts, setLuts] = useState<LutDescriptor[]>([])
  const [leaks, setLeaks] = useState<LeakDescriptor[]>([])
  const [lut, setLut] = useState<LutCube | null>(null)
  const [leak, setLeak] = useState<HTMLImageElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | Error | null>(null)
  const [lutRetryGeneration, setLutRetryGeneration] = useState(0)
  const fileGeneration = useRef(0)
  const lutGeneration = useRef(0)
  const leakGeneration = useRef(0)
  const retryLutId = useRef<string | null>(null)
  const loadLut = useCallback((id: string) => catalog.loadLut(id), [catalog])
  const loadPreviewLut = useCallback((id: string) => catalog.loadPreviewLut(id), [catalog])
  const reportLoadError = useCallback((reason: unknown, fallback: string) => {
    if (reason instanceof AssetLoadError) {
      console.error('素材加载失败', reason.diagnostic)
      setError(reason)
      return
    }
    setError(reason instanceof Error ? reason.message : fallback)
  }, [])

  const openFile = useCallback(async (nextFile: File) => {
    if (!isAcceptedImageFile(nextFile)) {
      setError('请选择 JPEG、PNG、WebP，或当前浏览器能够读取的 HEIC 照片。')
      return
    }
    const request = ++fileGeneration.current
    setBusy(true)
    setError(null)
    try {
      const decoded = await decodeImageFile(nextFile)
      await catalog.load()
      if (request !== fileGeneration.current) { decoded.close(); return }
      setImage(decoded)
      setFile(nextFile)
      setLuts(catalog.luts)
      setLeaks(catalog.leaks)
      setSettings({ ...DEFAULT_SETTINGS, seed: hashName(nextFile.name, nextFile.size) })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取照片')
    } finally {
      if (request === fileGeneration.current) setBusy(false)
    }
  }, [catalog])

  useEffect(() => {
    const request = ++lutGeneration.current
    if (!settings.lutId) { setLut(null); return }
    setLut(null)
    const shouldRetry = retryLutId.current === settings.lutId
    retryLutId.current = null
    const operation = shouldRetry ? catalog.retryLut(settings.lutId) : loadLut(settings.lutId)
    operation.then((value) => {
      if (request === lutGeneration.current) setLut(value)
    }).catch((reason) => {
      if (request === lutGeneration.current) reportLoadError(reason, 'LUT 载入失败')
    })
  }, [catalog, loadLut, lutRetryGeneration, reportLoadError, settings.lutId])

  useEffect(() => {
    const request = ++leakGeneration.current
    if (!settings.leakId) { setLeak(null); return }
    setLeak(null)
    catalog.loadLeak(settings.leakId).then((value) => {
      if (request === leakGeneration.current) setLeak(value)
    }).catch((reason) => {
      if (request === leakGeneration.current) reportLoadError(reason, '漏光载入失败')
    })
  }, [catalog, reportLoadError, settings.leakId])

  useEffect(() => () => image?.close(), [image])

  return {
    file, image, settings, setSettings, luts, leaks, lut, leak, loadLut, loadPreviewLut, busy, error, setError, openFile,
    retryError: () => {
      if (!(error instanceof AssetLoadError) || error.assetKind !== 'lut' || !settings.lutId) return
      retryLutId.current = settings.lutId
      setError(null)
      setLutRetryGeneration((value) => value + 1)
    },
    reset: () => setSettings((current) => ({ ...DEFAULT_SETTINGS, seed: current.seed })),
  }
}

function hashName(name: string, size: number): number {
  let value = size | 0
  for (let index = 0; index < name.length; index += 1) value = Math.imul(value ^ name.charCodeAt(index), 16777619)
  return value >>> 0
}
