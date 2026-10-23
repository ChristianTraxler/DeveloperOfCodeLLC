import React from 'react'
import { createRoot } from 'react-dom/client'
import Header from '../pricing/components/Header.jsx'
import SiteFooter from '../components/Footer.jsx'
import VideoServicePage from './pages/VideoServicePage.jsx'
import './index.css'
import '../pricing/footer.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-snow focus:px-4 focus:py-2 focus:text-dusk">
      Skip to content
    </a>
    <div className="text-snow">
      <Header current="video" />
    </div>
    <main id="main">
      <VideoServicePage />
    </main>
    <div className="live-footer">
      <SiteFooter current="video" />
    </div>
  </React.StrictMode>,
)
