import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AssetCatalog, type DazzCameraDescriptor, type LeakDescriptor, type LeakGroup, type LoadedDazzPipeline, type LutDescriptor, type LutGroup, type LutPreloadProgress } from '../image/catalog'
import { AssetLoadError } from '../image/assetRequest'
import { decodeImageFile, type DecodedImage } from '../image/decode'
import { isAcceptedImageFile } from '../image/formats'
import { LutCube } from '../image/lut'
import { DEFAULT_SETTINGS, type EditSettings } from '../image/types'
import { useLanguage } from '../i18n'

export function useEditor(catalogOverride?: AssetCatalog) {
  const { copy } = useLanguage()
  const catalog = useMemo(() => catalogOverride ?? new AssetCatalog('./assets'), [catalogOverride])
  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<DecodedImage | null>(null)
  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS)
  const [luts, setLuts] = useState<LutDescriptor[]>([])
  const [leaks, setLeaks] = useState<LeakDescriptor[]>([])
  const [cameras, setCameras] = useState<DazzCameraDescriptor[]>([])
  const [lutGroups, setLutGroups] = useState<LutGroup[]>([])
  const [leakGroups, setLeakGroups] = useState<LeakGroup[]>([])
  const [lut, setLut] = useState<LutCube | null>(null)
  const [pipeline, setPipeline] = useState<LoadedDazzPipeline | null>(null)
  const [leak, setLeak] = useState<HTMLImageElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | Error | null>(null)
  const [lutProgress, setLutProgress] = useState<LutPreloadProgress>({
    total: 0, completed: 0, succeeded: 0, failed: 0,
    active: 0, currentId: null, percent: 0, done: false,
  })
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
    setError(reason instanceof Error ? reason : fallback)
  }, [])

  useEffect(() => {
    let active = true
    const publish = (progress: LutPreloadProgress) => {
      if (active) setLutProgress(progress)
    }
    void catalog.load().then(() => {
      if (!active) return
      setLuts(catalog.luts)
      setLeaks(catalog.leaks)
      setCameras(catalog.cameras ?? [])
      setLutGroups(catalog.lutGroups ?? [])
      setLeakGroups(catalog.leakGroups ?? [])
      return catalog.preloadLuts(publish)
    }).catch(() => {
      // Background preparation must not overwrite a newer user-facing editor error.
    })
    return () => { active = false }
  }, [catalog])

  const openFile = useCallback(async (nextFile: File) => {
    if (!isAcceptedImageFile(nextFile)) {
      setError(copy.unsupportedFile)
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
      setCameras(catalog.cameras ?? [])
      setLutGroups(catalog.lutGroups ?? [])
      setLeakGroups(catalog.leakGroups ?? [])
      setSettings({ ...DEFAULT_SETTINGS, seed: hashName(nextFile.name, nextFile.size) })
    } catch (reason) {
      setError(reason instanceof Error ? reason : copy.readFailed)
    } finally {
      if (request === fileGeneration.current) setBusy(false)
    }
  }, [catalog, copy.readFailed, copy.unsupportedFile])

  useEffect(() => {
    const request = ++lutGeneration.current
    if (!settings.lutId) { setLut(null); setPipeline(null); return }
    setLut(null)
    setPipeline(null)
    const shouldRetry = retryLutId.current === settings.lutId
    retryLutId.current = null
    const operation = shouldRetry
      ? catalog.retryLut(settings.lutId).then((value) => ({ lut: value, pipeline: null }))
      : (typeof catalog.loadPipeline === 'function'
          ? catalog.loadPipeline(settings.lutId).then(async (value) => value
            ? { lut: null, pipeline: value }
            : { lut: await loadLut(settings.lutId!), pipeline: null })
          : loadLut(settings.lutId).then((value) => ({ lut: value, pipeline: null })))
    operation.then((value) => {
      if (request === lutGeneration.current) {
        setLut(value.lut)
        setPipeline(value.pipeline)
      }
    }).catch((reason) => {
      if (request === lutGeneration.current) reportLoadError(reason, copy.lutLoadFailed)
    })
  }, [catalog, copy.lutLoadFailed, loadLut, lutRetryGeneration, reportLoadError, settings.lutId])

  useEffect(() => {
    const request = ++leakGeneration.current
    if (!settings.leakId) { setLeak(null); return }
    setLeak(null)
    catalog.loadLeak(settings.leakId).then((value) => {
      if (request === leakGeneration.current) setLeak(value)
    }).catch((reason) => {
      if (request === leakGeneration.current) reportLoadError(reason, copy.leakLoadFailed)
    })
  }, [catalog, copy.leakLoadFailed, reportLoadError, settings.leakId])

  useEffect(() => () => image?.close(), [image])

  return {
    file, image, settings, setSettings, luts, leaks, cameras, lutGroups, leakGroups, lut, pipeline, leak, loadLut, loadPreviewLut,
    lutProgress, busy, error, setError, openFile,
    retryFailedLuts: () => { void catalog.retryFailedLuts(setLutProgress) },
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
