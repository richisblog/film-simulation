export const EFFECT_CACHE_NAME = 'film-effects-v5'

export function isEffectAssetUrl(url: URL): boolean {
  return /\/assets\/(?:dazz\/)?(?:luts|light_leaks|textures)\/.+\.(?:deflate|webp)$/.test(url.pathname)
}
