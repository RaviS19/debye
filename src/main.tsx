import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './theme.css'
import { App } from './App'
import { checkBadges } from './store/store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
checkBadges()

// Offline support once installed. Skipped inside embedded previews, where it is not allowed.
if ('serviceWorker' in navigator && window.top === window.self && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
