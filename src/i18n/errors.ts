import { AssetLoadError, type AssetFailureCategory } from '../image/assetRequest'
import type { Language } from '../i18n'

const categoryLabels: Record<AssetFailureCategory, Record<Language, string>> = {
  timeout: { 'zh-CN': '超时', en: 'timeout' },
  network: { 'zh-CN': '网络', en: 'network' },
  http: { 'zh-CN': 'HTTP', en: 'HTTP' },
  integrity: { 'zh-CN': '文件完整性', en: 'file integrity' },
  decompression: { 'zh-CN': '解压', en: 'decompression' },
  unsupported: { 'zh-CN': '浏览器支持', en: 'browser support' },
}

const knownEnglishMessages: Record<string, string> = {
  '当前浏览器无法读取此 HEIC，请在系统相册导出为 JPEG 后重试。': 'This browser cannot read this HEIC file. Export it as JPEG from Photos and try again.',
  '无法读取这张照片，文件可能损坏或格式不受支持。': 'This photo could not be read. It may be damaged or use an unsupported format.',
  '浏览器无法生成照片文件': 'The browser could not create the photo file.',
  '浏览器无法建立兼容画布': 'The browser could not create a compatible canvas.',
  '无法载入效果素材清单': 'Could not load the effects catalog.',
  '图片尺寸无效': 'The image dimensions are invalid.',
  'LUT 数据长度无效': 'The LUT data is invalid.',
  '浏览器无法生成胶片缩略图': 'The browser could not create the film thumbnail.',
}

export function localizedAssetCategory(category: AssetFailureCategory, language: Language): string {
  return categoryLabels[category][language]
}

export function localizedError(reason: unknown, language: Language): string {
  if (reason instanceof AssetLoadError) return language === 'zh-CN' ? reason.message : englishAssetError(reason)

  if (typeof reason === 'string') {
    const matchesLanguage = language === 'zh-CN' ? /[\u3400-\u9fff]/u.test(reason) : !/[\u3400-\u9fff]/u.test(reason)
    return matchesLanguage ? reason : genericError(language)
  }

  const message = reason instanceof Error ? reason.message : ''
  if (language === 'zh-CN') {
    return /[\u3400-\u9fff]/u.test(message) ? message : genericError(language)
  }

  const known = knownEnglishMessages[message]
  if (known) return known

  const maximum = message.match(/当前设备最大支持 (\d+) 像素长边/u)
  if (maximum) return `This device supports a maximum long edge of ${maximum[1]}px. Choose a lower resolution.`

  const exportFormat = message.match(/当前浏览器不能导出 (.+?)，请改用 JPEG。/u)
  if (exportFormat) return `This browser cannot export ${exportFormat[1]}. Use JPEG instead.`

  if (message.startsWith('WebGL ')) return 'WebGL rendering failed.'
  return genericError(language)
}

function englishAssetError(error: AssetLoadError): string {
  const source = error.source === '本站' ? 'local site' : error.source
  const suffix = `(${source}, attempt ${error.attempt}).`
  if (error.category === 'timeout') return `Timed out downloading ${error.effectId} ${suffix}`
  if (error.category === 'network') return `Could not connect to the asset service for ${error.effectId} ${suffix}`
  if (error.category === 'http') return `Asset service returned HTTP ${error.status ?? 'error'} for ${error.effectId} ${suffix}`
  if (error.category === 'integrity') return `Downloaded asset is incomplete: ${error.effectId} ${suffix}`
  if (error.category === 'decompression') return `Could not decompress asset ${error.effectId} ${suffix}`
  return `This browser does not support asset ${error.effectId} ${suffix}`
}

function genericError(language: Language): string {
  return language === 'zh-CN' ? '出现未知错误，请重试。' : 'Something went wrong. Please try again.'
}
