export interface ImageSize { width: number; height: number }

export interface EditSettings {
  lutId: string | null
  exposure: number
  lutStrength: number
  grain: number
  vignette: number
  leakId: string | null
  leakStrength: number
  seed: number
}

export type ExportMime = 'image/jpeg' | 'image/png' | 'image/webp'

export interface ExportOptions {
  mime: ExportMime
  quality: 80 | 90 | 95
  maxLongEdge: number | null
}

export const DEFAULT_SETTINGS: EditSettings = {
  lutId: null,
  exposure: 0,
  lutStrength: 100,
  grain: 12,
  vignette: 8,
  leakId: null,
  leakStrength: 20,
  seed: 1937,
}
