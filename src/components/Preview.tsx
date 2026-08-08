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
  const originalCanvas = useRef<HTMLCanvasElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const [compare, setCompare] = useState(false)
  const [mode, setMode] = useState<'webgl2' | 'cpu'>('webgl2')
  const [forceCpu, setForceCpu] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewport, setViewport] = useState<{ w: number; h: number } | null>(null)

  // 效果画布：始终渲染当前滤镜效果（对比模式下位于右侧）
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
      renderer.render(image.source, settings, lut, leak, size).catch((reason) => {
        setError(reason instanceof Error ? reason.message : '预览失败')
      })
    })
    return () => {
      cancelAnimationFrame(frame)
      currentCanvas.removeEventListener('webglcontextlost', handleContextLost)
      renderer.dispose()
    }
  }, [image, settings, lut, leak, forceCpu])

  // 原图画布：对比模式下用 2D 直接绘制原图（无需滤镜渲染）
  useEffect(() => {
    if (!compare || !originalCanvas.current) return
    const el = originalCanvas.current
    const ctx = el.getContext('2d')
    if (!ctx) return
    const scale = Math.min(1, PREVIEW_MAX_LONG_EDGE / Math.max(image.width, image.height))
    const w = Math.max(1, Math.round(image.width * scale))
    const h = Math.max(1, Math.round(image.height * scale))
    el.width = w
    el.height = h
    ctx.drawImage(image.source as CanvasImageSource, 0, 0, w, h)
  }, [image, compare])

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

  // 按原始宽高比例等比缩放至窗口内（contain），绝不压扁或拉伸；对比模式各占一半
  const display = useMemo<{ w: number; h: number } | null>(() => {
    if (!viewport || viewport.w <= 0 || viewport.h <= 0) return null
    const availW = compare ? Math.max(1, (viewport.w - 6) / 2) : viewport.w
    const ratio = image.width / image.height
    let w = availW
    let h = w / ratio
    if (h > viewport.h) { h = viewport.h; w = h * ratio }
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
  }, [viewport, image.width, image.height, compare])

  return (
    <section className={`preview-stage ${compare ? 'comparing' : ''}`} aria-label="照片预览区">
      <div className="preview-window" ref={windowRef}>
        {compare && (
          <canvas
            ref={originalCanvas}
            role="img"
            aria-label="原图对比"
            className="original-canvas"
            style={display ? { width: display.w, height: display.h } : undefined}
          />
        )}
        <canvas
          key={forceCpu ? 'cpu' : 'gpu'}
          ref={canvas}
          role="img"
          aria-label={compare ? '效果对比' : '效果预览'}
          style={display ? { width: display.w, height: display.h } : undefined}
        />
        <div className="preview-actions">
          <button type="button" className="compare-button" aria-pressed={compare} onClick={() => setCompare((value) => !value)}>
            {compare ? '返回效果' : '对比原图'}
          </button>
          <span className="render-mode">{mode === 'webgl2' ? '图形加速预览' : '兼容模式'}</span>
        </div>
        {error && <p role="alert" className="inline-error">{error}</p>}
      </div>
    </section>
  )
}
