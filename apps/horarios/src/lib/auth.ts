// Placeholder Neon Auth client wrapper
// Replace imports with the actual API from @neondatabase/neon-js when available in your project.

const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || ''

export function getNeonAuthConfig(){
  return { url: NEON_AUTH_URL }
}

export default {
  getNeonAuthConfig
}
