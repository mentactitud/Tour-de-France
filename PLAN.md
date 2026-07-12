# Plan: App de seguimiento y control de caza — Coto Borges Blanques

## 1. Qué hay hoy (análisis del Excel actual)

El Excel `Temporada_Caza_Borges_blanques.xlsx` tiene 8 hojas, una por período y temporada:

- **Media Veda** (23, 24, 25): Conejo, Torcaz, Zurita, Codorniz
- **Veda General** (23-24, 24-25, 25-26): Conejo, Perdiz, Torcaz, Zorzal, Liebre, Perdiz suelta, Becada, Pato, Griva, Faisán, Zurita
- **Descaste** (23, 24): solo Conejos

Estructura: una fila por jornada (fecha) y una columna por especie, con fila de totales.

### Problemas detectados que la app debe resolver

- **Fechas corruptas por tecleo manual**: `23/8/0205`, `08/11/56`, `24/8/0204`, un `2022-06-25` en la hoja de 2023, y jornadas sin fecha. Una app con selector de fecha elimina esto de raíz.
- **Sin datos de contexto**: no hay horas de jornada, km andados, meteo, zona del coto, ni compañeros/perros. Todo eso se pierde.
- **Comparativas manuales**: hay que abrir varias hojas y comparar a ojo. Ejemplo de lo que ya se ve en los datos: el zorzal domina (362 → 303 → 270 por temporada general, tendencia a la baja), el conejo se mueve entre 31-49/temporada, y la perdiz suelta entre 35-51.
- **Fotos dispersas**: sin vínculo entre fotos y jornadas.

## 2. Recomendación: PWA (aplicación web instalable) + Google Drive/Sheets como almacenamiento

Una **PWA** (Progressive Web App) es la mejor opción para este caso:

- Se instala en el móvil como una app normal (icono, pantalla completa), sin pasar por app stores.
- **Funciona sin cobertura** (crítico en el campo): los datos se guardan localmente y se sincronizan al volver a tener red.
- Acceso a **GPS** (km andados, track de la jornada) y **cámara** (fotos).
- Hosting gratuito (GitHub Pages / Vercel) — sin servidor ni cuotas.
- **Google Drive como backend**: los datos viven en TU Drive, con una hoja de cálculo que puedes seguir abriendo como siempre, y las fotos en carpetas organizadas. Sin base de datos que mantener ni pagar.

### Arquitectura

```
Móvil (PWA)
 ├── IndexedDB local (funciona offline en el campo)
 └── Sincronización al llegar a casa / tener cobertura
      ├── Google Sheets  → datos de jornadas y capturas
      └── Google Drive   → fotos: /Caza/2025-26/2026-01-10/*.jpg
                         → tracks GPX de cada jornada
```

## 3. Modelo de datos

**Jornada** (una salida al campo):
- Fecha, período (Media Veda / Veda General / Descaste), temporada
- Hora inicio / fin (autocalculadas si usas el track GPS)
- Km andados (del GPS o manual)
- Meteo (opcional: sol/nubes/lluvia/viento, temperatura)
- Zona del coto (si el KML tiene zonas con nombre)
- Notas, compañeros, perros
- Fotos (enlaces a Drive)
- Track GPS (GPX en Drive)

**Captura** (dentro de una jornada):
- Especie (catálogo cerrado: las 12 que ya usas)
- Cantidad
- Opcional: hora y posición GPS de cada lance → mapa de calor del coto

## 4. Simplificar la carga de datos — lo más importante

1. **Botones grandes +1 por especie**: durante la jornada, un toque por pieza. La app registra hora y posición automáticamente. Pantalla pensada para usarse con guantes y sol.
2. **Especies según período**: si es Media Veda solo muestra Conejo/Torcaz/Zurita/Codorniz; en Descaste solo Conejo. Menos ruido, menos errores.
3. **Modo "fin de jornada"**: si no quieres tocar el móvil cazando, al acabar rellenas todo en 30 segundos: fecha de hoy ya puesta, contadores por especie, km del GPS ya calculados.
4. **Botón "Empezar jornada" / "Terminar jornada"**: arranca el track GPS y el reloj; al terminar, la jornada queda creada con duración y km sin teclear nada.
5. **Entrada por voz** (fase 2): "tres conejos y un zorzal" → registrado.
6. **Importación del histórico**: script que lee el Excel actual, corrige las fechas corruptas detectadas y carga las 3+ temporadas en el nuevo sistema para tener comparativas desde el día 1.

## 5. Mapa del coto (KML)

- El KML adjunto es solo un **enlace de red** a Google My Maps privado; no contiene la geometría. Para usarlo: en My Maps → ⋮ → *Exportar a KML/KMZ* → **desmarcar** "Mantener actualizados los datos" → se descarga el KML real con los polígonos.
- Con el KML real, la app puede:
  - Mostrar el **límite del coto** sobre el mapa con tu posición en directo (saber si estás dentro).
  - Dibujar el **track de cada jornada** sobre el coto.
  - **Mapa de calor de capturas** por especie: dónde caen los conejos, dónde los zorzales, por temporada.
  - Estadística de **zonas más productivas** (capturas/km por zona).

## 6. Estadísticas y comparativas

- Comparativa entre temporadas por especie (lo que ahora haces a ojo entre hojas).
- Acumulado de temporada vs. misma fecha de la temporada anterior ("a estas alturas del año pasado llevaba X zorzales").
- Piezas por jornada, piezas por km andado, piezas por hora.
- Evolución dentro de la temporada (¿el zorzal entra más en enero?).
- Total km y horas por temporada.
- Ficha por especie: histórico completo, mejores jornadas, mejores zonas.

## 7. Fotos en Drive

- Desde la app: botón cámara durante la jornada → la foto sube a `Drive/Caza/<temporada>/<fecha>/` y queda vinculada a la jornada.
- Galería dentro de la app: ver las fotos de cada jornada junto a sus datos.
- Si haces las fotos con la cámara del móvil fuera de la app: pantalla de "adjuntar fotos" al cerrar la jornada que las sube a la carpeta correcta.

## 8. Fases de desarrollo

**Fase 1 — MVP (lo que da valor inmediato)**
- PWA instalable con registro de jornadas y capturas (botones +1, offline).
- Importador del Excel histórico con corrección de fechas.
- Estadísticas y comparativas entre temporadas.
- Sincronización con Google Sheets en tu Drive.

**Fase 2 — Campo**
- Track GPS: km, duración, ruta sobre el mapa del coto (KML real).
- Fotos con subida automática a Drive organizadas por jornada.

**Fase 3 — Análisis fino**
- Mapa de calor de capturas por especie y zona.
- Geoposición por lance, meteo automática (API), entrada por voz.

## 9. Stack técnico propuesto

- **Frontend**: React + Vite, PWA (service worker, instalable).
- **Almacenamiento local**: IndexedDB (Dexie.js) para uso offline.
- **Nube**: Google Identity + Drive API + Sheets API (OAuth, los datos son tuyos).
- **Mapa**: Leaflet + capa KML del coto + tiles de IGN/OSM.
- **Gráficas**: Recharts.
- **Hosting**: GitHub Pages desde este repositorio (gratis, con HTTPS que exige la PWA).
