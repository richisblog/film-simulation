import type { ExportMime } from './types'

export const INPUT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif'

const acceptedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const acceptedExtension = /\.(?:jpe?g|png|webp|heic|heif)$/i

export function isAcceptedImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  return acceptedMime.has(file.type.toLowerCase()) || acceptedExtension.test(file.name)
}

const outputExtension: Record<ExportMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function outputFilename(inputName: string, mime: ExportMime, language: 'zh-CN' | 'en' = 'zh-CN'): string {
  const withoutExtension = inputName.replace(/\.[^./\\]+$/, '') || (language === 'en' ? 'photo' : '照片')
  const suffix = language === 'en' ? 'film-simulation' : '胶片模拟'
  return `${withoutExtension}-${suffix}.${outputExtension[mime]}`
}
