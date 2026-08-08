import { useMemo, useState } from 'react'
import { Controls } from './components/Controls'
import { DropZone } from './components/DropZone'
import { ExportSheet } from './components/ExportSheet'
import { Preview } from './components/Preview'
import { canvasToBlob } from './export/encode'
import { outputFilename } from './image/formats'
import { createRenderer } from './image/renderer'
import { targetSize } from './image/sizing'
import { createThumbnailSource } from './image/thumbnailSource'
import type { ExportOptions } from './image/types'
import { useEditor } from './hooks/useEditor'

export default function App() {
  const editor = useEditor()
  const [showExport, setShowExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState('')
  const thumbnailSource = useMemo(() => editor.image
    ? createThumbnailSource(editor.image.source, editor.image)
    : null, [editor.image])

  const exportPhoto = async (options: ExportOptions) => {
    if (!editor.image || !editor.file) return
    setExporting(true)
    editor.setError(null)
    setStatus('正在本地渲染照片')
    const canvas = document.createElement('canvas')
    const renderer = createRenderer(canvas)
    try {
      const size = targetSize(editor.image, options.maxLongEdge)
      if (Math.max(size.width, size.height) > renderer.maxSize) throw new Error(`当前设备最大支持 ${renderer.maxSize} 像素长边，请选择较低分辨率。`)
      await renderer.render(editor.image.source, editor.settings, editor.lut, editor.leak, size)
      const blob = await canvasToBlob(canvas, options.mime, options.quality)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = outputFilename(editor.file.name, options.mime)
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus(`已生成 ${anchor.download}`)
      setShowExport(false)
    } catch (reason) {
      editor.setError(reason instanceof Error ? reason.message : '导出失败')
      setStatus('导出失败')
    } finally {
      renderer.dispose()
      setExporting(false)
    }
  }

  return (
    <>
      <div className="notice-bar" role="note">仅供个人测试和对比使用，请勿用于商业用途</div>
      <main className={`app-shell ${editor.image ? 'editing' : ''}`}>
      <header className="app-header"><div className="brand"><span>胶片模拟</span></div>
        {editor.image && <div className="header-actions"><DropZone compact busy={editor.busy} onFile={editor.openFile} />
          <button type="button" className="export-button" onClick={() => setShowExport(true)}>导出</button></div>}
      </header>
      {!editor.image ? <section className="empty-state">
        <div className="hero-copy"><p className="eyebrow">本地胶片暗房</p>
          <h1>把一张照片，<br />带回胶片时代。</h1>
          <p>胶片仿色测试</p></div>
        <DropZone busy={editor.busy} onFile={editor.openFile} />
        <div className="format-note"><span>支持</span> JPEG · PNG · WebP · HEIC*</div>
      </section> : <div className="editor-grid">
        <div className="workspace"><div className="file-meta"><span>{editor.file?.name}</span><span>{editor.image.width} × {editor.image.height}</span></div>
          <Preview image={editor.image} settings={editor.settings} lut={editor.lut} leak={editor.leak} /></div>
        <Controls settings={editor.settings} luts={editor.luts} leaks={editor.leaks}
          thumbnailSource={thumbnailSource!} loadLut={editor.loadLut}
          onChange={editor.setSettings} onReset={editor.reset} />
      </div>}
      {editor.error && <div role="alert" className="error-toast"><strong>出现问题</strong><span>{editor.error}</span>
        <button type="button" aria-label="关闭错误" onClick={() => editor.setError(null)}>×</button></div>}
      <p className="visually-hidden" aria-live="polite">{status}</p>
      {showExport && editor.image && <ExportSheet source={editor.image} busy={exporting} onClose={() => setShowExport(false)} onExport={exportPhoto} />}
      {editor.image && <button type="button" className="mobile-export" onClick={() => setShowExport(true)}>导出照片</button>}
    </main>
    </>
  )
}
