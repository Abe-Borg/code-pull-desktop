import * as os from 'node:os'
import * as path from 'node:path'

/**
 * Persistent Playwright profile.
 * Windows: %LOCALAPPDATA%\CodePullDesktop\browser-profile
 * macOS: ~/Library/Application Support/CodePullDesktop/browser-profile
 * Linux: $XDG_DATA_HOME/CodePullDesktop/browser-profile
 *        or ~/.local/share/CodePullDesktop/browser-profile
 */
export function browserProfileDir(input?: {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  homedir?: string
}): string {
  const platform = input?.platform ?? process.platform
  const env = input?.env ?? process.env
  const home = input?.homedir ?? os.homedir()
  const join = platform === 'win32' ? path.win32.join : path.posix.join

  if (platform === 'win32') {
    const local = env.LOCALAPPDATA || join(home, 'AppData', 'Local')
    return join(local, 'CodePullDesktop', 'browser-profile')
  }

  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'CodePullDesktop', 'browser-profile')
  }

  const dataHome = env.XDG_DATA_HOME || join(home, '.local', 'share')
  return join(dataHome, 'CodePullDesktop', 'browser-profile')
}
