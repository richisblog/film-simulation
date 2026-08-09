import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n'

const DISMISSED_KEY = 'film-simulation-install-prompt-dismissed-at'
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000
const SHOW_DELAY = 1200

interface InstallEnvironment {
  userAgent: string
  standalone: boolean
  displayModeStandalone: boolean
  dismissedAt: number | null
  now: number
}

export function shouldShowIosInstallPrompt(environment: InstallEnvironment): boolean {
  const { userAgent } = environment
  const iphone = /iPhone/i.test(userAgent)
  const safari = /Safari/i.test(userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent)
  const recentlyDismissed = environment.dismissedAt !== null
    && environment.now - environment.dismissedAt < DISMISS_DURATION
  return iphone && safari && !environment.standalone && !environment.displayModeStandalone && !recentlyDismissed
}

export function InstallPrompt() {
  const { copy } = useLanguage()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissedAt = readDismissedAt()
    const standaloneNavigator = navigator as Navigator & { standalone?: boolean }
    const eligible = shouldShowIosInstallPrompt({
      userAgent: navigator.userAgent,
      standalone: standaloneNavigator.standalone === true,
      displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
      dismissedAt,
      now: Date.now(),
    })
    if (!eligible) return
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try { window.localStorage?.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* Storage may be unavailable. */ }
  }

  return <aside className="install-prompt" role="dialog" aria-labelledby="install-prompt-title" aria-describedby="install-prompt-description">
    <img src="./icons/apple-touch-icon.png" alt="" width="48" height="48" />
    <div className="install-prompt-copy">
      <strong id="install-prompt-title">{copy.installTitle}</strong>
      <p id="install-prompt-description">{copy.installDescription}</p>
      <ol>
        <li><span className="ios-share-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M6 10H4.8A1.8 1.8 0 0 0 3 11.8v7.4A1.8 1.8 0 0 0 4.8 21h14.4a1.8 1.8 0 0 0 1.8-1.8v-7.4a1.8 1.8 0 0 0-1.8-1.8H18" /></svg></span>{copy.installStepShare}</li>
        <li><span className="ios-add-icon" aria-hidden="true">＋</span>{copy.installStepAdd}</li>
      </ol>
    </div>
    <button type="button" className="install-prompt-close" aria-label={copy.installClose} onClick={dismiss}>×</button>
    <button type="button" className="install-prompt-confirm" onClick={dismiss}>{copy.installConfirm}</button>
  </aside>
}

function readDismissedAt(): number | null {
  try {
    const value = Number(window.localStorage?.getItem(DISMISSED_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}
