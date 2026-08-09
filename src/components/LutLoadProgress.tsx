import type { LutPreloadProgress } from '../image/catalog'
import { lutDisplayName } from '../image/lutNames'

interface Props {
  progress: LutPreloadProgress
  onRetry(): void
}

export function LutLoadProgress({ progress, onRetry }: Props) {
  const total = progress.total || 36
  const title = progress.total === 0
    ? '正在读取胶片色彩清单'
    : progress.done && progress.failed === 0
      ? `胶片色彩已就绪（${progress.succeeded} / ${progress.total}）`
      : progress.active > 0
        ? '正在准备胶片色彩'
        : '部分胶片色彩待重试'

  return <section className={`lut-load-progress ${progress.failed > 0 ? 'has-failure' : ''}`} role="status" aria-label="胶片色彩加载状态" aria-live="polite">
    <div className="lut-progress-copy">
      <strong>{title}</strong>
      <span>{progress.total > 0
        ? `已完成 ${progress.completed} / ${progress.total} · ${progress.percent}%`
        : '正在确认本地缓存…'}</span>
    </div>
    <progress aria-label="胶片色彩加载进度" value={progress.completed} max={total} />
    <div className="lut-progress-detail">
      {progress.currentId
        ? <span>刚完成第 {progress.completed} 个：{lutDisplayName(progress.currentId)}</span>
        : <span>{progress.active > 0 ? `正在处理 ${progress.active} 项` : '等待加载'}</span>}
      {progress.total > 0 && <small>{progress.succeeded} 个可用{progress.failed > 0 ? ` · ${progress.failed} 个待重试` : ''}</small>}
    </div>
    {progress.failed > 0 && progress.active === 0
      && <button type="button" onClick={onRetry} aria-label="重试未完成色彩">重试未完成</button>}
  </section>
}
