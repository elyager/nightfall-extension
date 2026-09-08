# Nightfall — Privacy practices and permission justifications

These notes describe the submitted version 1.0.0. The live privacy policy is published at https://nightfall-elyager.netlify.app/privacy/ and was verified before submission.

## Data disclosure

Do not declare that Nightfall never handles or shares data. Optional AI requests transmit an API credential and a page-derived style summary to OpenRouter, which routes the summary to a model provider. Normal Dark mode processes styles locally.

Conservative store disclosure categories for the current implementation:

| Category | Basis | Purpose |
| --- | --- | --- |
| Authentication information | User-supplied OpenRouter API key, stored locally and sent to OpenRouter in the Authorization header | Authenticate optional, user-initiated theme generation |
| Location | OpenRouter receives the connection IP address during optional generation; the dashboard explicitly includes IP addresses in this category | Deliver and secure the optional API request; no GPS permission or location tracking is used |
| Website content | Aggregated page-style information: color counts, broad font categories and sizes, spacing, element/surface counts, and viewport category | Generate an optional dark color palette |

The dashboard's exact category definitions were checked during submission. Authentication information, Location, and Website content were selected. The style payload does not contain page text, page URLs, CSS selectors, identifiers, form values, screenshots, cookies, or browser storage. This exclusion does not mean all service processing is anonymous: OpenRouter authenticates the request to the user's account and receives connection metadata.

Hostnames, page paths, and selected CSS repair selectors are stored locally to remember site settings and element fixes. This is not a browsing-history collection service; no Chrome history permission is requested. Locally saved API response/error logs retain up to 20 entries and may include provider-supplied metadata. They are not sent to the developer. The request logger does not deliberately log the API key or outgoing snapshot.

No extension analytics, ads, sale of data, credit scoring, or developer-operated data backend is implemented. Website hosting and direct support email are separately disclosed in the privacy policy. Contact matches Copy Tabs: Erik Elyager, elyager@gmail.com.

## Permission justifications

### activeTab

Identify the current webpage when the user opens Nightfall or invokes its keyboard shortcut, so appearance controls apply to that page. Nightfall requests persistent site access separately when the user chooses to allow it.

### scripting

Register and inject Nightfall's bundled content script and CSS into sites the user explicitly permits. These scripts read computed styles and apply or remove the dark appearance, image dimming, and element fixes.

### storage

Save appearance preferences, per-site settings, page-specific element repairs, generated palettes, the user's optional OpenRouter API key, and a bounded set of AI response/error logs in Chrome's local extension storage.

### Optional host access: http://*/* and https://*/*

Allow users to opt in to Nightfall on individual websites. Actual website permissions are requested per scheme and hostname, including matching subdomains. Those permitted origins are registered for styling on later visits. Host access to https://openrouter.ai/* is separately requested only when the user generates an AI theme and is excluded from the site's automatic content-script registrations. No required blanket host permission is included in the packaged manifest.

## Remote code

Nightfall does not load or execute remote JavaScript or WebAssembly. The optional HTTPS API returns theme data, which is parsed as JSON and normalized to validated color and numeric values. All executable extension code is bundled with the extension.

## Retention and user controls

- Preferences, site hostnames, element repair paths/selectors, palettes, and the API key remain in local extension storage until changed or removed.
- Forget key deletes the saved OpenRouter credential.
- Clear in the AI log panel deletes local logs; only the latest 20 entries are retained otherwise.
- Clear in element fixes deletes the current page's saved repairs.
- Removing Nightfall deletes its extension-local data from that Chrome profile.
- Revoking host permissions controls future access but does not itself erase stored preferences.
- OpenRouter and model-provider records are controlled by those services, not by local deletion.

## Zero-data-retention wording

The popup defaults to requiring a zero-data-retention endpoint, expressed as `provider.zdr: true` in the OpenRouter request. Users can turn this option off; omission does not override more restrictive account-level policies. Do not promise that the routing flag prevents all metadata retention or substitutes for reviewing the provider's policies.

Sources checked for service wording:

- [OpenRouter privacy policy](https://openrouter.ai/privacy/)
- [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection)
- [OpenRouter ZDR routing](https://openrouter.ai/docs/guides/features/zdr)
- [Netlify privacy policy](https://www.netlify.com/privacy/)

## Submission consistency

Make the dashboard disclosures, listing text, popup explanation, and public policy match. Preserve the explicit user action before AI transmission. Do not use a broad claim such as “API keys never leave this device” or “no information is ever shared.”
