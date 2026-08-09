import { expect, test } from '@playwright/test'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('film-simulation-language', 'zh-CN'))
  await context.route('https://cdn.invalid/**', (route) => route.abort('connectionfailed'))
})

test('keeps analytics private and does not track the local preview as production', async ({ context, page }) => {
  const collectorRequests: string[] = []
  context.on('request', (request) => {
    if (request.url() === 'https://gc.zgo.at/count.js') collectorRequests.push(request.url())
  })
  await context.route('https://gc.zgo.at/count.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: '/* controlled GoatCounter collector fixture */',
  }))

  await page.goto('/')

  await expect(page.getByRole('status', { name: '网站累计浏览量' })).toHaveCount(0)
  await expect(page.getByText('为持续优化使用体验，本页面会记录匿名访问及导出所用的滤镜类型；不会上传或保存您的照片、文件名及个人信息。')).toBeVisible()
  await expect(page.locator('script[data-goatcounter]')).toHaveCount(0)
  expect(collectorRequests).toHaveLength(0)
})

test('keeps successful filter export available when all analytics requests are blocked', async ({ context, page }) => {
  await context.route('https://gc.zgo.at/**', (route) => route.abort('blockedbyclient'))
  await context.route('https://analytics.invalid/**', (route) => route.abort('blockedbyclient'))

  await page.goto('/')
  await expect(page.getByRole('status', { name: '网站累计浏览量' })).toHaveCount(0)
  await expect(page.getByRole('status', { name: '胶片色彩加载状态' })).toContainText('胶片色彩已就绪（36 / 36）', { timeout: 15_000 })

  await page.locator('input[type="file"]').setInputFiles({
    name: 'analytics-blocked.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  })
  await expect(page.getByText('analytics-blocked.png')).toBeVisible()
  const filter = page.getByRole('radio', { name: /暖调拍立得/ })
  await filter.scrollIntoViewIfNeeded()
  await filter.click()
  await expect(filter).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: '导出' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载照片' }).click()
  await download
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
