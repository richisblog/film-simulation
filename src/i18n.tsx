import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Language = 'zh-CN' | 'en'

const copy = {
  'zh-CN': {
    languageName: '中文', switchLanguage: 'Switch to English', switchLabel: 'EN',
    title: '胶片模拟', description: '照片只在浏览器本地处理的胶片模拟工具',
    notice: '仅供个人测试和对比使用，请勿用于商业用途', githubLabel: '在 GitHub 上查看并点赞',
    export: '导出', exportPhoto: '导出照片', mobileExport: '导出照片',
    localLab: '本地胶片暗房', heroLine1: '把一张照片，', heroLine2: '带回胶片时代。', heroSub: '胶片仿色测试', supported: '支持',
    reading: '正在读取…', replacePhoto: '换一张', choosePhoto: '选择照片', dropPhoto: '或把照片拖到这里',
    filmSimulation: '胶片模拟', original: '原图', selectOriginal: '选择原图', reset: '重置', filterStrength: '滤镜强度',
    filmTexture: '胶片质感', grain: '颗粒', vignette: '暗角', lightLeak: '漏光', lightLeakEffects: '漏光效果',
    disableLeak: '关闭漏光', disabled: '关闭', leakNumber: (index: number) => `漏光 ${index}`, leakStrength: '漏光强度', filmFilters: '胶片滤镜',
    photoPreview: '照片预览区', originalComparison: '原图对比', effectComparison: '效果对比', effectPreview: '效果预览',
    backToEffect: '返回效果', compareOriginal: '对比原图', acceleratedPreview: '图形加速预览', compatibilityMode: '兼容模式', previewFailed: '预览失败', previewUnavailable: '预览不可用',
    exportEyebrow: '照片导出', closeExport: '关闭导出面板', fileFormat: '文件格式', longEdge: '长边分辨率', originalSize: '原尺寸', quality: '画质', outputSize: '输出尺寸',
    rendering: '正在本地渲染…', downloadPhoto: '下载照片', localProcessing: '处理与编码都在本机完成',
    problem: '出现问题', stage: '阶段', retryLoad: '重试加载', retry: '重试', closeError: '关闭错误',
    loadingManifest: '正在读取胶片色彩清单', colorsReady: (ready: number, total: number) => `胶片色彩已就绪（${ready} / ${total}）`,
    preparingColors: '正在准备胶片色彩', colorsNeedRetry: '部分胶片色彩待重试', colorLoadStatus: '胶片色彩加载状态',
    completed: (done: number, total: number, percent: number) => `已完成 ${done} / ${total} · ${percent}%`, checkingCache: '正在确认本地缓存…', colorLoadProgress: '胶片色彩加载进度',
    justCompleted: (done: number, name: string) => `刚完成第 ${done} 个：${name}`, processingItems: (active: number) => `正在处理 ${active} 项`, waiting: '等待加载',
    availableItems: (ready: number, failed: number) => `${ready} 个可用${failed > 0 ? ` · ${failed} 个待重试` : ''}`, retryColors: '重试未完成色彩',
    supportRegion: '支持与反馈', supportNote: '你好，我是独立开发这个工具的个人创作者。「胶片模拟」由我利用业余时间持续维护，希望它能为你带来一点乐趣。如果它对你有所帮助，欢迎在 GitHub 上点亮 Star 支持我；如果你有任何改进建议，也非常欢迎 Fork 本项目或通过小红书与我交流。',
    githubSupport: '在 GitHub 上为我点亮 Star', xhsSupport: '通过小红书与我交流', xhs: '小红书',
    analyticsNote: '为持续优化使用体验，本页面会记录匿名访问及导出所用的滤镜类型；不会上传或保存您的照片、文件名及个人信息。',
    renderingStatus: '正在本地渲染照片', generated: (name: string) => `已生成 ${name}`, exportFailed: '导出失败',
    deviceMax: (max: number) => `当前设备最大支持 ${max} 像素长边，请选择较低分辨率。`,
    unsupportedFile: '请选择 JPEG、PNG、WebP，或当前浏览器能够读取的 HEIC 照片。', readFailed: '无法读取照片', lutLoadFailed: 'LUT 载入失败', leakLoadFailed: '漏光载入失败',
  },
  en: {
    languageName: 'English', switchLanguage: '切换到中文', switchLabel: '中文',
    title: 'Film Simulation', description: 'A film simulation tool that processes photos locally in your browser',
    notice: 'For personal testing and comparison only. Not for commercial use.', githubLabel: 'View and star on GitHub',
    export: 'Export', exportPhoto: 'Export Photo', mobileExport: 'Export Photo',
    localLab: 'LOCAL FILM LAB', heroLine1: 'Take a photo', heroLine2: 'back to the film era.', heroSub: 'Film color simulation, processed locally', supported: 'Supports',
    reading: 'Reading…', replacePhoto: 'Replace', choosePhoto: 'Choose Photo', dropPhoto: 'or drop a photo here',
    filmSimulation: 'Film Simulation', original: 'Original', selectOriginal: 'Select original', reset: 'Reset', filterStrength: 'Filter strength',
    filmTexture: 'Film Texture', grain: 'Grain', vignette: 'Vignette', lightLeak: 'Light Leak', lightLeakEffects: 'Light leak effects',
    disableLeak: 'Disable light leak', disabled: 'Off', leakNumber: (index: number) => `Light leak ${index}`, leakStrength: 'Light leak strength', filmFilters: 'Film filters',
    photoPreview: 'Photo preview', originalComparison: 'Original comparison', effectComparison: 'Effect comparison', effectPreview: 'Effect preview',
    backToEffect: 'Show Effect', compareOriginal: 'Compare Original', acceleratedPreview: 'GPU Preview', compatibilityMode: 'Compatibility Mode', previewFailed: 'Preview failed', previewUnavailable: 'Preview unavailable',
    exportEyebrow: 'PHOTO EXPORT', closeExport: 'Close export panel', fileFormat: 'File format', longEdge: 'Long-edge resolution', originalSize: 'Original size', quality: 'Quality', outputSize: 'Output size',
    rendering: 'Rendering locally…', downloadPhoto: 'Download Photo', localProcessing: 'Processing and encoding stay on this device',
    problem: 'Something went wrong', stage: 'Stage', retryLoad: 'Retry loading', retry: 'Retry', closeError: 'Close error',
    loadingManifest: 'Reading film color catalog', colorsReady: (ready: number, total: number) => `Film colors ready (${ready} / ${total})`,
    preparingColors: 'Preparing film colors', colorsNeedRetry: 'Some film colors need retrying', colorLoadStatus: 'Film color loading status',
    completed: (done: number, total: number, percent: number) => `Completed ${done} / ${total} · ${percent}%`, checkingCache: 'Checking local cache…', colorLoadProgress: 'Film color loading progress',
    justCompleted: (done: number, name: string) => `Completed #${done}: ${name}`, processingItems: (active: number) => `Processing ${active} items`, waiting: 'Waiting to load',
    availableItems: (ready: number, failed: number) => `${ready} available${failed > 0 ? ` · ${failed} to retry` : ''}`, retryColors: 'Retry incomplete colors',
    supportRegion: 'Support and feedback', supportNote: 'Hi, I’m the independent creator of Film Simulation. I maintain this tool in my spare time and hope it brings you a little joy. If it helps, please consider starring it on GitHub. Suggestions and forks are always welcome, and you can also reach me on Xiaohongshu.',
    githubSupport: 'Star this project on GitHub', xhsSupport: 'Contact me on Xiaohongshu', xhs: 'Xiaohongshu',
    analyticsNote: 'To improve the experience, this page records anonymous visits and the filter used for exports. Your photos, filenames, and personal information are never uploaded or stored.',
    renderingStatus: 'Rendering photo locally', generated: (name: string) => `Generated ${name}`, exportFailed: 'Export failed',
    deviceMax: (max: number) => `This device supports a maximum long edge of ${max}px. Choose a lower resolution.`,
    unsupportedFile: 'Choose a JPEG, PNG, WebP, or a HEIC photo supported by this browser.', readFailed: 'Could not read the photo', lutLoadFailed: 'Could not load the LUT', leakLoadFailed: 'Could not load the light leak',
  },
} as const

export type Copy = typeof copy['zh-CN'] | typeof copy.en

interface LanguageContextValue { language: Language; setLanguage(language: Language): void; copy: Copy }
const defaultValue: LanguageContextValue = { language: 'zh-CN', setLanguage: () => {}, copy: copy['zh-CN'] }
const LanguageContext = createContext<LanguageContextValue>(defaultValue)
const STORAGE_KEY = 'film-simulation-language'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    return getStorage()?.getItem(STORAGE_KEY) === 'en' ? 'en' : 'zh-CN'
  })

  useEffect(() => {
    const current = copy[language]
    document.documentElement.lang = language
    document.title = current.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', current.description)
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', current.title)
    getStorage()?.setItem(STORAGE_KEY, language)
  }, [language])

  const value = useMemo(() => ({ language, setLanguage, copy: copy[language] }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() { return useContext(LanguageContext) }

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

export function localizeErrorMessage(message: string, language: Language): string {
  if (language === 'zh-CN') return message
  const max = message.match(/当前设备最大支持 (\d+) 像素长边/)
  if (max) return `This device supports a maximum long edge of ${max[1]}px. Choose a lower resolution.`
  const exportFormat = message.match(/当前浏览器不能导出 (.+)，请改用 JPEG。/)
  if (exportFormat) return `This browser cannot export ${exportFormat[1]}. Use JPEG instead.`
  const exact: Record<string, string> = {
    '请选择 JPEG、PNG、WebP，或当前浏览器能够读取的 HEIC 照片。': copy.en.unsupportedFile,
    '无法读取照片': copy.en.readFailed, '导出失败': copy.en.exportFailed, '预览失败': copy.en.previewFailed,
    '浏览器无法生成照片文件': 'The browser could not create the photo file.',
    '当前浏览器无法读取此 HEIC，请在系统相册导出为 JPEG 后重试。': 'This browser cannot read this HEIC file. Export it as JPEG from Photos and try again.',
    '无法读取这张照片，文件可能损坏或格式不受支持。': 'This photo could not be read. It may be damaged or use an unsupported format.',
    '无法载入效果素材清单': 'Could not load the effects catalog.', 'LUT 载入失败': copy.en.lutLoadFailed, '漏光载入失败': copy.en.leakLoadFailed,
  }
  return exact[message] ?? message
}
