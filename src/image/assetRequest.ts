import type { AssetRoot, AssetSourceLabel } from '../config/assets'

export type AssetKind = 'lut' | 'preview-lut' | 'leak' | 'texture'
export type AssetFailureCategory = 'timeout' | 'network' | 'http' | 'integrity' | 'decompression' | 'unsupported'

export interface AssetDiagnostic {
  category: AssetFailureCategory
  assetKind: AssetKind
  effectId: string
  source: AssetSourceLabel
  attempt: number
  status: number | undefined
  elapsedMs: number
}

export class AssetLoadError extends Error {
  readonly name = 'AssetLoadError'
  readonly diagnostic: AssetDiagnostic

  constructor(
    readonly category: AssetFailureCategory,
    readonly assetKind: AssetKind,
    readonly effectId: string,
    readonly source: AssetSourceLabel,
    readonly attempt: number,
    readonly status: number | undefined,
    readonly elapsedMs: number,
  ) {
    super(messageFor(category, effectId, source, attempt, status))
    this.diagnostic = { category, assetKind, effectId, source, attempt, status, elapsedMs }
  }

  get retryable(): boolean {
    return this.category === 'timeout' || this.category === 'network' || (this.category === 'http' && (this.status ?? 0) >= 500)
  }
}

export interface AssetRequestOptions {
  roots: AssetRoot[]
  assetKind: AssetKind
  effectId: string
  expectedByteLength?: number
  fetcher?: typeof fetch
  timeoutMs?: number
  retryDelayMs?: number
  delay?: (milliseconds: number) => Promise<void>
  now?: () => number
}

interface AttemptFailure {
  category: AssetFailureCategory
  status?: number
}

class DeadlineError extends Error {}

const browserFetch: typeof fetch = (input, init) => globalThis.fetch.call(globalThis, input, init)
const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export async function requestAsset(path: string, options: AssetRequestOptions): Promise<Uint8Array> {
  if (options.roots.length === 0) throw new Error('至少需要一个素材来源')
  const fetcher = options.fetcher ?? browserFetch
  const timeoutMs = options.timeoutMs ?? 20_000
  const retryDelayMs = options.retryDelayMs ?? 250
  const delay = options.delay ?? wait
  const now = options.now ?? (() => performance.now())
  const candidates = options.roots.length > 1
    ? options.roots.slice(0, 2)
    : [options.roots[0], options.roots[0]]

  let finalError: AssetLoadError | undefined
  for (let index = 0; index < candidates.length; index += 1) {
    const root = candidates[index]
    const attempt = index + 1
    const startedAt = now()
    try {
      return await oneAttempt(joinAssetUrl(root.base, path), fetcher, timeoutMs, options.expectedByteLength)
    } catch (reason) {
      const failure = classifyAttemptFailure(reason)
      finalError = new AssetLoadError(
        failure.category,
        options.assetKind,
        options.effectId,
        root.label,
        attempt,
        failure.status,
        Math.max(0, Math.round(now() - startedAt)),
      )
      const hasNext = index + 1 < candidates.length
      const mayTryNext = root.label === 'CDN' || finalError.retryable || failure.category === 'integrity'
      if (!hasNext || !mayTryNext) throw finalError
      if (retryDelayMs > 0) await delay(retryDelayMs)
    }
  }
  throw finalError ?? new Error('素材请求失败')
}

async function oneAttempt(
  url: string,
  fetcher: typeof fetch,
  timeoutMs: number,
  expectedByteLength?: number,
): Promise<Uint8Array> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new DeadlineError())
    }, timeoutMs)
  })
  try {
    const response = await Promise.race([fetcher(url, { signal: controller.signal }), deadline])
    if (!response.ok) throw { category: 'http', status: response.status } satisfies AttemptFailure
    const buffer = await Promise.race([response.arrayBuffer(), deadline])
    const bytes = new Uint8Array(buffer)
    if (expectedByteLength !== undefined && bytes.length !== expectedByteLength) {
      throw { category: 'integrity' } satisfies AttemptFailure
    }
    return bytes
  } catch (reason) {
    if (reason instanceof DeadlineError || controller.signal.aborted) throw { category: 'timeout' } satisfies AttemptFailure
    throw reason
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function classifyAttemptFailure(reason: unknown): AttemptFailure {
  if (isAttemptFailure(reason)) return reason
  return { category: 'network' }
}

function isAttemptFailure(reason: unknown): reason is AttemptFailure {
  if (!reason || typeof reason !== 'object' || !('category' in reason)) return false
  return ['timeout', 'network', 'http', 'integrity', 'decompression', 'unsupported'].includes(String(reason.category))
}

function joinAssetUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function messageFor(
  category: AssetFailureCategory,
  effectId: string,
  source: AssetSourceLabel,
  attempt: number,
  status?: number,
): string {
  const suffix = `（${source}，第 ${attempt} 次）`
  if (category === 'timeout') return `下载素材超时：${effectId}${suffix}`
  if (category === 'network') return `无法连接素材服务：${effectId}${suffix}`
  if (category === 'http') return `素材服务返回 HTTP ${status ?? '错误'}：${effectId}${suffix}`
  if (category === 'integrity') return `素材文件不完整：${effectId}${suffix}`
  if (category === 'decompression') return `素材解压失败：${effectId}${suffix}`
  return `当前浏览器不支持此素材：${effectId}${suffix}`
}
