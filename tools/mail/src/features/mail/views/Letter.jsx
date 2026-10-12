// One message in a conversation, set on paper. Older messages fold down to a strip.
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Download, FileArchive, FileImage, FileSpreadsheet, FileText, File, Forward, MailX, Reply, ReplyAll, Mail } from 'lucide-react'
import { useMail } from '../state/MailContext.jsx'
import { ago, fileSize, fullStamp, nameOf } from '../lib/format.js'
import { formatAddress } from '../lib/address.js'
import { kindOf, extOf } from '../lib/files.js'
import { hasOthers } from '../lib/compose.js'
import { Monogram, cx } from '../ui/core.jsx'
import { Menu } from '../ui/Menu.jsx'
import { useNow } from '../ui/hooks.js'
import { MessageBody } from './MessageBody.jsx'

const FILE_ICONS = { pdf: FileText, sheet: FileSpreadsheet, doc: FileText, archive: FileArchive, image: FileImage, file: File }

function recipientsLine(message, self) {
  const mine = (a) => self.some((e) => e.toLowerCase() === a.email.toLowerCase())
  const list = [...(message.to || []), ...(message.cc || [])]
  if (!list.length) return 'to no one yet'
  const names = list.map((a) => (mine(a) ? 'me' : nameOf(a).split(' ')[0]))
  const shown = names.slice(0, 3).join(', ')
  return `to ${shown}${names.length > 3 ? ` and ${names.length - 3} more` : ''}`
}

function Thumb({ message, att, onOpen }) {
  const { actions } = useMail()
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const image = kindOf(att.mimeType, att.filename) === 'image'
  useEffect(() => {
    if (!image || att.size > 8_000_000) return
    let live = true
    actions
      .attachmentUrl(message.id, att)
      .then((u) => live && setUrl(u))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [message.id, att, image, actions])
  const Icon = FILE_ICONS[kindOf(att.mimeType, att.filename)] || File
  return (
    <button
      type="button"
      onClick={() => onOpen(att, url)}
      className="group flex w-full min-w-0 flex-col overflow-hidden rounded-[12px] border border-black/10 bg-[#faf9f6] text-left transition-colors hover:border-black/25"
      aria-label={`${image ? 'View' : 'Download'} ${att.filename}, ${fileSize(att.size)}`}
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-[#efece6]">
        {image && url ? (
          <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <span className="grid h-full w-full place-items-center text-slate/70">
            {image && !failed ? <span className="h-6 w-6 animate-pulse rounded-full bg-black/10" /> : <Icon size={28} strokeWidth={1.6} />}
          </span>
        )}
        {!image && <span className="absolute left-2 top-2 rounded-[6px] bg-ink2 px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.04em] text-white">{extOf(att.filename)}</span>}
      </span>
      <span className="flex items-center gap-2 px-2.5 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-ink2">{att.filename}</span>
          <span className="block text-[11.5px] text-slate">{fileSize(att.size)}</span>
        </span>
        {!image && <Download size={15} className="shrink-0 text-slate" />}
      </span>
    </button>
  )
}

function Details({ message }) {
  const row = (label, value) =>
    value ? (
      <>
        <dt className="text-slate">{label}</dt>
        <dd className="min-w-0 break-words text-ink2">{value}</dd>
      </>
    ) : null
  const list = (items) => (items?.length ? items.map(formatAddress).join(', ') : '')
  return (
    <dl className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-[12px] bg-[#f6f4ef] px-3.5 py-3 text-[12.5px] leading-snug">
      {row('From', formatAddress(message.from))}
      {row('Reply to', list(message.replyTo))}
      {row('To', list(message.to))}
      {row('Cc', list(message.cc))}
      {row('Bcc', list(message.bcc))}
      {row('Date', fullStamp(message.date))}
      {row('Subject', message.subject)}
    </dl>
  )
}

export function FoldedLetter({ message, onOpen, self }) {
  const now = useNow(60_000)
  return (
    <button type="button" onClick={onOpen} className="ml-fold flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-transform duration-200 hover:-translate-y-px">
      <Monogram address={message.from} me={message.fromMe} size={30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={cx('truncate text-[14px]', message.unread ? 'font-bold text-ink2' : 'font-semibold text-ink2/85')}>{message.fromMe ? 'You' : nameOf(message.from)}</span>
          {message.draft && <span className="text-[12px] font-semibold text-[#c4410c]">Draft</span>}
        </span>
        <span className="block truncate text-[13px] text-slate">{message.snippet || recipientsLine(message, self)}</span>
      </span>
      <span className="shrink-0 text-[12px] tabular-nums text-slate">{ago(message.date, now).replace(' ago', '')}</span>
    </button>
  )
}

export function Letter({ message, thread, self, last, onReply, onOpenAttachment, onMailto, onMarkUnread, onCollapse }) {
  const { api, actions } = useMail()
  const now = useNow(30_000)
  const [details, setDetails] = useState(false)
  const files = (message.attachments || []).filter((a) => !a.inline)
  const others = hasOthers(message, self)
  const unsubscribe = (message.unsubscribe || '').match(/<(https:[^>]+)>/)?.[1] || null

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
      className="ml-paper ml-letter rounded-[18px] px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5"
      aria-label={`Message from ${nameOf(message.from)}`}
    >
      <header className="flex items-start gap-3">
        <button type="button" onClick={onCollapse} disabled={!onCollapse} aria-label="Fold this message" className="mt-0.5 shrink-0 rounded-full disabled:cursor-default">
          <Monogram address={message.from} me={message.fromMe} size={40} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[15.5px] font-semibold text-ink2">{message.fromMe ? 'You' : nameOf(message.from)}</span>
            {message.from?.email && <span className="min-w-0 truncate text-[12.5px] text-slate">{message.from.email}</span>}
          </div>
          <button type="button" onClick={() => setDetails((v) => !v)} aria-expanded={details} className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full text-[12.5px] text-slate hover:text-ink2">
            <span className="truncate">{recipientsLine(message, self)}</span>
            <ChevronDown size={14} className={cx('shrink-0 transition-transform', details && 'rotate-180')} />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="ml-stamp-wide mr-1 text-right text-[12px] leading-tight text-slate" title={fullStamp(message.date, now)}>
            {fullStamp(message.date, now)}
            <span className="block text-[11.5px] text-slate/75">{ago(message.date, now)}</span>
          </span>
          <button type="button" onClick={() => onReply('reply', message)} aria-label="Reply" title="Reply" className="grid h-9 w-9 place-items-center rounded-full text-slate transition-colors hover:bg-black/[0.06] hover:text-ink2">
            <Reply size={17} />
          </button>
          <Menu
            onPaper
            label="Message actions"
            items={[
              { label: 'Reply', icon: <Reply size={16} />, onClick: () => onReply('reply', message) },
              others && { label: 'Reply all', icon: <ReplyAll size={16} />, onClick: () => onReply('replyAll', message) },
              { label: 'Forward', icon: <Forward size={16} />, onClick: () => onReply('forward', message) },
              { divider: true },
              { label: 'Mark unread from here', icon: <Mail size={16} />, onClick: onMarkUnread },
              unsubscribe && { label: 'Unsubscribe', icon: <MailX size={16} />, onClick: () => window.open(unsubscribe, '_blank', 'noopener') },
            ]}
          />
        </div>
      </header>
      <p className="ml-stamp-narrow mt-1 text-[12px] text-slate">{fullStamp(message.date, now)}</p>

      <AnimatePresence initial={false}>
        {details && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Details message={message} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4">
        <MessageBody message={message} rewrite={api.rewriteRemote} onMailto={onMailto} />
      </div>

      {files.length > 0 && (
        <div className="mt-5 border-t border-black/[0.07] pt-4">
          <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate">
            {files.length} {files.length === 1 ? 'attachment' : 'attachments'}
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {files.map((att) => (
              <Thumb
                key={att.id || att.filename}
                message={message}
                att={att}
                onOpen={(a, url) => (kindOf(a.mimeType, a.filename) === 'image' ? onOpenAttachment(message, a, files) : actions.download(message.id, a))}
              />
            ))}
          </div>
        </div>
      )}

    </motion.article>
  )
}
