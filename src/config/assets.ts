export type AssetSourceLabel = 'CDN' | '本站'

export interface AssetRoot {
  base: string
  label: AssetSourceLabel
}

const trimRoot = (value: string) => value.trim().replace(/\/+$/, '')

export function assetRoots(
  configured = '',
  sameOrigin = './assets',
  documentBase = globalThis.document?.baseURI ?? globalThis.location?.href ?? 'http://localhost/',
): AssetRoot[] {
  const packaged = trimRoot(sameOrigin) || './assets'
  const cdn = trimRoot(configured)
  if (!cdn) return [{ base: packaged, label: '本站' }]

  const cdnUrl = new URL(cdn, documentBase).href.replace(/\/$/, '')
  const packagedUrl = new URL(packaged, documentBase).href.replace(/\/$/, '')
  if (cdnUrl === packagedUrl) return [{ base: packaged, label: '本站' }]
  return [{ base: cdn, label: 'CDN' }, { base: packaged, label: '本站' }]
}

export function configuredAssetRoots(): AssetRoot[] {
  return assetRoots(import.meta.env.VITE_ASSET_BASE_URL)
}
