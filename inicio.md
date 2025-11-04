# Chequeo rápido de GitHub

## Objetivo
Validar conexión API y estado base del repositorio antes de iniciar tareas mayores.

## Pasos
0. Confirmar conexión activa y autorización con GitHub (API disponible, permisos correctos). y aplicar `siteops-auth.md` (permisos correctos).
1. Listar últimos 5 commits en la rama `main`.
2. Verificar si hay PRs o issues abiertos.
3. Listar las últimas 3 ejecuciones de workflows:
   - `fetch.yml`
   - cualquier otro workflow general
4. Verificar existencia de archivos críticos en la raíz:
   - `index.html`, `README.md` u otro fallback visible.
5. Reportar cualquier error de conexión o permisos.

## Resultado esperado
- Confirmación de conexión y permisos válidos.
- Estado limpio o advertencias claras (PRs/issues).
- Archivos raíz accesibles para validar estructura del sitio.
