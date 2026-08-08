import type { ImageSize } from './types'

export function targetSize(source: ImageSize, maxLongEdge: number | null): ImageSize {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width <= 0 || source.height <= 0) {
    throw new Error('图片尺寸无效')
  }
  if (maxLongEdge === null || Math.max(source.width, source.height) <= maxLongEdge) return { ...source }
  const scale = maxLongEdge / Math.max(source.width, source.height)
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  }
}
