import { describe, expect, it } from 'vitest'
import { AssetLoadError, type AssetFailureCategory } from '../image/assetRequest'
import { localizedAssetCategory, localizedError } from './errors'

describe('localizedError', () => {
  it.each([
    ['timeout', undefined, 'Timed out downloading INSTWARM (CDN, attempt 2).'],
    ['network', undefined, 'Could not connect to the asset service for INSTWARM (CDN, attempt 2).'],
    ['http', 503, 'Asset service returned HTTP 503 for INSTWARM (CDN, attempt 2).'],
    ['integrity', undefined, 'Downloaded asset is incomplete: INSTWARM (CDN, attempt 2).'],
    ['decompression', undefined, 'Could not decompress asset INSTWARM (CDN, attempt 2).'],
    ['unsupported', undefined, 'This browser does not support asset INSTWARM (CDN, attempt 2).'],
  ] as const)('localizes a structured %s asset failure without parsing Chinese', (category, status, expected) => {
    const error = new AssetLoadError(category, 'lut', 'INSTWARM', 'CDN', 2, status, 20_001)
    expect(localizedError(error, 'en')).toBe(expected)
  })

  it('preserves the structured Chinese asset diagnostic', () => {
    const error = new AssetLoadError('http', 'leak', '12', '本站', 1, 503, 10)
    expect(localizedError(error, 'zh-CN')).toBe('素材服务返回 HTTP 503：12（本站，第 1 次）')
  })

  it.each([
    ['当前浏览器无法读取此 HEIC，请在系统相册导出为 JPEG 后重试。', 'This browser cannot read this HEIC file. Export it as JPEG from Photos and try again.'],
    ['无法读取这张照片，文件可能损坏或格式不受支持。', 'This photo could not be read. It may be damaged or use an unsupported format.'],
    ['浏览器无法生成照片文件', 'The browser could not create the photo file.'],
    ['当前浏览器不能导出 WebP，请改用 JPEG。', 'This browser cannot export WebP. Use JPEG instead.'],
    ['当前设备最大支持 4096 像素长边', 'This device supports a maximum long edge of 4096px. Choose a lower resolution.'],
    ['浏览器无法建立兼容画布', 'The browser could not create a compatible canvas.'],
    ['WebGL 设置参数 失败（错误 1282）', 'WebGL rendering failed.'],
  ])('localizes a known browser failure: %s', (message, expected) => {
    expect(localizedError(new Error(message), 'en')).toBe(expected)
  })

  it('uses a safe language-matched fallback for an unknown internal error', () => {
    expect(localizedError(new Error('内部未知错误'), 'en')).toBe('Something went wrong. Please try again.')
    expect(localizedError(new Error('unknown internal failure'), 'zh-CN')).toBe('出现未知错误，请重试。')
  })
})

describe('localizedAssetCategory', () => {
  it.each([
    ['timeout', '超时', 'timeout'],
    ['network', '网络', 'network'],
    ['http', 'HTTP', 'HTTP'],
    ['integrity', '文件完整性', 'file integrity'],
    ['decompression', '解压', 'decompression'],
    ['unsupported', '浏览器支持', 'browser support'],
  ] as Array<[AssetFailureCategory, string, string]>)('localizes the %s diagnostic stage', (category, chinese, english) => {
    expect(localizedAssetCategory(category, 'zh-CN')).toBe(chinese)
    expect(localizedAssetCategory(category, 'en')).toBe(english)
  })
})
