import { useEffect, useMemo, useState } from 'react'
import { startPageviewTracking, trackFilterExport } from './analytics/goatCounter'
import { Controls } from './components/Controls'
import { DropZone } from './components/DropZone'
import { ExportSheet } from './components/ExportSheet'
import { ErrorToast } from './components/ErrorToast'
import { LutLoadProgress } from './components/LutLoadProgress'
import { InstallPrompt } from './components/InstallPrompt'
import { Preview } from './components/Preview'
import { canvasToBlob } from './export/encode'
import { outputFilename } from './image/formats'
import { lutDisplayName } from './image/lutNames'
import { createRenderer } from './image/renderer'
import { targetSize } from './image/sizing'
import { createThumbnailSource } from './image/thumbnailSource'
import type { ExportOptions } from './image/types'
import { useEditor } from './hooks/useEditor'
import { LanguageProvider, useLanguage } from './i18n'

export default function App() {
  return <LanguageProvider><AppContent /></LanguageProvider>
}

function AppContent() {
  const { language, setLanguage, copy } = useLanguage()
  const editor = useEditor()
  const [showExport, setShowExport] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState('')
  const thumbnailSource = useMemo(() => editor.image
    ? createThumbnailSource(editor.image.source, editor.image)
    : null, [editor.image])

  useEffect(() => {
    const siteUrl = import.meta.env.VITE_GOATCOUNTER_URL
    if (siteUrl) startPageviewTracking({ siteUrl, location: window.location, document })
  }, [])

  const exportPhoto = async (options: ExportOptions) => {
    if (!editor.image || !editor.file) return
    setExporting(true)
    editor.setError(null)
    setStatus(copy.renderingStatus)
    const canvas = document.createElement('canvas')
    const renderer = createRenderer(canvas)
    try {
      const size = targetSize(editor.image, options.maxLongEdge)
      if (Math.max(size.width, size.height) > renderer.maxSize) throw new Error(copy.deviceMax(renderer.maxSize))
      await renderer.render(editor.image.source, editor.settings, editor.lut, editor.pipeline, editor.leak, size)
      const blob = await canvasToBlob(canvas, options.mime, options.quality)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = outputFilename(editor.file.name, options.mime, language)
      anchor.click()
      const siteUrl = import.meta.env.VITE_GOATCOUNTER_URL
      if (siteUrl) {
        const lutId = editor.settings.lutId
        const descriptor = editor.luts.find(({ id }) => id === lutId)
        trackFilterExport({
          siteUrl,
          location: window.location,
          window,
          language,
          lutId,
          lutName: lutId ? descriptor?.source === 'dazz'
            ? (language === 'en' ? descriptor.name_en : descriptor.name_zh) ?? lutId
            : lutDisplayName(lutId, language) : null,
        })
      }
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus(copy.generated(anchor.download))
      setShowExport(false)
    } catch (reason) {
      editor.setError(reason instanceof Error ? reason : copy.exportFailed)
      setStatus(copy.exportFailed)
    } finally {
      renderer.dispose()
      setExporting(false)
    }
  }

  return (
    <>
      <div className="notice-bar" role="note">{copy.notice}</div>
      <main className={`app-shell ${editor.image ? 'editing' : ''}`}>
      <header className="app-header"><div className="brand"><span>{copy.title}</span></div>
        <div className="header-actions">
          <button type="button" className="language-switch" aria-label={copy.switchLanguage}
            onClick={() => setLanguage(language === 'zh-CN' ? 'en' : 'zh-CN')}>{copy.switchLabel}</button>
          <a className="github-star" href="https://github.com/richisblog/film-simulation" target="_blank" rel="noopener noreferrer" aria-label={copy.githubLabel}>
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            <span>Star</span>
          </a>
          {editor.image && <><DropZone compact busy={editor.busy} onFile={editor.openFile} />
          <button type="button" className="export-button" onClick={() => setShowExport(true)}>{copy.export}</button></>}
        </div>
      </header>
      <LutLoadProgress progress={editor.lutProgress} onRetry={editor.retryFailedLuts} />
      
      {!editor.image ? <section className="empty-state">
        <div className="hero-copy"><p className="eyebrow">{copy.localLab}</p>
          <h1>{copy.heroLine1}<br />{copy.heroLine2}</h1>
          <p>{copy.heroSub}</p></div>
        <DropZone busy={editor.busy} onFile={editor.openFile} />
        <div className="format-note"><span>{copy.supported}</span> JPEG · PNG · WebP · HEIC*</div>
      </section> : <div className="editor-grid">
        <div className="workspace"><div className="file-meta"><span>{editor.file?.name}</span><span>{editor.image.width} × {editor.image.height}</span></div>
          <Preview image={editor.image} settings={editor.settings} lut={editor.lut} pipeline={editor.pipeline} leak={editor.leak} /></div>
        <Controls settings={editor.settings} luts={editor.luts} leaks={editor.leaks} cameras={editor.cameras} lutGroups={editor.lutGroups} leakGroups={editor.leakGroups}
          thumbnailSource={thumbnailSource!} loadPreviewLut={editor.loadPreviewLut}
          onChange={editor.setSettings} onReset={editor.reset} />
      </div>}
      {editor.error && <ErrorToast error={editor.error} onClose={() => editor.setError(null)} onRetry={editor.retryError} />}
      <InstallPrompt />
      <p className="visually-hidden" aria-live="polite">{status}</p>
      {showExport && editor.image && <ExportSheet source={editor.image} busy={exporting} onClose={() => setShowExport(false)} onExport={exportPhoto} />}
      {editor.image && <button type="button" className="mobile-export" onClick={() => setShowExport(true)}>{copy.mobileExport}</button>}
<footer className="site-footer" role="region" aria-label={copy.supportRegion}>
        <p className="support-note">{copy.supportNote}</p>
        <div className="support-links">
          <a className="social-btn social-github" href="https://github.com/richisblog/film-simulation" target="_blank" rel="noopener noreferrer" aria-label={copy.githubSupport}>
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            <span>GitHub Star</span>
          </a>
          <a className="social-btn social-xhs" href="https://xhslink.cn/m/Gr3fgjumZH" target="_blank" rel="noopener noreferrer" aria-label={copy.xhsSupport}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M22.405 9.879c.002.016.01.02.07.019h.725a.797.797 0 0 0 .78-.972.794.794 0 0 0-.884-.618.795.795 0 0 0-.692.794c0 .101-.002.666.001.777zm-11.509 4.808c-.203.001-1.353.004-1.685.003a2.528 2.528 0 0 1-.766-.126.025.025 0 0 0-.03.014L7.7 16.127a.025.025 0 0 0 .01.032c.111.06.336.124.495.124.66.01 1.32.002 1.981 0 .01 0 .02-.006.023-.015l.712-1.545a.025.025 0 0 0-.024-.036zM.477 9.91c-.071 0-.076.002-.076.01a.834.834 0 0 0-.01.08c-.027.397-.038.495-.234 3.06-.012.24-.034.389-.135.607-.026.057-.033.042.003.112.046.092.681 1.523.787 1.74.008.015.011.02.017.02.008 0 .033-.026.047-.044.147-.187.268-.391.371-.606.306-.635.44-1.325.486-1.706.014-.11.021-.22.03-.33l.204-2.616.022-.293c.003-.029 0-.033-.03-.034zm7.203 3.757a1.427 1.427 0 0 1-.135-.607c-.004-.084-.031-.39-.235-3.06a.443.443 0 0 0-.01-.082c-.004-.011-.052-.008-.076-.008h-1.48c-.03.001-.034.005-.03.034l.021.293c.076.982.153 1.964.233 2.946.05.4.186 1.085.487 1.706.103.215.223.419.37.606.015.018.037.051.048.049.02-.003.742-1.642.804-1.765.036-.07.03-.055.003-.112zm3.861-.913h-.872a.126.126 0 0 1-.116-.178l1.178-2.625a.025.025 0 0 0-.023-.035l-1.318-.003a.148.148 0 0 1-.135-.21l.876-1.954a.025.025 0 0 0-.023-.035h-1.56c-.01 0-.02.006-.024.015l-.926 2.068c-.085.169-.314.634-.399.938a.534.534 0 0 0-.02.191.46.46 0 0 0 .23.378.981.981 0 0 0 .46.119h.59c.041 0-.688 1.482-.834 1.972a.53.53 0 0 0-.023.172.465.465 0 0 0 .23.398c.15.092.342.12.475.12l1.66-.001c.01 0 .02-.006.023-.015l.575-1.28a.025.025 0 0 0-.024-.035zm-6.93-4.937H3.1a.032.032 0 0 0-.034.033c0 1.048-.01 2.795-.01 6.829 0 .288-.269.262-.28.262h-.74c-.04.001-.044.004-.04.047.001.037.465 1.064.555 1.263.01.02.03.033.051.033.157.003.767.009.938-.014.153-.02.3-.06.438-.132.3-.156.49-.419.595-.765.052-.172.075-.353.075-.533.002-2.33 0-4.66-.007-6.991a.032.032 0 0 0-.032-.032zm11.784 6.896c0-.014-.01-.021-.024-.022h-1.465c-.048-.001-.049-.002-.05-.049v-4.66c0-.072-.005-.07.07-.07h.863c.08 0 .075.004.075-.074V8.393c0-.082.006-.076-.08-.076h-3.5c-.064 0-.075-.006-.075.073v1.445c0 .083-.006.077.08.077h.854c.075 0 .07-.004.07.07v4.624c0 .095.008.084-.085.084-.37 0-1.11-.002-1.304 0-.048.001-.06.03-.06.03l-.697 1.519s-.014.025-.008.036c.006.01.013.008.058.008 1.748.003 3.495.002 5.243.002.03-.001.034-.006.035-.033v-1.539zm4.177-3.43c0 .013-.007.023-.02.024-.346.006-.692.004-1.037.004-.014-.002-.022-.01-.022-.024-.005-.434-.007-.869-.01-1.303 0-.072-.006-.071.07-.07l.733-.003c.041 0 .081.002.12.015.093.025.16.107.165.204.006.431.002 1.153.001 1.153zm2.67.244a1.953 1.953 0 0 0-.883-.222h-.18c-.04-.001-.04-.003-.042-.04V10.21c0-.132-.007-.263-.025-.394a1.823 1.823 0 0 0-.153-.53 1.533 1.533 0 0 0-.677-.71 2.167 2.167 0 0 0-1-.258c-.153-.003-.567 0-.72 0-.07 0-.068.004-.068-.065V7.76c0-.031-.01-.041-.046-.039H17.93s-.016 0-.023.007c-.006.006-.008.012-.008.023v.546c-.008.036-.057.015-.082.022h-.95c-.022.002-.028.008-.03.032v1.481c0 .09-.004.082.082.082h.913c.082 0 .072.128.072.128V11.19s.003.117-.06.117h-1.482c-.068 0-.06.082-.06.082v1.445s-.01.068.064.068h1.457c.082 0 .076-.006.076.079v3.225c0 .088-.007.081.082.081h1.43c.09 0 .082.007.082-.08v-3.27c0-.029.006-.035.033-.035l2.323-.003c.098 0 .191.02.28.061a.46.46 0 0 1 .274.407c.008.395.003.79.003 1.185 0 .259-.107.367-.33.367h-1.218c-.023.002-.029.008-.028.033.184.437.374.871.57 1.303a.045.045 0 0 0 .04.026c.17.005.34.002.51.003.15-.002.517.004.666-.01a2.03 2.03 0 0 0 .408-.075c.59-.18.975-.698.976-1.313v-1.981c0-.128-.01-.254-.034-.38 0 .078-.029-.641-.724-.998z"/></svg>
            <span>{copy.xhs}</span>
          </a>
        </div>
        <p className="analytics-privacy-note">{copy.analyticsNote}</p>
      </footer>
    </main>
    </>
  )
}
