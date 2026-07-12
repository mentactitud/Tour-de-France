# Caza · Borges Blanques

Aplicación web (PWA) para el seguimiento y control de jornadas de caza en el
coto de Borges Blanques. Se instala en el móvil, funciona **sin cobertura** y
guarda los datos en el propio dispositivo.

Incluye de serie el **histórico completo** de las temporadas 2023 → 2025-26
importado del Excel original, con las fechas erróneas ya corregidas.

## Qué hace (Fase 1)

- **Registro rápido de jornadas**: botones +1 por especie, solo las especies
  del período activo (Descaste / Media Veda / Veda General, sugerido según la
  fecha), km andados y notas.
- **Historial**: jornadas agrupadas por temporada y período, editables.
- **Estadísticas**: comparativa entre temporadas por especie, acumulado de
  temporada (con "vs temporada anterior a igual fecha"), piezas por jornada,
  mejor jornada y km.
- **Copia de seguridad**: exportación a JSON (reimportable) y CSV (Excel).

## Cómo publicarla (una sola vez)

1. En GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Haz push a `main` (o lanza el workflow "Desplegar en GitHub Pages" a mano).
3. La app queda en `https://<usuario>.github.io/Tour-de-France/`.
4. Ábrela en el móvil con Chrome y elige **"Añadir a pantalla de inicio"**.

## Conectar un reloj GPS (Zepp/Amazfit, Garmin, Wikiloc…)

Graba la salida en el reloj como actividad (senderismo/caminata). Después, en la
app del reloj, exporta esa actividad como **GPX** — en Zepp: entrenamiento →
**⋯ → Exportar datos → GPX** — y en la jornada usa **«Importar GPX»**: la fecha,
los km, la duración y la ruta se rellenan solos. Vale cualquier reloj o app que
exporte GPX.

## Desarrollo

```bash
npm install
npm run dev      # desarrollo
npm run build    # produce dist/
```

## Estructura

- `src/data/historico.json` — histórico limpio importado del Excel.
- `src/data/especies.js` — catálogo de especies, períodos y temporadas.
- `src/db.js` — base de datos local (IndexedDB vía Dexie).
- `src/views/` — Registro, Historial, Estadísticas, Ajustes.
- `src/components/charts.jsx` — gráficas SVG propias (acumulado y barras).
- `PLAN.md` — plan completo del proyecto y fases siguientes.

## Próximas fases (ver PLAN.md)

- **Fase 2**: track GPS (km y ruta automáticos), mapa del coto (KML), fotos de
  jornada subidas a Google Drive.
- **Fase 3**: mapa de calor de capturas por zona, meteo automática, voz.
