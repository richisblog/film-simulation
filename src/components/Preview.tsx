import { useEffect, useRef, useState } from 'react'
import type { DecodedImage } from '../image/decode'
import { LutCube } from '../image/lut'
import { createRenderer } from '../image/renderer'
import type { EditSettings } from '../image/types'

interface Props { image: DecodedImage; settings: EditSettings; lut: LutCube | null; leak: HTMLImageElement | null }

export function Preview({ image, settings, lut, leak }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [original, setOriginal] = useState(false)
  const [mode, setMode] = useState<'webgl2' | 'cpu'>('webgl2')
  const [forceCpu, setForceCpu] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canvas.current) return
    const currentCanvas = canvas.current
    const handleContextLost = () => setForceCpu(true)
    currentCanvas.addEventListener('webglcontextlost', handleContextLost)
    const renderer = createRenderer(currentCanvas, forceCpu ? { createWebGl: () => null } : {})
    setMode(renderer.mode)
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const size = { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) }
    const frame = requestAnimationFrame(() => {
      const shown = original ? { ...settings, lutStrength: 0, grain: 0, vignette: 0, leakStrength: 0 } : settings
      renderer.render(image.source, shown, original ? null : lut, original ? null : leak, size).catch((reason) => {
        setError(reason instanceof Error ? reason.message : '预览失败')
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      currentCanvas.removeEventListener('webglcontextlost', handleContextLost)
      renderer.dispose()
    }
  }, [image, settings, lut, leak, original, forceCpu])

  return (
    <section className="preview-stage" aria-label="照片预览区">
      <canvas key={forceCpu ? 'cpu' : 'gpu'} ref={canvas} role="img" aria-label={original ? '原图预览' : '效果预览'} />
      <div className="preview-actions">
        <button type="button" className="compare-button" aria-pressed={original} onClick={() => setOriginal((value) => !value)}>
          {original ? '返回效果' : '对比原图'}
        </button>
        <span className="render-mode">{mode === 'webgl2' ? '图形加速预览' : '兼容模式'}</span>
      </div>
      {error && <p role="alert" className="inline-error">{error}</p>}
    </section>
  )
}
