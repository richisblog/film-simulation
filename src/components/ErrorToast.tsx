import { AssetLoadError } from '../image/assetRequest'
import { localizeErrorMessage, useLanguage } from '../i18n'

interface Props {
  error: string | Error
  onClose(): void
  onRetry?(): void
}

export function ErrorToast({ error, onClose, onRetry }: Props) {
  const { language, copy } = useLanguage()
  const message = localizeErrorMessage(typeof error === 'string' ? error : error.message, language)
  const assetError = error instanceof AssetLoadError ? error : null
  const canRetry = Boolean(assetError?.retryable && onRetry)

  return <div role="alert" className="error-toast">
    <strong>{copy.problem}</strong>
    <span className="error-toast-message">{message}
      {assetError && <small>{copy.stage} {assetError.category} · {assetError.elapsedMs} ms</small>}
    </span>
    {canRetry && <button type="button" className="error-retry" aria-label={copy.retryLoad} onClick={onRetry}>{copy.retry}</button>}
    <button type="button" className="error-close" aria-label={copy.closeError} onClick={onClose}>×</button>
  </div>
}
