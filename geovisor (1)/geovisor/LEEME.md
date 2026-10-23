# Geovisor de la red hídrica de Armenia, Quindío

## Cómo abrirlo en Visual Studio Code
1. Abra la carpeta `geovisor` en VS Code (Archivo > Abrir carpeta).
2. Instale la extensión **Live Server** (Ritwick Dey).
3. Clic derecho sobre `index.html` > **Open with Live Server**.

También funciona con doble clic en `index.html`. Los mapas base (Esri) necesitan internet y no requieren clave.

## Estructura
- `index.html`: estructura de la página y panel.
- `css/estilo.css`: estilos.
- `js/app.js`: capas, leyenda, gráficos y lógica. El objeto `layers` es donde se agregan capas nuevas.
- `data/*.js`: GeoJSON en WGS84 (EPSG:4326) dentro de variables globales.
- `lib/`: Leaflet 1.9.4 local.
