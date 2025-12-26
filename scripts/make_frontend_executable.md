# Cómo generar un ejecutable / paquete del frontend

Este documento explica opciones para distribuir la app frontend (`frontend/`) creada con Vite.

Opciones principales

1) Servir `dist/` estático (recomendado)

- Construir:
  ```bash
  cd frontend
  pnpm install
  pnpm build
  ```
- Copia `frontend/dist` a tu servidor estático (nginx, caddy, surge, netlify, etc.).
- Ventaja: sencillo, seguro y escalable.

2) Empaquetar con Electron (para generar ejecutables .exe/.dmg/.AppImage)

- Instalación mínima (dev):
  ```bash
  cd frontend
  pnpm add -D electron electron-builder wait-on concurrently
  ```
- Scripts sugeridos (ya añadidos en `package.json`):
  - `pnpm run electron:dev` — arranca Vite dev y lanza Electron en modo desarrollo.
  - `pnpm run electron:build` — genera el build (usando `electron-builder`).
- Concepto:
  - En desarrollo, Electron carga `http://localhost:3000` (Vite dev server).
  - En producción, se sirve el `dist/index.html` empaquetado.
- Notas:
  - `electron-builder` genera instaladores para plataformas soportadas.
  - Requiere ajustar `build` en `package.json` para incluir `appId`, `productName`, y targets.

3) Alternativas nativas (Tauri / Capacitor)

- Tauri produce ejecutables más pequeños y es recomendado si quieres seguridad y binarios ligeros.
- Requiere adaptar el proyecto y añadir dependencias nativas; no está incluido aquí pero puede considerarse para producción.

Consejos de CI/CD

- Usar GitHub Actions para compilar `pnpm build` y almacenar `frontend/dist` como artifact (workflow ya agregado).
- Para Electron, crear job que ejecute `pnpm build` y luego `pnpm run electron:build` en runners adecuados (linux, windows, macos) para generar instaladores.

Seguridad

- No incluyas claves sensibles en el bundle. Usa env vars en el servidor o en runtime (por ejemplo, `VITE_NEON_AUTH_URL`).

Si quieres que implemente la integración completa de Electron + CI (builds para Windows/Mac/Linux y subida de artefactos), lo hago y añado los secrets necesarios en el workflow y ejemplo de `package.json` para `electron-builder`.
