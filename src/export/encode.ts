import type { ExportMime } from '../image/types'

export function canvasToBlob(canvas: HTMLCanvasElement, mime: ExportMime, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('浏览器无法生成照片文件'))
        return
      }
      if (blob.type !== mime) {
        const label = mime === 'image/webp' ? 'WebP' : mime === 'image/png' ? 'PNG' : 'JPEG'
        reject(new Error(`当前浏览器不能导出 ${label}，请改用 JPEG。`))
        return
      }
      resolve(blob)
    }, mime, quality / 100)
  })
}
