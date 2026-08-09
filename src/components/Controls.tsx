import type { LeakDescriptor, LutDescriptor } from '../image/catalog'
import type { LutCube } from '../image/lut'
import type { EditSettings } from '../image/types'
import { useLanguage } from '../i18n'
import { FilmStrip } from './FilmStrip'

interface Props {
  settings: EditSettings; luts: LutDescriptor[]; leaks: LeakDescriptor[]
  thumbnailSource: ImageData; loadPreviewLut(id: string): Promise<LutCube>
  onChange(settings: EditSettings): void; onReset(): void
}

function Range({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return <label className="range-control"><span><strong>{label}</strong><output>{value}</output></span>
    <input type="range" min="0" max="100" value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
}

export function Controls({ settings, luts, leaks, thumbnailSource, loadPreviewLut, onChange, onReset }: Props) {
  const { copy } = useLanguage()
  const patch = (next: Partial<EditSettings>) => onChange({ ...settings, ...next })
  return (
    <aside className="controls-panel">
      <div className="panel-heading"><div><span className="section-index">01</span><h2>{copy.filmSimulation}</h2></div>
        <div className="panel-actions"><button type="button" className="text-button" aria-label={copy.selectOriginal}
          aria-pressed={!settings.lutId} onClick={() => patch({ lutId: null })}>{copy.original}</button>
          <button type="button" className="text-button" onClick={onReset}>{copy.reset}</button></div></div>
      <FilmStrip items={luts} selected={settings.lutId} source={thumbnailSource} loadPreviewLut={loadPreviewLut}
        onChange={(lutId) => patch({ lutId })} />
      <Range label={copy.filterStrength} value={settings.lutStrength} onChange={(lutStrength) => patch({ lutStrength })} />
      <div className="panel-heading sub"><div><span className="section-index">02</span><h2>{copy.filmTexture}</h2></div></div>
      <Range label={copy.grain} value={settings.grain} onChange={(grain) => patch({ grain })} />
      <Range label={copy.vignette} value={settings.vignette} onChange={(vignette) => patch({ vignette })} />
      <div className="panel-heading sub"><div><span className="section-index">03</span><h2>{copy.lightLeak}</h2></div></div>
      <div className="leak-grid" role="radiogroup" aria-label={copy.lightLeakEffects}>
        <button type="button" role="radio" aria-label={copy.disableLeak} aria-checked={!settings.leakId} className={!settings.leakId ? 'selected' : ''}
          onClick={() => patch({ leakId: null })}><span>{copy.disabled}</span></button>
        {leaks.map((item, index) => <button type="button" role="radio" aria-label={copy.leakNumber(index + 1)}
          aria-checked={settings.leakId === item.id} className={settings.leakId === item.id ? 'selected' : ''}
          style={{ backgroundImage: `url(./assets/light_leaks/${item.asset})` }} key={item.id}
          onClick={() => patch({ leakId: item.id })}><span>{index + 1}</span></button>)}
      </div>
      {settings.leakId && <Range label={copy.leakStrength} value={settings.leakStrength} onChange={(leakStrength) => patch({ leakStrength })} />}
    </aside>
  )
}
