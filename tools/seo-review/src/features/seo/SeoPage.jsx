// Entry point for the SEO Review tool inside the Admin Hub.
//
// Props:
//   path      the route after /seo: '' (reviews), 'run' (a review in progress), 'audit/<id>',
//             'leads' or 'leads/<id>'
//   navigate  function(subPath) that moves within the tool
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { ToastProvider, useToast } from './ui/Toast.jsx'
import { Home } from './Home.jsx'
import { RunView } from './RunView.jsx'
import { AuditView } from './AuditView.jsx'
import { LeadsList, LeadView } from './Leads.jsx'
import './seo.css'

function Tool({ path, navigate }) {
  const toast = useToast()
  const [list, setList] = useState({ status: 'loading', audits: [], leads: [], meta: null, error: null })
  const [run, setRun] = useState(null) // { input, startedAt, status: 'running' | 'error', error }
  const [draft, setDraft] = useState({ url: '', business: '', city: '', service: '', fresh: false })
  const cache = useRef(new Map())

  const load = useCallback(async () => {
    try {
      const data = await api.listReviews()
      setList({ status: 'ready', audits: data.audits, leads: data.leads || [], meta: data.meta, error: null })
    } catch (e) {
      setList((l) => ({ ...l, status: 'error', error: e.message }))
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const start = async (input) => {
    setRun({ input, startedAt: Date.now(), status: 'running' })
    navigate('run')
    try {
      const out = await api.runReview(input)
      cache.current.set(out.audit.id, out)
      setRun(null)
      load()
      navigate(`audit/${out.audit.id}`)
    } catch (e) {
      setRun({ input, status: 'error', error: e.message })
      load()
    }
  }

  const remove = async (audit) => {
    await api.deleteReview(audit.id)
    cache.current.delete(audit.id)
    setList((l) => ({ ...l, audits: l.audits.filter((a) => a.id !== audit.id) }))
    toast(`Deleted the review of ${audit.business_name}.`)
    navigate('')
  }

  const rerun = (audit) => {
    const input = { url: audit.site_url, business: audit.business_name, city: audit.city, service: audit.service, fresh: false, leadId: audit.lead_id || null }
    setDraft(input)
    start(input)
  }

  const [section, id] = path.split('/')
  if (section === 'run') {
    if (!run) {
      queueMicrotask(() => navigate(''))
      return null
    }
    return (
      <RunView
        run={run}
        meta={list.meta}
        onEdit={() => {
          setDraft({ ...run.input })
          setRun(null)
          navigate('')
        }}
        onRetry={() => start(run.input)}
      />
    )
  }
  if (section === 'audit' && id) {
    return (
      <AuditView
        id={id}
        cache={cache}
        leads={list.leads}
        onBack={() => navigate('')}
        onRerun={rerun}
        onDelete={remove}
        onOpenLead={(leadId) => navigate(`leads/${leadId}`)}
        onLeadsChanged={load}
      />
    )
  }
  if (section === 'leads' && id) {
    return (
      <LeadView
        id={id}
        onBack={() => navigate('leads')}
        onOpenAudit={(auditId) => navigate(`audit/${auditId}`)}
        onChanged={() => {
          cache.current.clear()
          load()
        }}
        onNewReview={(lead) => {
          setDraft({ url: lead.site || '', business: lead.business, city: lead.city || '', service: lead.service || '', fresh: false, leadId: lead.id })
          navigate('')
          setTimeout(() => document.getElementById(lead.city && lead.service ? 'seo-run' : 'seo-city')?.focus(), 80)
        }}
      />
    )
  }
  if (section === 'leads') return <LeadsList onOpen={(leadId) => navigate(`leads/${leadId}`)} onBack={() => navigate('')} />
  return <Home list={list} draft={draft} setDraft={setDraft} onRun={start} onOpen={(a) => navigate(`audit/${a.id}`)} onRetry={load} onLeads={() => navigate('leads')} />
}

export default function SeoPage(props) {
  return (
    <ToastProvider>
      <Tool {...props} />
    </ToastProvider>
  )
}
