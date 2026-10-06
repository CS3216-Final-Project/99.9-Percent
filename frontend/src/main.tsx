import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The full Pixelify face is only for the 99.99% logo; index.css registers a letters-only copy for everything else.
import '@fontsource/pixelify-sans/latin-700.css'
import '@fontsource/rubik/latin-400.css'
import '@fontsource/rubik/latin-500.css'
import '@fontsource/rubik/latin-600.css'
import '@fontsource/rubik/latin-700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
