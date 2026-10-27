# Packaging notes

`npm run pack` runs `electron-builder` with `packaging/electron-builder.yml`.

The Windows target is an unsigned NSIS installer named `Code-Pull-Setup.exe` under `release/`. Signing is left off (`signAndEditExecutable: false`). `npmRebuild` is off because this package is produced on Linux; Windows Credential Manager is reached through PowerShell when `keytar` is not rebuilt for Electron.

Native and browser bits cannot stay inside the asar archive:

- `keytar` (Windows Credential Manager) is unpacked and rebuilt with `npmRebuild`.
- `playwright` and `playwright-core` are unpacked so a later source adapter can launch Chromium.

On Windows, `npm install` runs `electron-rebuild` for keytar. On Linux and macOS that rebuild is skipped so CI can compile the app without a Win32 credential library. Those platforms use the file stub in the app user-data directory.

`npm run pack` downloads the Windows Chromium build that matches this Playwright version and places it in `build/playwright-browsers`. electron-builder copies that folder to `resources/playwright-browsers`. The packaged app sets `PLAYWRIGHT_BROWSERS_PATH` so Abe does not install Node or Chromium after setup.

The installer is unsigned. SmartScreen will warn.

Playwright browsers for a from-source checkout are still installed with:

```bash
npx playwright install chromium
```

The utility process `dist-electron/playwright-host.js` opens NFPA LiNK and UpCodes. Smoke mode does not.
