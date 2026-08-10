import { expect, test } from '@playwright/test'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('film-simulation-language', 'zh-CN'))
})

test('preloads native Dazz dependencies and exposes promoted GRF variants without a full request', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/assets/dazz/luts/')) requests.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('status', { name: '胶片色彩加载状态' })).toContainText('胶片色彩已就绪（89 / 89）', { timeout: 30_000 })
  await page.locator('input[type="file"]').setInputFiles({ name: 'dazz.png', mimeType: 'image/png', buffer: PNG_1X1 })

  await expect(page.getByText('DAZZ CAMERA · 31')).toBeVisible()
  await expect(page.getByRole('button', { name: /135NE/ })).toHaveCount(0)
  const exposure = page.getByRole('slider', { name: '曝光' })
  await exposure.fill('1')
  await expect(exposure).toHaveValue('1')
  await expect(page.getByText('+1.0 EV')).toBeVisible()
  const cameraButtons = page.getByRole('region', { name: 'Dazz 相机滤镜库' }).getByRole('button')
  await expect(cameraButtons.nth(0)).toContainText('KV80')
  await expect(cameraButtons.nth(1)).toContainText('GRF')
  await expect(cameraButtons.nth(2)).toContainText('FQS')
  await page.getByRole('button', { name: /GRF\s*3 种偏向/ }).click()
  await expect(page.getByRole('radio', { name: /400TX/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /NEOP100/ })).toBeVisible()
  const variant = page.getByRole('radio', { name: /VELVIA/ })
  await variant.click()
  await expect(variant).toHaveAttribute('aria-checked', 'true')
  await expect(exposure).toHaveValue('1')
  expect(requests.some((url) => url.endsWith('/preview/DAZZ_STAGE_LOOKUP_VELVIA_X5.rgb.deflate'))).toBe(true)
  expect(requests.some((url) => url.includes('/full/'))).toBe(false)
})
