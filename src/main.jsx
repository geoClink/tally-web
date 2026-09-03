import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply saved theme + bg effect before first render to avoid flash
;(function () {
  const t = localStorage.getItem('tally_theme')
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t)
  if (localStorage.getItem('tally_bg') === 'dynamic') document.documentElement.setAttribute('data-bg', 'dynamic')
})()

// Register service worker for PWA install prompt on Android
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
