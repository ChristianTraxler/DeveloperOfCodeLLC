import { useEffect, useState } from 'react'
import { links } from '../content.js'
import { PREVIEW } from '../site.js'

// Live status pill for the footer. State comes from /api/status, a same-origin proxy in front of
// the Better Stack status page (see api/status.mjs). Until that answers, and if it never does,
// the badge stays neutral: it never claims a health it hasn't confirmed.
const LABELS = {
  operational: 'All systems operational',
  degraded: 'Degraded performance',
  downtime: 'Service disruption',
  maintenance: 'Under maintenance',
  unknown: 'System status',
}

export default function StatusBadge({ className = '' }) {
  const [status, setStatus] = useState({ state: 'unknown', url: links.status })

  useEffect(() => {
    if (PREVIEW) return undefined // the single-file previews have no /api
    const controller = new AbortController()
    fetch('/api/status', { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.state && LABELS[data.state]) setStatus({ state: data.state, url: data.url || links.status })
      })
      .catch(() => {
        /* leave the neutral badge in place */
      })
    return () => controller.abort()
  }, [])

  const text = LABELS[status.state]
  const name = status.state === 'unknown' ? 'System status' : `System status: ${text}`
  return (
    <a
      className={`status-badge ${className}`.trim()}
      data-state={status.state}
      href={status.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name}. Opens the status page.`}
    >
      <span className="status-badge-dot" aria-hidden="true" />
      <span>{text}</span>
    </a>
  )
}
