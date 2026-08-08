import type { LeakDescriptor, LutDescriptor } from '../image/catalog'
import type { LutCube } from '../image/lut'
import type { EditSettings } from '../image/types'
import { FilmStrip } from './FilmStrip'

interface Props {
  settings: EditSettings; luts: LutDescriptor[]; leaks: LeakDescriptor[]
  thumbnailSource: ImageData; loadLut(id: string): Promise<LutCube>
  onChange(settings: EditSettings): void; onReset(): void
}

function Range({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return <label className="range-control"><span><strong>{label}</strong><output>{value}</output></span>
    <input type="range" min="0" max="100" value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
}

export function Controls({ settings, luts, leaks, thumbnailSource, loadLut, onChange, onReset }: Props) {
  const patch = (next: Partial<EditSettings>) => onChange({ ...settings, ...next })
  return (
    <aside className="controls-panel">
      <div className="panel-heading"><div><span className="section-index">01</span><h2>胶片模拟</h2></div>
        <div className="panel-actions"><button type="button" className="text-button" aria-label="选择原图"
          aria-pressed={!settings.lutId} onClick={() => patch({ lutId: null })}>原图</button>
          <button type="button" className="text-button" onClick={onReset}>重置</button></div></div>
      <FilmStrip items={luts} selected={settings.lutId} source={thumbnailSource} loadLut={loadLut}
        onChange={(lutId) => patch({ lutId })} />
      <Range label="滤镜强度" value={settings.lutStrength} onChange={(lutStrength) => patch({ lutStrength })} />
      <div className="panel-heading sub"><div><span className="section-index">02</span><h2>胶片质感</h2></div></div>
      <Range label="颗粒" value={settings.grain} onChange={(grain) => patch({ grain })} />
      <Range label="暗角" value={settings.vignette} onChange={(vignette) => patch({ vignette })} />
      <div className="panel-heading sub"><div><span className="section-index">03</span><h2>漏光</h2></div></div>
      <div className="leak-grid" role="radiogroup" aria-label="漏光效果">
        <button type="button" role="radio" aria-label="关闭漏光" aria-checked={!settings.leakId} className={!settings.leakId ? 'selected' : ''}
          onClick={() => patch({ leakId: null })}><span>关闭</span></button>
        {leaks.map((item, index) => <button type="button" role="radio" aria-label={`漏光 ${index + 1}`}
          aria-checked={settings.leakId === item.id} className={settings.leakId === item.id ? 'selected' : ''}
          style={{ backgroundImage: `url(./assets/light_leaks/${item.asset})` }} key={item.id}
          onClick={() => patch({ leakId: item.id })}><span>{index + 1}</span></button>)}
      </div>
      {settings.leakId && <Range label="漏光强度" value={settings.leakStrength} onChange={(leakStrength) => patch({ leakStrength })} />}
    </aside>
  )
}
