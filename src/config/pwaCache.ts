export const EFFECT_CACHE_NAME = 'film-effects-v4'

export function isEffectAssetUrl(url: URL): boolean {
  return /\/assets\/(?:dazz\/)?(?:luts|light_leaks)\/.+\.(?:deflate|webp)$/.test(url.pathname)
}
