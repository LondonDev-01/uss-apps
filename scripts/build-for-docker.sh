# Build de las SPAs para Docker
# Ejecutar desde la raíz del monorepo: ./scripts/build-for-docker.sh

#!/bin/bash
set -euo pipefail

API_URL="${VITE_API_URL:-http://localhost/api/v1}"

echo "Building SPAs with VITE_API_URL=$API_URL"

pnpm --filter horarios run build
pnpm --filter hub run build
pnpm --filter malla run build

echo "Done. dist/ folders ready for Docker."
