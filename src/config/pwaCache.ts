export const EFFECT_CACHE_NAME = 'film-effects-v3'

export function isEffectAssetUrl(url: URL): boolean {
  return /\/assets\/(?:luts|light_leaks)\/.+\.(?:deflate|webp)$/.test(url.pathname)
}
