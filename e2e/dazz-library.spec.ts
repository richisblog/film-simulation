import { expect, test } from '@playwright/test'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('film-simulation-language', 'zh-CN'))
})

test('opens a camera variant menu and loads the selected full Dazz LUT', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/assets/dazz/luts/')) requests.push(request.url())
  })
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({ name: 'dazz.png', mimeType: 'image/png', buffer: PNG_1X1 })

  await expect(page.getByText('DAZZ CAMERA · 42')).toBeVisible()
  const exposure = page.getByRole('slider', { name: '曝光' })
  await exposure.fill('1')
  await expect(exposure).toHaveValue('1')
  await expect(page.getByText('+1.0 EV')).toBeVisible()
  await page.getByRole('button', { name: /FXN\s*4 种偏向/ }).click()
  const variant = page.getByRole('radio', { name: /FXN2/ })
  await variant.click()
  await expect(variant).toHaveAttribute('aria-checked', 'true')
  await expect(exposure).toHaveValue('1')
  await expect.poll(() => requests.some((url) => url.endsWith('/full/DAZZ_FXN_FXN2.rgb.deflate'))).toBe(true)
  expect(requests.some((url) => url.endsWith('/preview/DAZZ_FXN_FXN2.rgb.deflate'))).toBe(true)
})
