# v0.1.0-prototype

Unsigned Windows prototype of Code Pull. This tag does not include the installer.

## Build Code-Pull-Setup-slim.exe

From this tag:

```bash
git checkout v0.1.0-prototype
npm install
npm run pack:slim
```

That writes `release-slim/Code-Pull-Setup-slim.exe`. The file is local build output and is not stored in git.

`npm run pack` writes the larger `release/Code-Pull-Setup.exe`, which embeds Chromium. Use the slim installer.

## Install on Windows

The installer is unsigned. SmartScreen will warn. Choose **More info**, then **Run anyway**. Node is not required after setup.

1. Run `Code-Pull-Setup-slim.exe`.
2. Start **Code Pull**. The first launch downloads Chromium into `%LOCALAPPDATA%\CodePullDesktop\ms-playwright`. That needs the internet once. If it stops, use **Install Chromium** at the bottom of the desk.
3. Paste your Claude API key.
4. Settings → **Open NFPA LiNK sign-in**. Sign in with your own LiNK account.
5. Settings → **Open UpCodes sign-in**. Sign in with your own UpCodes account.
6. Ask `NFPA 101 2021 section 7.2.1` or `IBC 2021 section 1005.3.1`.

What works: Claude key routing, NFPA LiNK, UpCodes for IBC, IRC, IFC, and IMC, and echo cards for other section asks.
