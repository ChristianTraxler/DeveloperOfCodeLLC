// The fix-it report: every open fix as Markdown instructions for Claude, with the evidence the
// review found, what to change, and how to tell it worked. Copy it into a Claude Code session
// opened on the client's site, or download it as a .md file next to their code.
import { useState } from 'react'
import { Check, Copy, Download, FileText } from 'lucide-react'
import { api } from './api.js'
import { Button } from './ui/core.jsx'
import { Sheet } from './ui/Sheet.jsx'

export function FixReport({ audit, openTasks, toast }) {
  const [report, setReport] = useState(null) // { markdown, filename, forTasks }
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [preview, setPreview] = useState(false)

  // Fetch again when ticks change, so done tasks drop out of the report.
  const load = async () => {
    if (report && report.forTasks === openTasks) return report
    setBusy(true)
    try {
      const out = { ...(await api.getFixReport(audit.id)), forTasks: openTasks }
      setReport(out)
      return out
    } catch (e) {
      toast(e.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    const r = await load()
    if (!r) return
    try {
      await navigator.clipboard.writeText(r.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      toast('Copied. Paste it into Claude Code opened on the client site.')
    } catch {
      setPreview(true)
    }
  }
  const download = async () => {
    const r = await load()
    if (!r) return
    const url = URL.createObjectURL(new Blob([r.markdown], { type: 'text/markdown' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: r.filename })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const open = async () => {
    if (await load()) setPreview(true)
  }

  if (audit.status !== 'complete') return null
  return (
    <section aria-labelledby="seo-fix" className="mt-4 flex flex-col gap-4 rounded-[22px] border border-line bg-panel/60 p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="min-w-0 flex-1">
        <h2 id="seo-fix" className="flex items-center gap-2 text-[15.5px] font-semibold">
          <FileText size={16} className="text-ember" /> Fix-it report for Claude
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-mute">
          {openTasks
            ? `${openTasks} open ${openTasks === 1 ? 'fix' : 'fixes'} as step-by-step instructions: what the review found, what to change in the code, and how to check it worked.`
            : 'No open fixes. The report still lists what is working and what was not checked.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ember" onClick={copy} disabled={busy}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {busy ? 'Writing' : copied ? 'Copied' : 'Copy for Claude'}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Download the fix-it report as a Markdown file" onClick={download} disabled={busy}>
          <Download size={15} />
        </Button>
        <Button variant="quiet" onClick={open} disabled={busy}>
          Preview
        </Button>
      </div>
      <Sheet open={preview} onClose={() => setPreview(false)} title="Fix-it report" kicker={audit.business_name} width={720}>
        <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-bone/90" tabIndex={0} data-autofocus>
          {report?.markdown}
        </pre>
      </Sheet>
    </section>
  )
}
