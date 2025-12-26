// Placeholder Neon Auth client wrapper
// Replace imports with the actual API from `@neondatabase/neon-js` when available.

import React from 'react'

const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL || ''

export function getNeonAuthConfig(){
  return { url: NEON_AUTH_URL }
}

// NeonAuthProvider: placeholder component. Replace with actual
// <NeonAuthUIProvider config={...}> when the SDK is installed.
export const NeonAuthProvider: React.FC<{children?: React.ReactNode}> = ({children}) => {
  // TODO: switch to real provider when `@neondatabase/neon-js` is installed
  return <>{children}</>
}

export default {
  getNeonAuthConfig,
  NeonAuthProvider
}
