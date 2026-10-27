const { spawn } = require('node:child_process')
const path = require('node:path')

const electron = require('electron')
const cwd = path.resolve(__dirname, '..')
const env = {
  ...process.env,
  CODE_PULL_SMOKE: '1',
  CODE_PULL_NO_SANDBOX: '1',
  ELECTRON_DISABLE_SANDBOX: '1',
}

const electronArgs = ['.', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
const useXvfb = process.platform === 'linux' && !process.env.DISPLAY
const command = useXvfb ? 'xvfb-run' : electron
const args = useXvfb ? ['-a', electron, ...electronArgs] : electronArgs

const child = spawn(command, args, { cwd, env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})
