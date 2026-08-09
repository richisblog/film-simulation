import { AssetLoadError } from '../image/assetRequest'

interface Props {
  error: string | Error
  onClose(): void
  onRetry?(): void
}

export function ErrorToast({ error, onClose, onRetry }: Props) {
  const message = typeof error === 'string' ? error : error.message
  const assetError = error instanceof AssetLoadError ? error : null
  const canRetry = Boolean(assetError?.retryable && onRetry)

  return <div role="alert" className="error-toast">
    <strong>出现问题</strong>
    <span className="error-toast-message">{message}
      {assetError && <small>阶段 {assetError.category} · {assetError.elapsedMs} ms</small>}
    </span>
    {canRetry && <button type="button" className="error-retry" aria-label="重试加载" onClick={onRetry}>重试</button>}
    <button type="button" className="error-close" aria-label="关闭错误" onClick={onClose}>×</button>
  </div>
}
