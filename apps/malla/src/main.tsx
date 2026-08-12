import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { consumeAccessTokenFromHash } from './lib/token'
import './styles.css'

// Must run before HashRouter's first render reads window.location.hash.
const initialAccessToken = consumeAccessTokenFromHash()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialAccessToken={initialAccessToken} />
  </StrictMode>,
)
