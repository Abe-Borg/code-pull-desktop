# Code Pull Desktop

Windows desktop app for pulling a code or standard section into a citation card. Claude routing uses your own API key. Later source adapters will use your own site logins. This repo does not ship a shared subscription.

NFPA section asks go to the LiNK adapter. Other section asks still use the echo adapter. UpCodes is a stub and is not called.

## Product locks

- Claude access is bring-your-own-key. The key is stored on the machine that runs the app.
- Publisher access is bring-your-own login. Nothing in this repo signs in with a shared account.
- NFPA LiNK runs in the Playwright Chromium utility process. The session lives in a persistent browser profile on this computer.
- Non-NFPA section asks still use the echo adapter, which returns a synthetic excerpt.

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
| Windows | Credential Manager. Target `Code Pull Desktop`. Accounts: `claude-api-key`, and optionally `nfpa-link-username` and `nfpa-link-password`. |
| Linux and macOS | Mode `0600` files in the app user-data folder. On Linux the Claude key is `~/.config/Code Pull/secrets/claude-api-key`. Optional LiNK login files sit beside it. |

The renderer receives a hint (last four characters) and the store location. It does not receive the key again after a successful save.

The file stub exists so a Linux CI agent can boot the app. It is the development stand-in for Credential Manager, not the Windows production store. The Windows build uses `keytar` when that addon matches Electron, and otherwise calls Credential Manager through PowerShell. Optional LiNK and UpCodes usernames and passwords use the same store. The browser session, not the password, is what later pulls use.

## Ask flow

1. If no key is stored, the window stays on the paste-key screen.
2. A single ask sends the whole text box. **One per line** sends each non-empty line, up to 20.
3. The main process calls the Claude Messages API (`claude-haiku-5-5`) with the stored key and classifies the ask as `nfpa-link`, `upcodes`, `echo`, or `unsupported`.
4. An NFPA publication plus a section goes to LiNK. IBC, IRC, IFC, and IMC, and any clear UpCodes ask, go to UpCodes.
5. `echo` still builds a synthetic excerpt for other codes (NEC, ASME, and similar). LiNK and UpCodes return `{ quotedText, citation: { edition, section, urlOrPath } }` from the signed-in page, or a failure card.
6. A missing key, an HTTP error, a timeout, a missing site session, or a section the site did not show is written on that ask's card.

## NFPA LiNK

Install Chromium once:

```bash
npx playwright install chromium
```

`npm install` skips that download.

First sign-in on Windows:

1. `npm run dev`
2. Save your Claude API key.
3. Open Settings and choose **Open NFPA LiNK sign-in**.
4. Sign in with your own NFPA LiNK account in the browser window. Finish a CAPTCHA there if LiNK shows one.
5. Code Pull stores the session and closes that window. Ask `NFPA 101 2021 section 7.2.1`.

The browser starts headless. It becomes visible only when the page is a login or CAPTCHA. Optional username and password in Settings are stored in Credential Manager and are used only to fill that form. The session that matters is the cookie jar in the profile.

Profile path:

| Platform | Path |
| --- | --- |
| Windows | `%LOCALAPPDATA%\CodePullDesktop\browser-profile` |
| macOS | `~/Library/Application Support/CodePullDesktop/browser-profile` |
| Linux | `~/.local/share/CodePullDesktop/browser-profile` (`$XDG_DATA_HOME/CodePullDesktop/browser-profile` when that variable is set) |

UpCodes uses the same folder with `browser-profile-upcodes` instead of `browser-profile`. On this machine that is `~/.local/share/CodePullDesktop/browser-profile-upcodes`.

Sign in to UpCodes the same way: Settings, **Open UpCodes sign-in**, your own account. Ask `IBC 2021 section 1005.3.1`. A pull with no session, or a page that does not contain the section, fails on the card.

## Prototype install

Use the slim installer, `Code-Pull-Setup-slim.exe`. It is unsigned. Windows SmartScreen will warn. Choose **More info**, then **Run anyway**. Node is not required after setup.

The slim installer does not contain Chromium. On first launch, Code Pull downloads Chromium into `%LOCALAPPDATA%\CodePullDesktop\ms-playwright`. That needs an internet connection once. If the download stops, use **Install Chromium** at the bottom of the desk.

1. Copy `Code-Pull-Setup-slim.exe` onto the Windows PC.
2. Run it. Leave the install directory at the default, or pick another folder.
3. Start **Code Pull**. Wait until the footer says Chromium is installed.
4. Paste your Claude API key.
5. Settings → **Open NFPA LiNK sign-in**. Sign in with your LiNK account.
6. Settings → **Open UpCodes sign-in**. Sign in with your UpCodes account.
7. Ask for a section, for example `NFPA 101 2021 section 7.2.1` or `IBC 2021 section 1005.3.1`.

What works: Claude key routing, NFPA LiNK pulls, UpCodes pulls for IBC, IRC, IFC, and IMC, and echo cards for other section asks. What is unsigned: the installer and the app. Expect the SmartScreen warning.

`npm run pack:slim` writes `release-slim/Code-Pull-Setup-slim.exe`. `npm run pack` still builds the larger `Code-Pull-Setup.exe` that embeds Chromium.

## Playwright path

`app/main/playwright-host.ts` is the Electron utility process. The desk pings it, and NFPA LiNK retrieval and sign-in run in that process. Smoke mode answers LiNK asks from a fixture and does not open the site.

## Layout

```
app/main        Electron main, preload, IPC, Playwright utility process
app/renderer    React desk (onboarding, ask box, answer cards)
adapters        Echo adapter, NFPA LiNK, UpCodes, browser-host messages
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

`npm run smoke` builds, launches Electron, stores a fake key through the onboarding screen, and checks fixture LiNK and UpCodes cards plus an unsupported card. On Linux without a display it uses `xvfb-run`. Windows launches keep the renderer sandbox on. Linux and macOS launches turn it off, because Chromium often cannot broker that sandbox outside Windows. Set `CODE_PULL_NO_SANDBOX=1` only if you need the same behavior on Windows while debugging. Smoke mode never calls the Claude API, NFPA LiNK, or UpCodes.

## Out of scope here

- A signed installer
- Any shared subscription or shared runner
