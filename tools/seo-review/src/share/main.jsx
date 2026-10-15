// Entry for the client report at /seo/<share_token>. Separate from the admin app: no sign in,
// no shared Supabase client, light Developer of Code look.
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ShareReport } from '../features/seo/share/ShareReport.jsx'
import './share.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShareReport />
  </React.StrictMode>,
)
