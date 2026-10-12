// Writing an email: new messages, replies and forwards. Saves to Gmail Drafts as you type,
// sends after a short undo window, and never loses what you wrote if sending fails.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Bold, ChevronDown, Italic, Link2, List, Maximize2, Minimize2, Minus, Paperclip, SendHorizontal, Trash2, X } from 'lucide-react'
import { useMail } from '../state/MailContext.jsx'
import { useSettings } from '../state/settings.js'
import { useToast } from '../ui/Toast.jsx'
import { useLockBody } from '../ui/hooks.js'
import { htmlToText, sanitizeFragment } from '../lib/html.js'
import { fileToBase64 } from '../lib/files.js'
import { isEmail } from '../lib/address.js'
import { fileSize, nameOf } from '../lib/format.js'
import { cx } from '../ui/core.jsx'
import { RecipientField } from './RecipientField.jsx'

const MAX_TOTAL = 20 * 1024 * 1024

const TITLES = { new: 'New message', reply: 'Reply', replyAll: 'Reply all', forward: 'Forward', draft: 'Draft' }

function ToolButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-[10px] text-slate transition-colors hover:bg-black/[0.06] hover:text-ink2"
    >
      {children}
    </button>
  )
}

export function Composer({ init, layout = 'dock', onClose, onReopen, contacts = [] }) {
  const { account, actions } = useMail()
  const toast = useToast()
  const [settings] = useSettings()
  const sendAs = account?.sendAs?.length ? account.sendAs : [{ email: account?.email || '', name: '', isDefault: true, signature: '' }]
  const defaultFrom = (sendAs.find((s) => s.isDefault) || sendAs[0])?.email
  const replyish = init.mode === 'reply' || init.mode === 'replyAll'

  const [from, setFrom] = useState(init.fromEmail || defaultFrom)
  const [to, setTo] = useState(init.to || [])
  const [cc, setCc] = useState(init.cc || [])
  const [bcc, setBcc] = useState(init.bcc || [])
  const [showCc, setShowCc] = useState(!!(init.cc?.length || init.bcc?.length))
  const [subject, setSubject] = useState(init.subject || '')
  const [editSubject, setEditSubject] = useState(!replyish)
  const [files, setFiles] = useState(init.attachments || [])
  const [carried, setCarried] = useState(init.forwardAttachments || [])
  const [includeQuote, setIncludeQuote] = useState(!!init.quoteHtml)
  const [showQuote, setShowQuote] = useState(false)
  const [signatureOn, setSignatureOn] = useState(init.signatureOn ?? (settings.signature && init.mode !== 'draft'))
  const [saveState, setSaveState] = useState(init.draftId ? 'saved' : 'idle')
  const [warning, setWarning] = useState(null)
  const [linking, setLinking] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [min, setMin] = useState(false)
  const [big, setBig] = useState(false)

  const editor = useRef(null)
  const fileInput = useRef(null)
  const draftRef = useRef(init.draftId || null)
  const saveTimer = useRef(null)
  const chain = useRef(Promise.resolve())
  const dirty = useRef(false)
  const edited = useRef(false)
  const closed = useRef(false)
  const savedRange = useRef(null)

  const sheet = layout === 'sheet'
  useLockBody(sheet)
  const signature = sanitizeFragment(sendAs.find((s) => s.email === from)?.signature || '')
  const [quoteHtml] = useState(() => sanitizeFragment(init.quoteHtml || ''))

  useLayoutEffect(() => {
    if (editor.current) editor.current.innerHTML = sanitizeFragment(init.html || '')
    const t = setTimeout(() => {
      if (replyish || init.mode === 'draft' || (init.to?.length && !sheet)) {
        editor.current?.focus()
        const sel = window.getSelection()
        if (sel && editor.current) {
          sel.selectAllChildren(editor.current)
          sel.collapseToEnd()
        }
      }
    }, 80)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const bodyHtml = () => editor.current?.innerHTML || ''
  // Replies and forwards arrive with people and a subject filled in. Only what you add makes them worth keeping.
  const prefilled = replyish || init.mode === 'forward'
  const hasContent = () =>
    htmlToText(bodyHtml()).trim() || files.length || (!prefilled && (to.length + cc.length + bcc.length > 0 || subject.trim()))

  const payload = useCallback(() => {
    const body = bodyHtml()
    const sig = signatureOn && signature ? `<br><div class="gmail_signature">${signature}</div>` : ''
    const quote = includeQuote && quoteHtml ? `<br>${quoteHtml}` : ''
    const sa = sendAs.find((s) => s.email === from)
    return {
      to,
      cc,
      bcc,
      subject,
      html: `<div dir="ltr">${body}${sig}</div>${quote}`,
      text: [htmlToText(body), signatureOn && signature ? htmlToText(signature) : '', includeQuote ? init.quoteText || '' : ''].filter(Boolean).join('\n\n'),
      fromEmail: from,
      fromName: sa?.name || '',
      threadId: init.threadId || undefined,
      inReplyTo: init.inReplyTo || undefined,
      references: init.references || undefined,
      attachments: files.filter((f) => f.data).map(({ filename, mimeType, data }) => ({ filename, mimeType, data })),
      forwardAttachments: carried,
      draftId: draftRef.current || undefined,
      // kept so Undo can bring the composer back exactly as it was
      _restore: { ...init, to, cc, bcc, subject, html: body, fromEmail: from, attachments: files, forwardAttachments: carried, draftId: draftRef.current, signatureOn },
    }
  }, [to, cc, bcc, subject, from, files, carried, signatureOn, signature, includeQuote, init, sendAs])

  const saveNow = useCallback(() => {
    chain.current = chain.current.then(async () => {
      if (!hasContent()) return
      const p = payload()
      delete p._restore
      p.draftId = draftRef.current || undefined
      setSaveState('saving')
      try {
        const res = await actions.saveDraft(p)
        draftRef.current = res.draftId
        dirty.current = false
        if (!closed.current) setSaveState('saved')
      } catch {
        if (!closed.current) setSaveState('error')
      }
    })
    return chain.current
  }, [payload, actions]) // eslint-disable-line react-hooks/exhaustive-deps

  const touch = useCallback(() => {
    dirty.current = true
    edited.current = true
    setWarning(null)
    setSaveState((s) => (s === 'saving' ? s : 'idle'))
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNow(), 2600)
  }, [saveNow])

  // Changes to fields schedule a save, like typing in the editor does
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    touch()
  }, [to, cc, bcc, subject, files.length, carried.length, from, signatureOn, includeQuote]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const close = () => {
    if (closed.current) return
    closed.current = true
    clearTimeout(saveTimer.current)
    const content = hasContent()
    if (content && dirty.current) {
      saveNow().then(() => toast('Saved to Drafts'))
    } else if (content && draftRef.current && edited.current) {
      toast('Saved to Drafts')
    } else if (!content && draftRef.current) {
      const id = draftRef.current
      chain.current.then(() => actions.deleteDraft(draftRef.current || id).catch(() => {}))
    }
    onClose()
  }

  const discard = () => {
    closed.current = true
    clearTimeout(saveTimer.current)
    const id = draftRef.current
    chain.current.then(() => {
      const latest = draftRef.current || id
      if (latest) actions.deleteDraft(latest).catch(() => {})
    })
    onClose()
    toast('Draft discarded')
  }

  const send = (force = false) => {
    const all = [...to, ...cc, ...bcc]
    if (!all.length) return setWarning({ kind: 'error', text: 'Add at least one person to send it to.' })
    const bad = all.find((a) => !isEmail(a.email))
    if (bad) return setWarning({ kind: 'error', text: `${bad.email} is not a valid email address.` })
    if (files.some((f) => !f.data)) return setWarning({ kind: 'error', text: 'An attachment is still loading. Try again in a moment.' })
    if (!force) {
      if (!subject.trim()) return setWarning({ kind: 'confirm', text: 'This has no subject. Send it anyway?' })
      const words = `${subject} ${htmlToText(bodyHtml())}`
      if (/\b(attached|attachment|attachments|enclosed)\b/i.test(words) && !files.length && !carried.length) {
        return setWarning({ kind: 'confirm', text: 'You mentioned an attachment, but nothing is attached. Send anyway?' })
      }
    }
    closed.current = true
    clearTimeout(saveTimer.current)
    const p = payload()
    const restore = p._restore
    delete p._restore
    // Wait for any save in flight so the draft is replaced, not left behind
    chain.current.then(() => {
      p.draftId = draftRef.current || undefined
      restore.draftId = draftRef.current
      const who = `${nameOf(all[0])}${all.length > 1 ? ` and ${all.length - 1} more` : ''}`
      actions.send(p, { to: who, reopen: () => onReopen?.(restore) })
    })
    onClose({ sent: true })
  }

  const addFiles = async (list) => {
    let total = files.reduce((n, f) => n + (f.size || 0), 0) + carried.reduce((n, f) => n + (f.size || 0), 0)
    for (const file of Array.from(list || [])) {
      if (total + file.size > MAX_TOTAL) {
        toast(`${file.name} would take attachments past 20 MB. Share it as a link instead.`, { tone: 'warn' })
        continue
      }
      total += file.size
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`
      setFiles((prev) => [...prev, { key, filename: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, data: null }])
      try {
        const data = await fileToBase64(file)
        setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, data } : f)))
      } catch {
        setFiles((prev) => prev.filter((f) => f.key !== key))
        toast(`Couldn't read ${file.name}.`, { tone: 'warn' })
      }
    }
  }

  const exec = (cmd, arg) => {
    editor.current?.focus()
    document.execCommand(cmd, false, arg)
    touch()
  }

  const startLink = () => {
    const sel = window.getSelection()
    savedRange.current = sel && sel.rangeCount && editor.current?.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null
    setLinking('')
  }
  const applyLink = (e) => {
    e.preventDefault()
    let url = (linking || '').trim()
    if (!url) return setLinking(null)
    if (!/^(https?:|mailto:|tel:)/i.test(url)) url = isEmail(url) ? `mailto:${url}` : `https://${url}`
    editor.current?.focus()
    const sel = window.getSelection()
    if (savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    if (sel && !sel.isCollapsed) document.execCommand('createLink', false, url)
    else document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '&quot;')}">${(linking || '').replace(/[<>&"]/g, '')}</a>&nbsp;`)
    setLinking(null)
    touch()
  }

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      send()
    } else if (e.key === 'Escape' && !linking) {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }

  const title = init.mode === 'new' ? 'New message' : replyish ? `${TITLES[init.mode]} to ${to[0] ? nameOf(to[0]).split(' ')[0] : 'everyone'}` : TITLES[init.mode] || 'Message'
  const saveText = saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved to Drafts' : saveState === 'error' ? "Couldn't save the draft" : ''

  const form = (
    <div
      className={cx('flex min-h-0 flex-1 flex-col', dragging && 'ring-2 ring-inset ring-ember/60')}
      onKeyDown={onKeyDown}
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types || [])].includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer?.files?.length) return
        e.preventDefault()
        setDragging(false)
        addFiles(e.dataTransfer.files)
      }}
    >
      <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain ml-paper-scroll', sheet ? 'px-4' : 'px-5')}>
        {sendAs.length > 1 && (
          <div className="flex min-h-[48px] items-center gap-2 border-b border-black/[0.08]">
            <label htmlFor="ml-from" className="w-14 shrink-0 text-[13.5px] text-slate">
              From
            </label>
            <div className="relative min-w-0 flex-1">
              <select id="ml-from" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-full appearance-none truncate bg-transparent pr-8 text-[15px] text-ink2 focus:outline-none">
                {sendAs.map((s) => (
                  <option key={s.email} value={s.email}>
                    {s.name ? `${s.name} <${s.email}>` : s.email}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate" />
            </div>
          </div>
        )}
        <RecipientField
          label="To"
          value={to}
          onChange={setTo}
          contacts={contacts}
          autoFocus={!replyish && init.mode !== 'draft' && !init.to?.length}
          after={
            !showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="h-8 rounded-full px-2.5 text-[13px] font-semibold text-slate hover:bg-black/[0.05] hover:text-ink2">
                Cc Bcc
              </button>
            )
          }
        />
        {showCc && (
          <>
            <RecipientField label="Cc" value={cc} onChange={setCc} contacts={contacts} />
            <RecipientField label="Bcc" value={bcc} onChange={setBcc} contacts={contacts} />
          </>
        )}
        {editSubject ? (
          <div className="flex min-h-[48px] items-center gap-2 border-b border-black/[0.08]">
            <label htmlFor="ml-subject" className="w-14 shrink-0 text-[13.5px] text-slate">
              Subject
            </label>
            <input id="ml-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-ink2 placeholder:text-slate/60 focus:outline-none" placeholder="What it's about" />
          </div>
        ) : (
          <div className="flex min-h-[44px] items-center gap-2 border-b border-black/[0.08] text-[13.5px]">
            <span className="w-14 shrink-0 text-slate">Subject</span>
            <span className="min-w-0 flex-1 truncate text-ink2/80">{subject}</span>
            <button type="button" onClick={() => setEditSubject(true)} className="h-8 shrink-0 rounded-full px-2.5 font-semibold text-slate hover:bg-black/[0.05] hover:text-ink2">
              Edit
            </button>
          </div>
        )}

        <div
          ref={editor}
          role="textbox"
          aria-multiline="true"
          aria-label="Message"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={replyish ? 'Write your reply' : 'Write your message'}
          onInput={touch}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text/plain')
            if (e.clipboardData.files?.length && !text) {
              e.preventDefault()
              addFiles(e.clipboardData.files)
              return
            }
            e.preventDefault()
            document.execCommand('insertText', false, text)
          }}
          className={cx('ml-editor py-4', sheet ? 'min-h-[38vh]' : 'min-h-[150px]')}
        />

        {signatureOn && signature && (
          <div className="ml-signature mb-3 border-l-2 border-black/[0.08] pl-3" dangerouslySetInnerHTML={{ __html: signature }} />
        )}

        {init.quoteHtml && (
          <div className="mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQuote((v) => !v)}
                aria-expanded={showQuote}
                className={cx('h-7 rounded-full border px-3 text-[12.5px] font-semibold transition-colors', includeQuote ? 'border-black/10 bg-[#f4f2ed] text-slate hover:text-ink2' : 'border-dashed border-black/15 text-slate/70 line-through')}
              >
                {init.mode === 'forward' ? 'Forwarded message' : 'Earlier messages'} {showQuote ? 'shown' : 'included'}
              </button>
              <button type="button" onClick={() => setIncludeQuote((v) => !v)} className="h-7 rounded-full px-2.5 text-[12.5px] font-semibold text-slate hover:bg-black/[0.05] hover:text-ink2">
                {includeQuote ? 'Leave it out' : 'Include it'}
              </button>
            </div>
            {showQuote && includeQuote && <div className="ml-quote-preview mt-3 max-h-64 overflow-auto rounded-[12px] border border-black/[0.07] p-3" dangerouslySetInnerHTML={{ __html: quoteHtml }} />}
          </div>
        )}

        {(files.length > 0 || carried.length > 0) && (
          <ul className="mb-4 flex flex-wrap gap-2">
            {[...carried.map((c) => ({ ...c, key: `${c.messageId}${c.attachmentId}`, carried: true, data: true })), ...files].map((f) => (
              <li key={f.key} className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-black/10 bg-[#f6f4ef] pl-3 pr-1 text-[13px] text-ink2">
                <Paperclip size={14} className="shrink-0 text-slate" />
                <span className="truncate font-medium">{f.filename}</span>
                <span className="shrink-0 text-slate">{f.data ? fileSize(f.size) : 'Reading'}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.filename}`}
                  onClick={() => (f.carried ? setCarried((prev) => prev.filter((x) => `${x.messageId}${x.attachmentId}` !== f.key)) : setFiles((prev) => prev.filter((x) => x.key !== f.key)))}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate hover:bg-black/10 hover:text-ink2"
                >
                  <X size={13} strokeWidth={2.6} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {warning && (
        <div className={cx('mx-4 mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] px-3.5 py-2.5 text-[13.5px]', warning.kind === 'error' ? 'bg-[#fde8e4] text-[#8f2116]' : 'bg-[#fff1e6] text-[#7a3510]')} role="alert">
          <span className="min-w-0 flex-1">{warning.text}</span>
          {warning.kind === 'confirm' && (
            <span className="flex gap-1">
              <button type="button" onClick={() => send(true)} className="h-8 rounded-full bg-ink2 px-3.5 text-[13px] font-semibold text-white">
                Send anyway
              </button>
              <button type="button" onClick={() => setWarning(null)} className="h-8 rounded-full px-3 text-[13px] font-semibold hover:bg-black/[0.06]">
                Go back
              </button>
            </span>
          )}
        </div>
      )}

      {linking != null && (
        <form onSubmit={applyLink} className="mx-4 mb-2 flex items-center gap-2 rounded-[12px] border border-black/10 bg-[#f6f4ef] p-1.5">
          <label htmlFor="ml-link" className="sr-only">
            Link address
          </label>
          <input id="ml-link" autoFocus value={linking} onChange={(e) => setLinking(e.target.value)} placeholder="Paste a link, like developerofcode.com" className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[14px] text-ink2 placeholder:text-slate/60 focus:outline-none" />
          <button type="submit" className="h-9 rounded-full bg-ink2 px-3.5 text-[13px] font-semibold text-white">
            Add link
          </button>
          <button type="button" aria-label="Cancel" onClick={() => setLinking(null)} className="grid h-9 w-9 place-items-center rounded-full text-slate hover:bg-black/[0.06]">
            <X size={15} />
          </button>
        </form>
      )}

      <div className={cx('flex shrink-0 items-center gap-1 border-t border-black/[0.08] px-3 py-2.5', sheet && 'pb-[calc(env(safe-area-inset-bottom,0px)+10px)]')}>
        {!sheet && (
          <button type="button" onClick={() => send()} className="mr-2 inline-flex h-10 items-center gap-2 rounded-full bg-ember pl-4 pr-3.5 text-[14.5px] font-semibold text-[#1c0a02] transition-colors hover:bg-[#ff6f3a]" title="Send (Ctrl or Cmd + Enter)">
            Send <SendHorizontal size={16} strokeWidth={2.4} />
          </button>
        )}
        <ToolButton label="Bold" onClick={() => exec('bold')}>
          <Bold size={16} />
        </ToolButton>
        <ToolButton label="Italic" onClick={() => exec('italic')}>
          <Italic size={16} />
        </ToolButton>
        <ToolButton label="Add a link" onClick={startLink}>
          <Link2 size={16} />
        </ToolButton>
        <ToolButton label="Bulleted list" onClick={() => exec('insertUnorderedList')}>
          <List size={16} />
        </ToolButton>
        <ToolButton label="Attach files" onClick={() => fileInput.current?.click()}>
          <Paperclip size={16} />
        </ToolButton>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {signature && (
          <button type="button" onClick={() => setSignatureOn((v) => !v)} aria-pressed={signatureOn} className={cx('ml-1 hidden h-8 rounded-full px-2.5 text-[12.5px] font-semibold sm:inline-flex sm:items-center', signatureOn ? 'text-ink2' : 'text-slate/70 line-through')}>
            Signature
          </button>
        )}
        <span className="ml-auto mr-1 hidden truncate text-[12px] text-slate sm:block" aria-live="polite">
          {saveText}
        </span>
        <ToolButton label="Discard draft" onClick={discard}>
          <Trash2 size={16} />
        </ToolButton>
      </div>
    </div>
  )

  if (layout === 'inline') {
    return (
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ml-paper flex flex-col overflow-hidden rounded-[18px]" aria-label={title}>
        <div className="flex items-center gap-2 border-b border-black/[0.08] px-5 py-3">
          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink2">{title}</p>
          <button type="button" onClick={close} aria-label="Close and keep the draft" className="grid h-8 w-8 place-items-center rounded-full text-slate hover:bg-black/[0.06] hover:text-ink2">
            <X size={17} />
          </button>
        </div>
        {form}
      </motion.section>
    )
  }

  if (sheet) {
    return createPortal(
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.36, ease: [0.2, 0.7, 0.2, 1] }}
        className="fixed inset-0 z-[85] flex flex-col bg-white"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center gap-2 border-b border-black/[0.08] px-2 py-2">
          <button type="button" onClick={close} aria-label="Close and keep the draft" className="grid h-11 w-11 place-items-center rounded-full text-slate hover:bg-black/[0.06]">
            <X size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-ink2">{title}</p>
            {saveText && <p className="truncate text-[12px] text-slate">{saveText}</p>}
          </div>
          <button type="button" onClick={() => send()} className="mr-1 inline-flex h-10 items-center gap-2 rounded-full bg-ember px-4 text-[15px] font-semibold text-[#1c0a02]">
            Send <SendHorizontal size={16} strokeWidth={2.4} />
          </button>
        </div>
        {form}
      </motion.div>,
      document.body,
    )
  }

  // Desktop dock: bottom right, can shrink to a bar or grow larger
  return createPortal(
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
      aria-label={title}
      className={cx(
        'fixed z-[75] flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)]',
        big ? 'inset-x-[8vw] bottom-[6vh] top-[8vh]' : 'bottom-4 right-4 w-[min(580px,calc(100vw-32px))]',
        !big && (min ? 'h-[52px]' : 'h-[min(640px,calc(100vh-110px))]'),
      )}
    >
      <div className="flex h-[52px] shrink-0 items-center gap-1 bg-ink2 pl-5 pr-2 text-white">
        <button type="button" onClick={() => setMin((v) => !v)} className="min-w-0 flex-1 truncate text-left text-[14.5px] font-semibold">
          {subject && init.mode === 'new' ? subject : title}
        </button>
        <button type="button" onClick={() => setMin((v) => !v)} aria-label={min ? 'Open' : 'Minimize'} className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
          <Minus size={17} />
        </button>
        <button
          type="button"
          onClick={() => {
            setBig((v) => !v)
            setMin(false)
          }}
          aria-label={big ? 'Make smaller' : 'Make larger'}
          className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          {big ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button type="button" onClick={close} aria-label="Close and keep the draft" className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
          <X size={17} />
        </button>
      </div>
      {!min && form}
    </motion.section>,
    document.body,
  )
}
