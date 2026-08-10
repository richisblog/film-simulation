import { useState } from 'react'
import type { DazzCameraDescriptor, LeakDescriptor, LeakGroup, LutDescriptor, LutGroup } from '../image/catalog'
import type { LutCube } from '../image/lut'
import type { EditSettings } from '../image/types'
import { useLanguage } from '../i18n'
import { FilmStrip } from './FilmStrip'

interface Props {
  settings: EditSettings; luts: LutDescriptor[]; leaks: LeakDescriptor[]
  cameras?: DazzCameraDescriptor[]; lutGroups?: LutGroup[]; leakGroups?: LeakGroup[]
  thumbnailSource: ImageData; loadPreviewLut(id: string): Promise<LutCube>
  onChange(settings: EditSettings): void; onReset(): void
}

function Range({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
  return <label className="range-control"><span><strong>{label}</strong><output>{value}</output></span>
    <input type="range" min="0" max="100" value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
}

export function Controls({ settings, luts, leaks, cameras = [], lutGroups, leakGroups, thumbnailSource, loadPreviewLut, onChange, onReset }: Props) {
  const { language, copy } = useLanguage()
  const [openCamera, setOpenCamera] = useState<string | null>(null)
  const patch = (next: Partial<EditSettings>) => onChange({ ...settings, ...next })
  const classicLuts = lutGroups?.find(({ id }) => id === 'classic')?.luts ?? luts.filter(({ source }) => source !== 'dazz')
  const dazzLuts = lutGroups?.find(({ id }) => id === 'dazz')?.luts ?? luts.filter(({ source }) => source === 'dazz')
  const groupedLeaks = leakGroups ?? [{ id: 'classic', leaks }]
  const recipeById = new Map(dazzLuts.map((recipe) => [recipe.id, recipe]))
  return (
    <aside className="controls-panel">
      <div className="panel-heading"><div><span className="section-index">01</span><h2>{copy.filmSimulation}</h2></div>
        <div className="panel-actions"><button type="button" className="text-button" aria-label={copy.selectOriginal}
          aria-pressed={!settings.lutId} onClick={() => patch({ lutId: null })}>{copy.original}</button>
          <button type="button" className="text-button" onClick={onReset}>{copy.reset}</button></div></div>
      <p className="effect-library-label">{copy.classicFilmCount}</p>
      <FilmStrip items={classicLuts} selected={settings.lutId} source={thumbnailSource} loadPreviewLut={loadPreviewLut}
        onChange={(lutId) => patch({ lutId })} />
      {cameras.length > 0 && <section className="dazz-library" aria-label={copy.dazzCameraLibrary}>
        <div className="effect-library-divider"><span>{copy.dazzCameraCount(cameras.length)}</span></div>
        <div className="camera-grid">
          {cameras.map((camera) => {
            const selected = camera.recipe_ids.includes(settings.lutId ?? '')
            return <button type="button" className={selected ? 'selected' : ''} aria-expanded={camera.recipe_ids.length > 1 ? openCamera === camera.id : undefined}
              key={camera.id} onClick={() => camera.recipe_ids.length === 1 ? patch({ lutId: camera.recipe_ids[0] }) : setOpenCamera(openCamera === camera.id ? null : camera.id)}>
              <strong>{language === 'en' ? camera.name_en : camera.name_zh}</strong>
              <small>{camera.recipe_ids.length > 1 ? copy.variants(camera.recipe_ids.length) : copy.singleRecipe}</small>
            </button>
          })}
        </div>
        {openCamera && (() => {
          const camera = cameras.find(({ id }) => id === openCamera)
          const recipes = camera?.recipe_ids.map((id) => recipeById.get(id)).filter((item): item is LutDescriptor => Boolean(item)) ?? []
          return recipes.length > 0 && <div className="recipe-drawer"><div className="recipe-drawer-heading"><strong>{camera?.name_en}</strong><span>{copy.chooseVariant}</span></div>
            <FilmStrip items={recipes} total={recipes.length} selected={settings.lutId} source={thumbnailSource} loadPreviewLut={loadPreviewLut}
              displayName={(item) => language === 'en' ? item.name_en ?? item.id : item.name_zh ?? item.id}
              onChange={(lutId) => patch({ lutId })} /></div>
        })()}
      </section>}
      <Range label={copy.filterStrength} value={settings.lutStrength} onChange={(lutStrength) => patch({ lutStrength })} />
      <div className="panel-heading sub"><div><span className="section-index">02</span><h2>{copy.filmTexture}</h2></div></div>
      <Range label={copy.grain} value={settings.grain} onChange={(grain) => patch({ grain })} />
      <Range label={copy.vignette} value={settings.vignette} onChange={(vignette) => patch({ vignette })} />
      <div className="panel-heading sub"><div><span className="section-index">03</span><h2>{copy.lightLeak}</h2></div></div>
      {groupedLeaks.map((group) => <section className="leak-library" key={group.id}>
        <div className={`effect-library-divider ${group.id === 'classic' ? 'minor' : ''}`}><span>{copy.leakGroup(group.id, group.leaks.length)}</span></div>
        <div className="leak-grid" role="radiogroup" aria-label={group.id === 'classic' ? copy.lightLeakEffects : copy.leakGroup(group.id, group.leaks.length)}>
          {group.id === 'classic' && <button type="button" role="radio" aria-label={copy.disableLeak} aria-checked={!settings.leakId} className={!settings.leakId ? 'selected' : ''}
            onClick={() => patch({ leakId: null })}><span>{copy.disabled}</span></button>}
          {group.leaks.map((item, index) => <button type="button" role="radio" aria-label={copy.leakNumber(index + 1)}
            aria-checked={settings.leakId === item.id} className={settings.leakId === item.id ? 'selected' : ''}
            style={{ backgroundImage: `url(${item.source === 'dazz' ? './assets/dazz/light_leaks' : './assets/light_leaks'}/${item.asset})` }} key={item.id}
            onClick={() => patch({ leakId: item.id })}><span>{index + 1}</span></button>)}
        </div>
      </section>)}
      {settings.leakId && <Range label={copy.leakStrength} value={settings.leakStrength} onChange={(leakStrength) => patch({ leakStrength })} />}
    </aside>
  )
}
