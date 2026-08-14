# Deploy en Producción — USS Apps

Guía paso a paso para deployar el stack completo en un VPS.

## Requisitos

- VPS con Docker y Docker Compose instalados
- Dominio apuntando al VPS (para HTTPS con Let's Encrypt)
- Acceso SSH al VPS

## 1. Clonar el repo

```bash
git clone <repo-url> /opt/uss-apps
cd /opt/uss-apps
```

## 2. Configurar variables de entorno

```bash
cp .env.production.example .env
nano .env  # completar con valores reales
```

Variables obligatorias:

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Contraseña de Postgres (usar una generada random) |
| `DATABASE_URL` | Debe apuntar a `postgres:5432` (nombre del servicio en compose) |
| `JWT_SECRET` | Secret para firmar JWTs (usar `openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens (usar `openssl rand -hex 32`) |
| `MICROSOFT_TENANT_ID` | Tenant de Azure AD |
| `MICROSOFT_CLIENT_ID` | Client ID de la app registrada en Azure |
| `MICROSOFT_CLIENT_SECRET` | Client secret de Azure |
| `MICROSOFT_REDIRECT_URI` | `https://tudominio.cl/api/v1/auth/microsoft/callback` |
| `AUTH_SUCCESS_REDIRECT` | `https://tudominio.cl/` |
| `VITE_API_URL` | `https://tudominio.cl/api/v1` |

## 3. Configurar dominio en Caddy

Editar `Caddyfile` — reemplazar `:80` con el dominio:

```
tudominio.cl {
    # ... misma config que el Caddyfile actual
}
```

Caddy obtiene certificados TLS automáticamente con Let's Encrypt.

## 4. Buildear las SPAs

```bash
# Desde la raíz del monorepo
VITE_API_URL=https://tudominio.cl/api/v1 ./scripts/build-for-docker.sh
```

Esto genera los `dist/` de las 3 apps (horarios, hub, malla).

## 5. Levantar el stack completo

```bash
docker compose --profile prod up -d --build
```

Esto levanta:
- **Postgres** (`:5435` externo, `:5432` interno)
- **API NestJS** (`:3001` interno, proxy por Caddy)
- **Caddy** (`:80`/`:443`)

## 6. Aplicar migraciones y seed

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

## 7. Verificar

```bash
# Health check
curl http://localhost/api/v1/health

# Ver todos los contenedores
docker compose ps

# Ver logs
docker compose logs -f api
docker compose logs -f caddy
```

## URLs de producción

| Ruta | Servicio |
|------|----------|
| `https://tudominio.cl/` | Hub (portal) |
| `https://tudominio.cl/horarios/` | UniHorario |
| `https://tudominio.cl/malla/` | Malla Curricular |
| `https://tudominio.cl/api/v1/` | API REST |
| `https://tudominio.cl/api/docs` | Swagger UI |

## Comandos útiles

```bash
# Reiniciar todo
docker compose --profile prod down && docker compose --profile prod up -d --build

# Solo reiniciar API (sin rebuild)
docker compose --profile prod restart api

# Ver logs en tiempo real
docker compose --profile prod logs -f

# Entrar al container de la API
docker compose exec api sh

# Acceder a la DB
docker compose exec postgres psql -U postgres -d uss_apps
```

## Actualizaciones

Para actualizar después de un `git pull`:

```bash
# 1. Pull de cambios
git pull

# 2. Rebuildear SPAs si hubo cambios en apps/
VITE_API_URL=https://tudominio.cl/api/v1 ./scripts/build-for-docker.sh

# 3. Rebuild y reiniciar
docker compose --profile prod up -d --build

# 4. Aplicar migraciones si hubo cambios en Prisma schema
docker compose exec api npx prisma migrate deploy
```

## Troubleshooting

### API no conecta a Postgres
Verificar que `DATABASE_URL` usa `postgres` como host (nombre del servicio), no `localhost`.

### Assets no cargan (404)
Verificar que el `base` en `vite.config.ts` de cada app coincida con la ruta en Caddy.

### CORS errors
En producción, restringir `origin` en `main.ts` al dominio real en vez de `origin: true`.

### Puerto 80/443 ocupado
Verificar que no haya otro servicio (Nginx, Apache) usando esos puertos en el VPS.
