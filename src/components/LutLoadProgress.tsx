import type { LutPreloadProgress } from '../image/catalog'
import { lutDisplayName } from '../image/lutNames'
import { useLanguage } from '../i18n'

interface Props {
  progress: LutPreloadProgress
  onRetry(): void
}

export function LutLoadProgress({ progress, onRetry }: Props) {
  const { language, copy } = useLanguage()
  const total = progress.total || 36
  const title = progress.total === 0
    ? copy.loadingManifest
    : progress.done && progress.failed === 0
      ? copy.colorsReady(progress.succeeded, progress.total)
      : progress.active > 0
        ? copy.preparingColors
        : copy.colorsNeedRetry

  return <section className={`lut-load-progress ${progress.failed > 0 ? 'has-failure' : ''}`} role="status" aria-label={copy.colorLoadStatus} aria-live="polite">
    <div className="lut-progress-copy">
      <strong>{title}</strong>
      <span>{progress.total > 0
        ? copy.completed(progress.completed, progress.total, progress.percent)
        : copy.checkingCache}</span>
    </div>
    <progress aria-label={copy.colorLoadProgress} value={progress.completed} max={total} />
    <div className="lut-progress-detail">
      {progress.currentId
        ? <span>{copy.justCompleted(progress.completed, lutDisplayName(progress.currentId, language))}</span>
        : <span>{progress.active > 0 ? copy.processingItems(progress.active) : copy.waiting}</span>}
      {progress.total > 0 && <small>{copy.availableItems(progress.succeeded, progress.failed)}</small>}
    </div>
    {progress.failed > 0 && progress.active === 0
      && <button type="button" onClick={onRetry} aria-label={copy.retryColors}>{copy.retryColors}</button>}
  </section>
}
