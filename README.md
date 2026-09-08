# Nightfall

A private dark mode extension with one adaptive dark theme.

Choose **Original**, **Dark**, or the existing optional **AI** palette for each site. Dark maps the page's colors into readable dark surfaces while retaining colored accents. The three former presets migrate to Dark automatically; site access, image brightness, saved element fixes, and generated AI palettes are preserved.

- Optional site access, including subdomains
- Early dark background for enabled pages, including AI mode
- Batched styling for dynamic pages and route changes
- Text contrast guards and protection for photos, video, canvas, and embeds
- Image brightness control and a picker for page-specific element fixes
- Keyboard toggle: `Ctrl/Command + Shift + D`

Normal theme processing stays on the device. After an explicit Generate click, AI mode sends aggregate style counts to OpenRouter. It excludes page text, URLs, selectors, IDs, classes, form values, cookies, and storage. The OpenRouter API key and generated palettes are saved in browser-local extension storage.

The darkening algorithm independently applies the color-preserving principle found in [Dark Night Mode's public source](https://github.com/DarkNightMode/Dark-Night-Mode-Chrome-Extension), with continuous luminance mapping, alpha-aware contrast, original-style sampling, and reversible overrides. See the [algorithm review and limitations](docs/algorithm-review.md).

## Development

```bash
npm install
npm run dev
```

Content-script changes during development update the active tab in place. For a production build:

```bash
npm run build
```

Load `.output/chrome-mv3` as an unpacked extension in Chrome.

## Release

Nightfall 1.0.0 was submitted to the Chrome Web Store on September 7, 2026 with automatic publication after approval. The confirmed status at submission was **Pending review**. Item ID: `kliplffelmeeciahgamhfdmfnbghobfc`.

The public [homepage and support contact](https://nightfall.elyager.com/) and [privacy policy](https://nightfall.elyager.com/privacy/) use the same publisher contact as Copy Tabs: Erik Elyager, elyager@gmail.com.

The uploaded archive is retained at `release/nightfall-1.0.0.zip`, with a SHA-256 checksum alongside it. Listing copy, privacy declarations, and store assets are in `store/`; the website is in `website/`. See `release/verification.md` for verification and limits.

Build a new upload archive with:

```bash
npm run compile
npm test
npm run zip
```

WXT writes the archive to `.output/nightfall-extension-1.0.0-chrome.zip`. Increase the package and lockfile version before submitting a later release.

## Verification

```bash
npm run compile
npm test
npm run benchmark
```

The Puppeteer benchmark loads an isolated copy of the production build against a local fixture. Its copy grants host permissions automatically, so it does not verify the browser's interactive permission prompt. It exercises rendering, dynamic content, contrast, media filters, navigation, the popup, and engine timings. Fixture results do not establish compatibility or performance on every website.
