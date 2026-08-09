import { AssetLoadError } from '../image/assetRequest'
import { useLanguage } from '../i18n'
import { localizedAssetCategory, localizedError } from '../i18n/errors'

interface Props {
  error: string | Error
  onClose(): void
  onRetry?(): void
}

export function ErrorToast({ error, onClose, onRetry }: Props) {
  const { language, copy } = useLanguage()
  const message = localizedError(error, language)
  const assetError = error instanceof AssetLoadError ? error : null
  const canRetry = Boolean(assetError?.retryable && onRetry)

  return <div role="alert" className="error-toast">
    <strong>{copy.problem}</strong>
    <span className="error-toast-message">{message}
      {assetError && <small>{copy.stage} {localizedAssetCategory(assetError.category, language)} · {assetError.elapsedMs} ms</small>}
    </span>
    {canRetry && <button type="button" className="error-retry" aria-label={copy.retryLoad} onClick={onRetry}>{copy.retry}</button>}
    <button type="button" className="error-close" aria-label={copy.closeError} onClick={onClose}>×</button>
  </div>
}
