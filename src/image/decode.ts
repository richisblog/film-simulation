export interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  close(): void
}

interface DecodeDependencies {
  createBitmap?: (file: File, options?: ImageBitmapOptions) => Promise<ImageBitmap>
  decodeElement?: (file: File) => Promise<HTMLImageElement>
}

async function browserElementDecode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url
  try {
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function decodeImageFile(file: File, dependencies: DecodeDependencies = {}): Promise<DecodedImage> {
  const createBitmap = dependencies.createBitmap ?? (typeof createImageBitmap === 'function'
    ? (input: File, options?: ImageBitmapOptions) => createImageBitmap(input, options)
    : undefined)
  let bitmapFailure: unknown
  if (createBitmap) {
    try {
      const bitmap = await createBitmap(file, { imageOrientation: 'none' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch (error) {
      bitmapFailure = error
    }
  }
  try {
    const image = await (dependencies.decodeElement ?? browserElementDecode)(file)
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('empty image')
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => { image.src = '' } }
  } catch (error) {
    if (/\.(?:heic|heif)$/i.test(file.name) || /image\/(?:heic|heif)/i.test(file.type)) {
      throw new Error('当前浏览器无法读取此 HEIC，请在系统相册导出为 JPEG 后重试。', { cause: error })
    }
    throw new Error('无法读取这张照片，文件可能损坏或格式不受支持。', { cause: bitmapFailure ?? error })
  }
}
