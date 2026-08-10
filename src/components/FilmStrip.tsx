import type { LutDescriptor } from '../image/catalog'
import type { LutCube } from '../image/lut'
import { lutDisplayName } from '../image/lutNames'
import { useLanguage } from '../i18n'
import { LutThumbnail } from './LutThumbnail'

interface Props {
  items: LutDescriptor[]
  selected: string | null
  source: ImageData
  loadPreviewLut(id: string): Promise<LutCube>
  onChange(id: string): void
  total?: number
  displayName?(item: LutDescriptor): string
}

export function FilmStrip({ items, selected, source, loadPreviewLut, onChange, total = 36, displayName }: Props) {
  const { language, copy } = useLanguage()
  return (
    <div className="film-grid" role="radiogroup" aria-label={copy.filmFilters}>
      {items.map((item, index) => (
        <button className={`film-card ${selected === item.id ? 'selected' : ''}`} type="button" role="radio"
          aria-checked={selected === item.id} key={item.id} onClick={() => onChange(item.id)}>
          <LutThumbnail source={source} lutId={item.id} loadPreviewLut={loadPreviewLut} />
          <span className="film-card-copy"><small>{String(index + 1).padStart(2, '0')} · {total}</small>
            <strong>{displayName?.(item) ?? lutDisplayName(item.id, language)}</strong></span>
        </button>
      ))}
    </div>
  )
}
