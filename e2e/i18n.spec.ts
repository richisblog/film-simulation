import { expect, test } from '@playwright/test'

test.describe('English browser', () => {
  test.use({ locale: 'en-US' })

  test('starts in English and persists a manual switch to Chinese', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveTitle('Film Simulation')
    await expect(page.getByText('Take a photo')).toBeVisible()
    await expect(page.getByText('For personal testing and comparison only. Not for commercial use.')).toBeVisible()
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest-en.webmanifest')
    await expect(page.getByText('仅供个人测试和对比使用，请勿用于商业用途')).toHaveCount(0)

    await page.getByRole('button', { name: '切换到中文' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page).toHaveTitle('胶片模拟')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page.getByText('把一张照片，')).toBeVisible()
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest-zh.webmanifest')
  })
})

test.describe('Chinese browser', () => {
  test.use({ locale: 'zh-CN' })

  test('starts in Chinese when there is no saved preference', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page).toHaveTitle('胶片模拟')
    await expect(page.getByText('把一张照片，')).toBeVisible()
    await expect(page.getByText('仅供个人测试和对比使用，请勿用于商业用途')).toBeVisible()
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './manifest-zh.webmanifest')
    await expect(page.getByText('For personal testing and comparison only. Not for commercial use.')).toHaveCount(0)
  })
})
