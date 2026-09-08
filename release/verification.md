# Nightfall 1.0.0 — verificación de publicación

El 7 de septiembre de 2026 (America/Hermosillo), Chrome Web Store aceptó el envío y mostró **Pending review**. Se dejó activada la publicación automática tras la aprobación. Esto todavía no equivale a disponibilidad pública.

- ID: `kliplffelmeeciahgamhfdmfnbghobfc`.
- Editor: Erik Elyager; contacto: elyager@gmail.com, verificado en Copy Tabs y en la cuenta de publicación.
- Distribución: gratuita, pública, todas las regiones disponibles.
- Categoría: Accessibility. Idioma: English.
- Se cargaron el ZIP de producción, icono PNG de 128 × 128, captura JPEG de 1280 × 800 y promoción JPEG de 440 × 280.
- La captura del anuncio usa una captura real del popup de la versión final, obtenida en una página local de prueba. La ilustración del sitio web está identificada como tal.
- Declaraciones de datos: Authentication information, Location (IP de conexión al servicio opcional) y Website content (estilos agregados). Sin código remoto ejecutable.

## Comprobaciones realizadas

- TypeScript: `npm run compile`, aprobado.
- Pruebas: `npm test`, 99 aprobadas en 8 archivos.
- Producción: `npm run build` y `npm run zip`, aprobados.
- Chrome 152: 34 comprobaciones existentes de comportamiento y 3 comprobaciones temporales de publicación, todas aprobadas. Una ejecución de captura encontró una carrera de Puppeteer por nodo desconectado; la repetición completa aprobó.
- Popup normal: 344 × 320; sección AI: 344 × 592. Icono cargado, divulgación de OpenRouter y enlaces de privacidad verificados en la interfaz.
- ZIP: 12 archivos de ejecución, sin sitio web, credenciales ni herramientas de desarrollo; `unzip -t` aprobado. SHA-256 guardado junto al archivo.
- Sitio público: páginas de inicio y privacidad revisadas visualmente en escritorio y móvil de 390 px; sin desbordamiento horizontal ni imágenes rotas. Enlace de privacidad y redirección `/privacy-policy.html` → `/privacy/` comprobados. El script promocional de Netlify se desactivó y se verificó que la página no contiene scripts.

## Límites

El ensayo de Chrome concede acceso a la página de prueba de antemano. No verificó el diálogo interactivo de permisos, una generación real contra OpenRouter ni compatibilidad con todos los sitios. La disponibilidad pública depende de la revisión de Google.

Evidencia de Chrome: `output/browser-check/report.json` y capturas en esa carpeta. Evidencia del sitio: `output/website/`. Texto y recursos enviados: `store/`.

## Fuentes de requisitos

- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/publish/
