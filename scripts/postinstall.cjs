const { spawnSync } = require('node:child_process')
const fs = require('node:fs')

if (process.platform !== 'win32') {
  process.exit(0)
}

if (!fs.existsSync('node_modules/keytar')) {
  console.warn('keytar is not installed. Windows Credential Manager will be unavailable until it is.')
  process.exit(0)
}

const result = spawnSync('npx', ['electron-rebuild', '-f', '-w', 'keytar'], {
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
