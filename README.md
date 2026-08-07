# Nightfall

A fast, privacy-first dark mode extension.

## Included in the prototype

- Per-site Original, Slate Blue, Linear-inspired, GitHub-inspired, and AI modes in a five-button selector
- An opt-in AI mode that creates and locally caches a site-aware palette through OpenRouter's free router
- A `document_start` bootstrap layer that prevents bright loading flashes
- Fast CSS styling with a cached, batched adaptive fallback
- Contrast guards for text and UI colors
- Image, video, canvas, iframe, and embedded-media protection
- Optional per-site access and per-site enable/disable
- Immediate dark-to-dark palette switching without a bright transition flash
- Automatic recovery on already-open tabs and SPA route changes without a reload
- A DevTools-style element picker for saving page-specific theme fixes
- A keyboard shortcut (`Ctrl/Command + Shift + D`)

All normal theme processing and settings remain on the device. AI mode is the only networked feature: after an explicit click it sends a privacy-minimized aggregate style snapshot to OpenRouter. The snapshot excludes page text, URLs, selectors, IDs, classes, form values, cookies, and storage. The OpenRouter API key and generated palette stay in browser-local extension storage.

## Development

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

Load `.output/chrome-mv3` as an unpacked extension in Chrome.

## Verification

```bash
npm run compile
npm test
npm run benchmark
```

The Puppeteer benchmark loads an isolated permission-adjusted copy of the production build against a local fixture. It checks dark rendering, dynamic DOM processing, contrast, protected media, layout shift, long tasks, the popup, and engine timings.
