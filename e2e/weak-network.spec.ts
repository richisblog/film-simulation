import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

const isLutBinary = (url: string) => url.endsWith('.rgb.deflate')

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('film-simulation-language', 'zh-CN'))
})

async function uploadPhoto(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'persistent-lut.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  })
  await expect(page.getByText('persistent-lut.png')).toBeVisible()
}

async function waitForAllLuts(page: Page) {
  await expect(page.getByRole('status', { name: '胶片色彩加载状态' })).toContainText('胶片色彩已就绪（89 / 89）', { timeout: 15_000 })
}

async function blockCdn(context: BrowserContext) {
  await context.route('https://cdn.invalid/**', (route) => route.abort('connectionfailed'))
}

test('reopens with all native dependencies from persistent local cache and no LUT network requests', async ({ context, page }) => {
  const requests: string[] = []
  context.on('request', (request) => {
    if (isLutBinary(request.url())) requests.push(request.url())
  })
  await blockCdn(context)

  await page.goto('/')
  await waitForAllLuts(page)

  expect(new Set(requests).size).toBe(172)
  expect(requests.every((url) => url.includes('/luts/8cube-v1/') || url.includes('/dazz/luts/preview/'))).toBe(true)
  expect(requests.some((url) => url.includes('/full/'))).toBe(false)

  requests.length = 0
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('/')
  await waitForAllLuts(reopened)

  expect(requests).toEqual([])
})

test('after a partial failure, refresh requests only the missing LUT', async ({ context, page }) => {
  const requests: string[] = []
  const missingPattern = '**/assets/luts/8cube-v1/INSTWARM.rgb.deflate'
  const failOrigin = async (route: Route) => {
    if (route.request().url().startsWith('http://127.0.0.1:4174/')) return route.abort('connectionfailed')
    return route.fallback()
  }
  context.on('request', (request) => {
    if (isLutBinary(request.url())) requests.push(request.url())
  })
  await blockCdn(context)
  await context.route(missingPattern, failOrigin)

  await page.goto('/')
  const progress = page.getByRole('status', { name: '胶片色彩加载状态' })
  await expect(progress).toContainText('88 个可用 · 1 个待重试', { timeout: 15_000 })
  await expect(page.getByRole('button', { name: '重试未完成色彩' })).toBeVisible()

  await context.unroute(missingPattern, failOrigin)
  requests.length = 0
  await page.reload()
  await waitForAllLuts(page)

  expect(requests).toHaveLength(2)
  expect(requests.every((url) => url.endsWith('/luts/8cube-v1/INSTWARM.rgb.deflate'))).toBe(true)
})

test('main preview and export use the preloaded 8-cube asset without a full LUT request', async ({ context, page }) => {
  const requests: string[] = []
  context.on('request', (request) => {
    if (isLutBinary(request.url())) requests.push(request.url())
  })
  await blockCdn(context)

  await page.goto('/')
  await waitForAllLuts(page)
  await uploadPhoto(page)
  const filter = page.getByRole('radio', { name: /暖调拍立得/ })
  await filter.scrollIntoViewIfNeeded()
  await filter.click()
  await expect(filter).toHaveAttribute('aria-checked', 'true')

  const networkCountBeforeExport = requests.length
  await page.getByRole('button', { name: '导出' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载照片' }).click()
  await download

  expect(requests).toHaveLength(networkCountBeforeExport)
  expect(requests.some((url) => url.includes('/full/'))).toBe(false)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
