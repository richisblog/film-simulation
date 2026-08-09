import { useEffect, useRef, useState } from 'react'
import type { LutCube } from '../image/lut'
import { transformPixels } from '../image/pixelEffects'
import { TaskCancelledError, TaskQueue, thumbnailQueue } from '../image/thumbnailQueue'
import { DEFAULT_SETTINGS } from '../image/types'

interface Props {
  source: ImageData
  lutId: string
  loadPreviewLut(id: string): Promise<LutCube>
  queue?: TaskQueue
}

function copyPixels(source: ImageData): ImageData {
  const data = new Uint8ClampedArray(source.data)
  if (typeof ImageData === 'function') return new ImageData(data, source.width, source.height)
  return { data, width: source.width, height: source.height, colorSpace: 'srgb' } as ImageData
}

export function LutThumbnail({ source, lutId, loadPreviewLut, queue = thumbnailQueue }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    if (typeof IntersectionObserver !== 'function') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setVisible(true)
      observer.disconnect()
    }, { root: element.closest('.film-grid'), rootMargin: '100% 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = canvas.current
    if (!element || !visible) return
    let cancelled = false
    setFailed(false)
    element.width = source.width
    element.height = source.height
    const handle = queue.add(async () => {
      const lut = await loadPreviewLut(lutId)
      return transformPixels(copyPixels(source), {
        ...DEFAULT_SETTINGS,
        lutId,
        lutStrength: 100,
        grain: 0,
        vignette: 0,
        leakId: null,
        leakStrength: 0,
      }, lut, null)
    })
    handle.promise.then((pixels) => {
      if (cancelled) return
      const context = element.getContext('2d')
      context?.putImageData(pixels, 0, 0)
    }).catch((reason) => {
      if (!cancelled && !(reason instanceof TaskCancelledError)) setFailed(true)
    })
    return () => {
      cancelled = true
      handle.cancel()
    }
  }, [loadPreviewLut, lutId, queue, source, visible])

  return <><canvas ref={canvas} width={source.width} height={source.height} aria-hidden="true" />
    {failed && <span className="film-thumbnail-error">预览不可用</span>}</>
}
