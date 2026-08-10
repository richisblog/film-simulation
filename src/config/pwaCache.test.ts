import { expect, it } from 'vitest'
import { EFFECT_CACHE_NAME, isEffectAssetUrl } from './pwaCache'

it('matches effect assets on same-origin project paths and cross-origin CDNs', () => {
  expect(isEffectAssetUrl(new URL('https://film.richis.top/assets/luts/INSTWARM.rgb.deflate'))).toBe(true)
  expect(isEffectAssetUrl(new URL('https://richisblog.github.io/film-simulation/assets/luts/previews/INSTWARM.rgb.deflate'))).toBe(true)
  expect(isEffectAssetUrl(new URL('https://cdn.example.com/project/assets/light_leaks/leak_01.webp'))).toBe(true)
  expect(isEffectAssetUrl(new URL('https://film.richis.top/assets/dazz/luts/full/DAZZ_FXN_ORIGINAL.rgb.deflate'))).toBe(true)
  expect(isEffectAssetUrl(new URL('https://film.richis.top/assets/dazz/light_leaks/general/dazz_general_01.webp'))).toBe(true)
})

it('does not cache manifests, unrelated assets, or lookalike paths', () => {
  expect(isEffectAssetUrl(new URL('https://film.richis.top/assets/luts/manifest.json'))).toBe(false)
  expect(isEffectAssetUrl(new URL('https://film.richis.top/assets/icons/icon.svg'))).toBe(false)
  expect(isEffectAssetUrl(new URL('https://film.richis.top/not-assets/luts/INSTWARM.rgb.deflate'))).toBe(false)
})

it('uses a fresh cache version for the Dazz asset bytes', () => {
  expect(EFFECT_CACHE_NAME).toBe('film-effects-v4')
})
