import { expect, it } from 'vitest'
import { decodeImageFile } from './decode'

it('returns decoded dimensions and releases the native bitmap', async () => {
  let closed = false
  let requestedOptions: ImageBitmapOptions | undefined
  const bitmap = { width: 3, height: 2, close: () => { closed = true } } as ImageBitmap
  const decoded = await decodeImageFile(new File(['png'], 'tiny.png', { type: 'image/png' }), {
    createBitmap: async (_file: File, ...args: unknown[]) => {
      requestedOptions = args[0] as ImageBitmapOptions | undefined
      return bitmap
    },
  })
  expect(decoded.width).toBe(3)
  expect(decoded.height).toBe(2)
  expect(requestedOptions).toMatchObject({ imageOrientation: 'none' })
  decoded.close()
  expect(closed).toBe(true)
})

it('explains unsupported HEIC after a real decode attempt fails', async () => {
  await expect(decodeImageFile(new File(['heic'], 'photo.heic', { type: 'image/heic' }), {
    createBitmap: async () => { throw new Error('unsupported') },
    decodeElement: async () => { throw new Error('unsupported') },
  })).rejects.toThrow('当前浏览器无法读取此 HEIC')
})
