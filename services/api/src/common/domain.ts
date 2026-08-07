// Validación de dominio institucional del ecosistema (PLAN_V3 §4.3)
// Cubre @uss.cl, @alu.uss.cl, etc.
export const USS_DOMAIN_REGEX = /^[^@]+@([a-z0-9-]+\.)*uss\.cl$/i;