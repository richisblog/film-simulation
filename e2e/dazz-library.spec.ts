import { expect, test } from '@playwright/test'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('film-simulation-language', 'zh-CN'))
})

test('preloads enabled Dazz 8-cubes and selects a retained camera variant without a full request', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/assets/dazz/luts/')) requests.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('status', { name: '胶片色彩加载状态' })).toContainText('胶片色彩已就绪（76 / 76）', { timeout: 30_000 })
  await page.locator('input[type="file"]').setInputFiles({ name: 'dazz.png', mimeType: 'image/png', buffer: PNG_1X1 })

  await expect(page.getByText('DAZZ CAMERA · 29')).toBeVisible()
  await expect(page.getByRole('button', { name: /135NE/ })).toHaveCount(0)
  const exposure = page.getByRole('slider', { name: '曝光' })
  await exposure.fill('1')
  await expect(exposure).toHaveValue('1')
  await expect(page.getByText('+1.0 EV')).toBeVisible()
  await page.getByRole('button', { name: /FXN\s*3 种偏向/ }).click()
  await expect(page.getByRole('radio', { name: /FX3 3/ })).toHaveCount(0)
  const variant = page.getByRole('radio', { name: /FXN2/ })
  await variant.click()
  await expect(variant).toHaveAttribute('aria-checked', 'true')
  await expect(exposure).toHaveValue('1')
  expect(requests.some((url) => url.endsWith('/preview/DAZZ_FXN_FXN2.rgb.deflate'))).toBe(true)
  expect(requests.some((url) => url.includes('/full/'))).toBe(false)
})
