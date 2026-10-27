# Code Pull Desktop

Windows desktop app for pulling a code or standard section into a citation card. Claude routing uses your own API key. Later source adapters will use your own site logins. This repo does not ship a shared subscription.

Increment C is the desk, the key gate, and an echo adapter. NFPA LiNK and UpCodes are not connected.

## Product locks

- Claude access is bring-your-own-key. The key is stored on the machine that runs the app.
- Publisher access will be bring-your-own login. Nothing in this repo signs in with a shared account.
- Source retrieval goes through a Playwright Chromium utility process. The echo adapter is the only adapter that answers today, and its excerpt is synthetic.

## Run on Windows

Requirements: Node.js 22+, npm, and a [Claude API key](https://platform.claude.com/) that starts with `sk-ant-`.

```bash
npm install
npm run dev
```

`npm install` rebuilds `keytar` against Electron on Windows so the key can go into Credential Manager. If that step is skipped, run `npm run rebuild-keytar`.

Production-shaped launch after a build:

```bash
npm run build
npm start
```

The dev renderer listens on `http://127.0.0.1:43123` only while `npm run dev` is running. The window you use is the Electron app.

Installer scaffold (unsigned, not produced by a normal build):

```bash
npm run pack
```

That writes `release/Code Pull-Setup.exe` via `electron-builder`. See [packaging/NOTES.md](packaging/NOTES.md). Signing is intentionally unset.

## Where secrets live

| Platform | Store |
| --- | --- |
| Windows | Credential Manager. Target `Code Pull Desktop`, account `claude-api-key`, via `keytar`. |
| Linux and macOS | A mode `0600` file stub at the app user-data path `secrets/claude-api-key`. On Linux that is `~/.config/Code Pull/secrets/claude-api-key`. |

The renderer receives a hint (last four characters) and the store location. It does not receive the key again after a successful save.

The file stub exists so a Linux CI agent can boot the app. It is the development stand-in for Credential Manager, not the Windows production store. On Windows a missing `keytar` binding stops the app with an error instead of writing the key to disk.

## Ask flow

1. If no key is stored, the window stays on the paste-key screen.
2. A single ask sends the whole text box. **One per line** sends each non-empty line, up to 20.
3. The main process calls the Claude Messages API (`claude-haiku-5-5`) with the stored key and classifies the ask as `echo` or `unsupported`.
4. `echo` builds a synthetic excerpt plus `{ edition, section, urlOrPath }`. The path uses the `echo://` scheme.
5. A missing key, an HTTP error, a timeout, or an unreadable classification shows on that ask's card. An `unsupported` classification does too.

## Playwright path

`app/main/playwright-host.ts` runs as an Electron utility process. The desk pings it and shows whether Playwright can see a Chromium binary. The process does not navigate.

Install the browser when you are ready for a real adapter:

```bash
npx playwright install chromium
```

`npm install` skips the browser download.

## Layout

```
app/main        Electron main, preload, IPC, Playwright utility process
app/renderer    React desk (onboarding, ask box, answer cards)
adapters        Echo adapter and the browser-host message types
router          Ask splitting and the Claude Messages call
secrets         Credential Manager binding and the non-Windows file stub
packaging       electron-builder config and notes
shared          IPC contracts
```

## Checks

```bash
npm test
npm run smoke
```

`npm run smoke` builds, launches Electron, stores a fake key through the onboarding screen, and checks an echo card plus an unsupported card. On Linux without a display it uses `xvfb-run`. Smoke mode never calls the Claude API. It uses an in-process stand-in so the card path can be checked without a key that bills.

## Out of scope here

- Real NFPA LiNK or UpCodes adapters
- A signed installer
- Any shared runner or shared API key
