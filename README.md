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

The file stub exists so a Linux CI agent can boot the app. It is the development stand-in for Credential Manager, not the Windows production store. On Windows a missing `keytar` binding stops the app with an error instead of writing the key to disk.

## Ask flow

1. If no key is stored, the window stays on the paste-key screen.
2. A single ask sends the whole text box. **One per line** sends each non-empty line, up to 20.
3. The main process calls the Claude Messages API (`claude-haiku-5-5`) with the stored key and classifies the ask as `nfpa-link`, `echo`, or `unsupported`.
4. An NFPA publication plus a section is pulled from LiNK even when the classifier says `echo`.
5. `echo` still builds a synthetic excerpt for other codes. LiNK returns `{ quotedText, citation: { edition, section, urlOrPath } }` from the signed-in page, or a failure card.
6. A missing key, an HTTP error, a timeout, a missing LiNK session, or a section LiNK did not show is written on that ask's card.

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

This environment uses the Linux path. A pull with no session, or a publication page that does not contain the section, fails on the card instead of inventing text.

UpCodes is `adapters/upcodes` and returns a not-connected result. The router does not call it.

## Playwright path

`app/main/playwright-host.ts` is the Electron utility process. The desk pings it, and NFPA LiNK retrieval and sign-in run in that process. Smoke mode answers LiNK asks from a fixture and does not open the site.

## Layout

```
app/main        Electron main, preload, IPC, Playwright utility process
app/renderer    React desk (onboarding, ask box, answer cards)
adapters        Echo adapter, NFPA LiNK, UpCodes stub, browser-host messages
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

`npm run smoke` builds, launches Electron, stores a fake key through the onboarding screen, and checks a fixture LiNK card plus an unsupported card. On Linux without a display it uses `xvfb-run`. Windows launches keep the renderer sandbox on. Linux and macOS launches turn it off, because Chromium often cannot broker that sandbox outside Windows. Set `CODE_PULL_NO_SANDBOX=1` only if you need the same behavior on Windows while debugging. Smoke mode never calls the Claude API or NFPA LiNK. It uses an in-process stand-in so the card path can be checked without a key that bills.

## Out of scope here

- UpCodes retrieval
- A signed installer
- Any shared subscription or shared runner
