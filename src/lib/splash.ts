import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

// The inline splash is only used by the web/PWA build. The desktop app has a
// native splash that is already on screen before WebView2 loads, so it only
// needs to reveal the window and dismiss that native splash.
function afterFirstPaint(callback: () => void): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback)
  })
}

function revealDesktopWindow(splash: HTMLElement): void {
  splash.remove()

  void invoke('finish_startup').catch(() => {
    // If the command is unavailable, at least make sure the window is visible.
    // The native splash watchdog is the final fallback.
    void getCurrentWindow().show().catch(() => {})
  })
}

/**
 * Removes the inline startup splash once the app has painted. In the desktop
 * app this also reveals the restored main window and dismisses the native
 * splash. Calling more than once is safe.
 */
export function dismissSplash(): void {
  const splash = document.getElementById('splash')
  if (!splash || splash.dataset.leaving === 'true') return

  splash.dataset.leaving = 'true'

  if (isTauri()) {
    revealDesktopWindow(splash)
    return
  }

  afterFirstPaint(() => {
    splash.remove()
  })
}
