import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './i18n'
import { initApiAuth } from './services/apiAuth'

// L'authentification doit être en place avant le premier rendu : plusieurs pages
// déclenchent un fetch dès leur montage.
await initApiAuth()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
