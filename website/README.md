# Nightfall website

Public homepage, support contact, and privacy policy, hosted on the existing Netlify Free team `elyager`.

- Home: https://nightfall.elyager.com/
- Support: https://nightfall.elyager.com/#contact
- Privacy: https://nightfall.elyager.com/privacy/

Deploy from this directory:

```bash
netlify deploy --prod --no-build --site b4f41f17-e807-4ad5-bef9-6ac818a483d1 --dir public
```

The primary domain is `nightfall.elyager.com`. Cloudflare provides a DNS-only `nightfall` CNAME pointing to `nightfall-elyager.netlify.app`; Netlify manages HTTPS. The Netlify address permanently redirects to the custom domain, preserving paths and query strings.

No build or runtime JavaScript is needed. The Netlify configuration includes domain and privacy URL redirection and security headers. The provider's promotional badge is disabled. The homepage links to the public [Nightfall Chrome Web Store listing](https://chromewebstore.google.com/detail/nightfall/kliplffelmeeciahgamhfdmfnbghobfc?authuser=0&hl=en).
