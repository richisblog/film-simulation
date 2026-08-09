import { expect, test, type Page } from '@playwright/test'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function openPhoto(page: Page) {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'weak-network.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  })
  await expect(page.getByText('weak-network.png')).toBeVisible()
}

function instwarmButton(page: Page) {
  return page.getByRole('radio', { name: /暖调拍立得/ })
}

test('uses preview LUTs and falls back to the packaged full LUT when the CDN is unavailable', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/assets/luts/')) requests.push(request.url())
  })
  await page.route('https://cdn.invalid/**', (route) => route.abort('connectionfailed'))

  await openPhoto(page)
  const filter = instwarmButton(page)
  await filter.scrollIntoViewIfNeeded()

  await expect.poll(() => requests.some((url) => url.includes('/luts/previews/INSTWARM.rgb.deflate'))).toBe(true)
  expect(requests.some((url) => /\/luts\/INSTWARM\.rgb\.deflate$/.test(url))).toBe(false)

  const packagedResponse = page.waitForResponse((response) => (
    response.url().startsWith('http://127.0.0.1:4174/assets/luts/INSTWARM.rgb.deflate')
    && response.status() === 200
  ))
  await filter.click()
  await packagedResponse

  expect(requests.some((url) => url === 'https://cdn.invalid/assets/luts/INSTWARM.rgb.deflate')).toBe(true)
  expect(requests.some((url) => url.startsWith('http://127.0.0.1:4174/assets/luts/INSTWARM.rgb.deflate'))).toBe(true)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('shows a retry action and starts a fresh request after both sources fail', async ({ page }) => {
  let fullLutRequests = 0
  await page.route('https://cdn.invalid/**', (route) => {
    if (/\/luts\/INSTWARM\.rgb\.deflate$/.test(route.request().url())) fullLutRequests += 1
    return route.abort('connectionfailed')
  })
  await page.route('**/assets/luts/INSTWARM.rgb.deflate', (route) => {
    fullLutRequests += 1
    return route.abort('connectionfailed')
  })

  await openPhoto(page)
  const filter = instwarmButton(page)
  await filter.scrollIntoViewIfNeeded()
  await filter.click()

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('无法连接素材服务')
  await expect(alert).toContainText('阶段 network')
  await expect(page.getByRole('button', { name: '重试加载' })).toBeVisible()
  expect(fullLutRequests).toBe(2)

  await page.getByRole('button', { name: '重试加载' }).click()
  await expect.poll(() => fullLutRequests).toBe(4)
  await expect(alert).toContainText('无法连接素材服务')
})
