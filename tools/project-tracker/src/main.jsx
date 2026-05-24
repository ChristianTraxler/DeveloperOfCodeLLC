import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import AuthGate from './components/AuthGate.jsx'
import './index.css'

// In the iOS standalone PWA, a plain <a> navigation pops an in-app Safari sheet
// (the one with Done/X + share). Route same-origin links (e.g. the "Hub" link)
// through location.href instead so they stay in the app. React Router calls
// preventDefault first, so its client-side links are skipped via defaultPrevented.
;(function keepInStandalone() {
  const standalone =
    window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  if (!standalone) return
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return
    const a = e.target.closest && e.target.closest('a[href]')
    if (!a || a.target === '_blank') return
    const href = a.getAttribute('href')
    if (!href || href.charAt(0) === '#') return
    if (a.protocol !== 'http:' && a.protocol !== 'https:') return
    if (a.origin !== window.location.origin) return
    e.preventDefault()
    window.location.href = a.href
  })
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/admin/tracker">
      <AuthGate>
        <App />
      </AuthGate>
    </BrowserRouter>
  </React.StrictMode>,
)
