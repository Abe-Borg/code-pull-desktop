# Packaging notes

`npm run pack` runs `electron-builder` with `packaging/electron-builder.yml`.

The Windows target is an NSIS installer named `Code Pull-Setup.exe` under `release/`. Signing is left off (`signAndEditExecutable: false`). A signed installer is a later step.

Native and browser bits cannot stay inside the asar archive:

- `keytar` (Windows Credential Manager) is unpacked and rebuilt with `npmRebuild`.
- `playwright` and `playwright-core` are unpacked so a later source adapter can launch Chromium.

On Windows, `npm install` runs `electron-rebuild` for keytar. On Linux and macOS that rebuild is skipped so CI can compile the app without a Win32 credential library. Those platforms use the file stub in the app user-data directory.

Playwright browsers are not bundled in this increment. Install Chromium on a machine that will run a source adapter:

```bash
npx playwright install chromium
```

The utility process `dist-electron/playwright-host.js` only reports that path today. It does not open a publisher site.
