import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DecodedImage } from '../image/decode'
import { LutCube } from '../image/lut'
import { createRenderer } from '../image/renderer'
import type { EditSettings } from '../image/types'

interface Props { image: DecodedImage; settings: EditSettings; lut: LutCube | null; leak: HTMLImageElement | null }

// 预览窗口长边封顶：取 1200 与屏幕可用尺寸的较小值
const PREVIEW_MAX_LONG_EDGE = 1200

export function Preview({ image, settings, lut, leak }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const [original, setOriginal] = useState(false)
  const [mode, setMode] = useState<'webgl2' | 'cpu'>('webgl2')
  const [forceCpu, setForceCpu] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    if (!canvas.current) return
    const currentCanvas = canvas.current
    const handleContextLost = () => setForceCpu(true)
    currentCanvas.addEventListener('webglcontextlost', handleContextLost)
    const renderer = createRenderer(currentCanvas, forceCpu ? { createWebGl: () => null } : {})
    setMode(renderer.mode)
    const scale = Math.min(1, PREVIEW_MAX_LONG_EDGE / Math.max(image.width, image.height))
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

  // 测量预览窗口尺寸：窗口大小固定（不随图片变化），仅随屏幕布局变化
  useLayoutEffect(() => {
    const el = windowRef.current
    if (!el) return
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 按原始宽高比例等比缩放至窗口内（contain），绝不压扁或拉伸
  const display = useMemo<{ w: number; h: number } | null>(() => {
    if (!viewport || viewport.w <= 0 || viewport.h <= 0) return null
    const ratio = image.width / image.height
    let w = viewport.w
    let h = w / ratio
    if (h > viewport.h) { h = viewport.h; w = h * ratio }
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
  }, [viewport, image.width, image.height])

  return (
    <section className="preview-stage" aria-label="照片预览区">
      <div className="preview-window" ref={windowRef}>
        <canvas
          key={forceCpu ? 'cpu' : 'gpu'}
          ref={canvas}
          role="img"
          aria-label={original ? '原图预览' : '效果预览'}
          style={display ? { width: display.w, height: display.h } : undefined}
        />
        <div className="preview-actions">
          <button type="button" className="compare-button" aria-pressed={original} onClick={() => setOriginal((value) => !value)}>
            {original ? '返回效果' : '对比原图'}
          </button>
          <span className="render-mode">{mode === 'webgl2' ? '图形加速预览' : '兼容模式'}</span>
        </div>
        {error && <p role="alert" className="inline-error">{error}</p>}
      </div>
    </section>
  )
}
