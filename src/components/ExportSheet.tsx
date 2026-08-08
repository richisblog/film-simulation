import { useState } from 'react'
import { targetSize } from '../image/sizing'
import type { ExportMime, ExportOptions, ImageSize } from '../image/types'

interface Props { source: ImageSize; busy: boolean; onClose(): void; onExport(options: ExportOptions): void }
const edges = [{ value: null, label: '原尺寸' }, { value: 4096, label: '4096' }, { value: 3072, label: '3072' }, { value: 2048, label: '2048' }, { value: 1080, label: '1080' }]

export function ExportSheet({ source, busy, onClose, onExport }: Props) {
  const [mime, setMime] = useState<ExportMime>('image/jpeg')
  const [quality, setQuality] = useState<80 | 90 | 95>(90)
  const [maxLongEdge, setMaxLongEdge] = useState<number | null>(4096)
  const target = targetSize(source, maxLongEdge)
  return <div className="sheet-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section className="export-sheet" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <div className="sheet-handle" /><header><div><p>照片导出</p><h2 id="export-title">导出照片</h2></div>
        <button type="button" aria-label="关闭导出面板" onClick={onClose} disabled={busy}>×</button></header>
      <fieldset><legend>文件格式</legend><div className="option-row">
        {([['image/jpeg', 'JPEG'], ['image/png', 'PNG'], ['image/webp', 'WebP']] as const).map(([value, label]) =>
          <label className={mime === value ? 'selected' : ''} key={value}><input type="radio" name="format" value={value}
            checked={mime === value} onChange={() => setMime(value)} />{label}</label>)}
      </div></fieldset>
      <fieldset><legend>长边分辨率</legend><div className="option-row wrap">
        {edges.map((edge) => <label className={maxLongEdge === edge.value ? 'selected' : ''} key={edge.label}>
          <input type="radio" name="edge" checked={maxLongEdge === edge.value} onChange={() => setMaxLongEdge(edge.value)} />{edge.label}</label>)}
      </div></fieldset>
      {mime !== 'image/png' && <fieldset><legend>画质</legend><div className="option-row">
        {([80, 90, 95] as const).map((value) => <label className={quality === value ? 'selected' : ''} key={value}>
          <input type="radio" name="quality" checked={quality === value} onChange={() => setQuality(value)} />{value}</label>)}
      </div></fieldset>}
      <div className="output-summary"><span>输出尺寸</span><strong>{target.width} × {target.height}</strong></div>
      <button type="button" className="primary-button full" disabled={busy}
        onClick={() => onExport({ mime, quality, maxLongEdge })}>{busy ? '正在本地渲染…' : '下载照片'}</button>
      <p className="privacy-note">处理与编码都在本机完成</p>
    </section>
  </div>
}
