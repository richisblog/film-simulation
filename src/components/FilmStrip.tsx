import type { LutDescriptor } from '../image/catalog'
import type { LutCube } from '../image/lut'
import { lutDisplayName } from '../image/lutNames'
import { LutThumbnail } from './LutThumbnail'

interface Props {
  items: LutDescriptor[]
  selected: string | null
  source: ImageData
  loadLut(id: string): Promise<LutCube>
  onChange(id: string): void
}

export function FilmStrip({ items, selected, source, loadLut, onChange }: Props) {
  return (
    <div className="film-grid" role="radiogroup" aria-label="胶片滤镜">
      {items.map((item, index) => (
        <button className={`film-card ${selected === item.id ? 'selected' : ''}`} type="button" role="radio"
          aria-checked={selected === item.id} key={item.id} onClick={() => onChange(item.id)}>
          <LutThumbnail source={source} lutId={item.id} loadLut={loadLut} />
          <span className="film-card-copy"><small>{String(index + 1).padStart(2, '0')} · 36</small>
            <strong>{lutDisplayName(item.id)}</strong></span>
        </button>
      ))}
    </div>
  )
}
