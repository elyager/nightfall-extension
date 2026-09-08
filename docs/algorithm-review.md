# Algoritmo de tema oscuro

Revisión del código público de Dark Night Mode y refactorización de Nightfall, 7 de septiembre de 2026.

## Referencia revisada

El [sitio oficial](https://darknightmode.com/) enlaza el [repositorio de Dark Night Mode](https://github.com/DarkNightMode/Dark-Night-Mode-Chrome-Extension). La revisión se basa en ese código público; no demuestra que la versión instalada desde Chrome Web Store sea idéntica.

Su [algoritmo](https://github.com/DarkNightMode/Dark-Night-Mode-Chrome-Extension/blob/master/js/main.js) calcula la suma de los canales RGB y elige un multiplicador por intervalos. Multiplica los canales por el mismo factor, lo que conserva aproximadamente el matiz. No invierte toda la página. Su [CSS global](https://github.com/DarkNightMode/Dark-Night-Mode-Chrome-Extension/blob/master/css/global-new.css) impone colores de texto y bordes.

El código presenta limitaciones: reemplaza la propiedad abreviada `background`, pierde transparencia, no calcula el contraste real del texto y elimina fondos inline al desactivarse. El repositorio publica una [licencia GPL v3](https://github.com/DarkNightMode/Dark-Night-Mode-Chrome-Extension/blob/master/LICENSE). Nightfall implementa de forma independiente el principio de oscurecimiento selectivo; no incorpora código de ese repositorio.

## Implementación de Nightfall

- **Un solo tema Dark.** Las preferencias Slate, Linear y GitHub anteriores migran a `dark`. Se conservan Original, la opción AI existente, los permisos, el brillo de imágenes y las reparaciones guardadas.
- **Luminancia continua.** Los fondos ya oscuros se conservan. Los claros se transforman con una función continua basada en luminancia relativa. Los colores mantienen su matiz, incluido el púrpura; las superficies neutras usan el tema de carbón.
- **Contraste sobre el fondo efectivo.** Las capas transparentes se componen antes de evaluar el texto. Los colores legibles se mantienen; los demás pueden aclararse o oscurecerse. Un botón amarillo puede conservar texto oscuro. El objetivo es 4,5:1 para texto corriente y 3:1 para texto grande. Si la transparencia original hace imposible el objetivo, se conserva esa transparencia y se elige el mejor contraste disponible.
- **Colores CSS modernos.** RGB se interpreta directamente. Los formatos como `oklch()` y `color(display-p3 ...)` se convierten mediante un lienzo privado de un píxel en sRGB y una caché acotada.
- **Lecturas y escrituras separadas.** Cada lote lee estilos originales con Nightfall desactivado sin ceder el hilo al navegador. Después restaura su capa y aplica cambios. Así evita transformar repetidamente colores ya modificados.
- **Restauración reversible.** Las propiedades originales no se sobrescriben. Una hoja de estilo de origen USER permite superar declaraciones inline `!important`; sus reglas solo funcionan mientras el tema está activo.
- **Páginas dinámicas.** Se procesan nodos nuevos, cambios de clase y estilo, contenido oculto, interacciones y hojas de estilo nuevas. El observador se desconecta durante las escrituras propias. Cada generación invalida trabajo pendiente al cambiar de modo o desactivar la extensión.
- **Medios.** Se conservan imágenes de fondo, degradados y filtros de video, canvas y SVG. El brillo opcional de fotografías se compone con el filtro original de cada imagen.

## Límites y verificación

El benchmark ejecuta la extensión compilada en Chrome, con páginas locales controladas y el popup real. Comprueba colores, contraste, transparencia, declaraciones inline importantes, medios, cambios dinámicos, navegación, restauración y selección de una paleta AI previamente guardada. Esa selección no necesita una llamada a OpenRouter.

Los resultados de páginas controladas no garantizan compatibilidad con todos los sitios. No se transforman los píxeles de canvas o video ni el interior de árboles shadow cerrados. Los degradados se preservan, por lo que un degradado claro puede seguir siendo claro. Las pseudo-clases privadas, como `:visited`, y cambios de reglas mediante CSSOM pueden requerir tratamiento adicional. La generación remota de AI y el diálogo interactivo de permisos tienen verificación independiente del benchmark local.

```bash
npm run compile
npm test
npm run benchmark
```
