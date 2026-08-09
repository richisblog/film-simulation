import { useState } from 'react'
import { targetSize } from '../image/sizing'
import type { ExportMime, ExportOptions, ImageSize } from '../image/types'
import { useLanguage } from '../i18n'

interface Props { source: ImageSize; busy: boolean; onClose(): void; onExport(options: ExportOptions): void }
const edges = [null, 4096, 3072, 2048, 1080] as const

export function ExportSheet({ source, busy, onClose, onExport }: Props) {
  const { copy } = useLanguage()
  const [mime, setMime] = useState<ExportMime>('image/jpeg')
  const [quality, setQuality] = useState<80 | 90 | 95>(90)
  const [maxLongEdge, setMaxLongEdge] = useState<number | null>(4096)
  const target = targetSize(source, maxLongEdge)
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="export-sheet" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="sheet-handle" /><header><div><p>{copy.exportEyebrow}</p><h2 id="export-title">{copy.exportPhoto}</h2></div>
        <button type="button" aria-label={copy.closeExport} onClick={onClose} disabled={busy}>×</button></header>
      <fieldset><legend>{copy.fileFormat}</legend><div className="option-row">
        {([['image/jpeg', 'JPEG'], ['image/png', 'PNG'], ['image/webp', 'WebP']] as const).map(([value, label]) =>
          <label className={mime === value ? 'selected' : ''} key={value}><input type="radio" name="format" value={value}
            checked={mime === value} onChange={() => setMime(value)} />{label}</label>)}
      </div></fieldset>
      <fieldset><legend>{copy.longEdge}</legend><div className="option-row wrap">
        {edges.map((edge) => <label className={maxLongEdge === edge ? 'selected' : ''} key={edge ?? 'original'}>
          <input type="radio" name="edge" checked={maxLongEdge === edge} onChange={() => setMaxLongEdge(edge)} />{edge ?? copy.originalSize}</label>)}
      </div></fieldset>
      {mime !== 'image/png' && <fieldset><legend>{copy.quality}</legend><div className="option-row">
        {([80, 90, 95] as const).map((value) => <label className={quality === value ? 'selected' : ''} key={value}>
          <input type="radio" name="quality" checked={quality === value} onChange={() => setQuality(value)} />{value}</label>)}
      </div></fieldset>}
      <div className="output-summary"><span>{copy.outputSize}</span><strong>{target.width} × {target.height}</strong></div>
      <button type="button" className="primary-button full" disabled={busy}
        onClick={() => onExport({ mime, quality, maxLongEdge })}>{busy ? copy.rendering : copy.downloadPhoto}</button>
      <p className="privacy-note">{copy.localProcessing}</p>
    </section>
  </div>
}
