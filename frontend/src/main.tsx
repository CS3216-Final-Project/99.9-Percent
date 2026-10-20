import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bundle every family locally so interface and room lettering work offline.
import '@fontsource/pixelify-sans/latin-700.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/source-sans-3/latin-400.css'
import '@fontsource/source-sans-3/latin-500.css'
import '@fontsource/source-sans-3/latin-600.css'
import '@fontsource/source-sans-3/latin-700.css'
import './index.css'
import App from './App.tsx'
import './WarmDesk.css'
import { useGame } from './game/store'
import { startProductAnalyticsUnlessOptedOut } from './lib/analytics'

const stopAnalytics = startProductAnalyticsUnlessOptedOut(useGame)
if (import.meta.hot) import.meta.hot.dispose(stopAnalytics)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
