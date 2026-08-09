import { describe, expect, it } from 'vitest'
import { assetRoots } from './assets'

describe('assetRoots', () => {
  it('puts a normalized CDN root before packaged same-origin assets', () => {
    expect(assetRoots('https://cdn.example.com/film/assets/', './assets/', 'https://film.richis.top/editor/')).toEqual([
      { base: 'https://cdn.example.com/film/assets', label: 'CDN' },
      { base: './assets', label: '本站' },
    ])
  })

  it('uses the packaged root twice only at request time when no CDN is configured', () => {
    expect(assetRoots('', './assets', 'https://film.richis.top/')).toEqual([
      { base: './assets', label: '本站' },
    ])
  })

  it('deduplicates a configured URL that resolves to the packaged root', () => {
    expect(assetRoots('https://film.richis.top/tools/assets/', './assets', 'https://film.richis.top/tools/')).toEqual([
      { base: './assets', label: '本站' },
    ])
  })
})
