#!/usr/bin/env node
/**
 * Helper de dev — firma un JWT HS256 de prueba con el JWT_SECRET del .env.
 *
 * Uso: node scripts/sign-jwt.mjs <sub> <email> <role> <name> [mallaId] [--exp N]
 *   sub     UUID o id del usuario (requerido por ParseUUIDPipe en GET /users/:id)
 *   email   ej. alumno1@uss.cl (debe pasar el filtro *.uss.cl)
 *   role    student | admin
 *   name    nombre visible
 *   mallaId opcional (use "-" para null)
 *
 * No imprime el secret: para verificar que leyó bien, comparar la firma
 * contra un token real generado por /auth/refresh.
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, '../services/api/.env');
const [sub, email, role, name, mallaId] = process.argv.slice(2);

if (!sub || !email || !role || !name) {
  console.error(`
Faltan argumentos.

Uso:
  node scripts/sign-jwt.mjs <sub> <email> <role> <name> [mallaId]

Ejemplo:
  node scripts/sign-jwt.mjs 3a3b0a6e-0000-4000-8000-000000000001 alumno1@uss.cl student Alumno 2024
`);
  process.exit(1);
}

const secret = process.env.JWT_SECRET
  ?? /^JWT_SECRET=(.+)$/m.exec(readFileSync(ENV_PATH, 'utf8'))?.[1];

if (!secret) {
  console.error(`No encontre JWT_SECRET en ${ENV_PATH}`);
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const header = b64({ alg: 'HS256', typ: 'JWT' });
const payload = b64({
  sub,
  email,
  role,
  name,
  mallaId: mallaId === '-' || mallaId === undefined ? null : mallaId,
  iat: now,
  exp: now + (Number(process.env.EXP_MINUTES ?? 60) * 60),
});
const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');

process.stdout.write(`${header}.${payload}.${sig}\n`);