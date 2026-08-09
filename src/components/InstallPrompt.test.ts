import { expect, it } from 'vitest'
import { shouldShowIosInstallPrompt } from './InstallPrompt'

const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'

it('shows install instructions only for iPhone Safari outside standalone mode', () => {
  expect(shouldShowIosInstallPrompt({
    userAgent: iphoneSafari, standalone: false, displayModeStandalone: false, dismissedAt: null, now: 10_000,
  })).toBe(true)

  expect(shouldShowIosInstallPrompt({
    userAgent: iphoneSafari, standalone: true, displayModeStandalone: false, dismissedAt: null, now: 10_000,
  })).toBe(false)
})

it('does not show in another iOS browser or during the dismissal cooldown', () => {
  expect(shouldShowIosInstallPrompt({
    userAgent: iphoneSafari.replace('Version/18.0 Mobile/15E148 Safari/604.1', 'CriOS/140.0 Mobile/15E148 Safari/604.1'),
    standalone: false, displayModeStandalone: false, dismissedAt: null, now: 10_000,
  })).toBe(false)

  expect(shouldShowIosInstallPrompt({
    userAgent: iphoneSafari, standalone: false, displayModeStandalone: false, dismissedAt: 9_000, now: 10_000,
  })).toBe(false)
})
