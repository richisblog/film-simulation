import { expect, it } from 'vitest'
import { canvasToBlob } from './encode'

it('returns a browser-encoded blob when the MIME matches', async () => {
  const canvas = { toBlob: (callback: BlobCallback) => callback(new Blob(['jpg'], { type: 'image/jpeg' })) } as HTMLCanvasElement
  await expect(canvasToBlob(canvas, 'image/jpeg', 90)).resolves.toHaveProperty('type', 'image/jpeg')
})

it('rejects Safari-style MIME fallback when WebP encoding is unavailable', async () => {
  const canvas = { toBlob: (callback: BlobCallback) => callback(new Blob(['jpg'], { type: 'image/jpeg' })) } as HTMLCanvasElement
  await expect(canvasToBlob(canvas, 'image/webp', 90)).rejects.toThrow('当前浏览器不能导出 WebP')
})
