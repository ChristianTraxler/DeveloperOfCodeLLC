// An open conversation: the subject set large on the desk, then the letters stacked on paper,
// older ones folded. Replies open right underneath on larger screens.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Forward,
  Mail,
  MoreHorizontal,
  Reply,
  ReplyAll,
  ShieldAlert,
  ShieldCheck,
  Star,
  Tag,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useMail } from '../state/MailContext.jsx'
import { HIDDEN_LABELS } from '../state/views.js'
import { draftFor, hasOthers } from '../lib/compose.js'
import { firstName, nameOf, plural } from '../lib/format.js'
import { Button, IconButton, LabelChip, cx } from '../ui/core.jsx'
import { Menu } from '../ui/Menu.jsx'
import { FoldedLetter, Letter } from './Letter.jsx'
import { Composer } from './Composer.jsx'

function LetterSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading the conversation">
      <div className="h-9 w-2/3 animate-pulse rounded-full bg-white/[0.07]" />
      <div className="h-4 w-1/3 animate-pulse rounded-full bg-white/[0.05]" />
      <div className="ml-paper mt-6 rounded-[18px] p-6">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 animate-pulse rounded-full bg-black/[0.07]" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-40 animate-pulse rounded-full bg-black/[0.08]" />
            <span className="block h-3 w-24 animate-pulse rounded-full bg-black/[0.06]" />
          </span>
        </div>
        <div className="mt-6 space-y-2.5">
          {[92, 86, 95, 60].map((w, i) => (
            <span key={i} className="block h-3 animate-pulse rounded-full bg-black/[0.06]" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Which letters start open: every unread one and the newest. Long runs of read letters fold
// into a single stack.
function plan(messages) {
  const open = new Set()
  messages.forEach((m, i) => {
    if (m.unread || i === messages.length - 1) open.add(m.id)
  })
  return open
}

export function Reader({ threadId, view, desktop, onClose, onPrev, onNext, onCompose, onMailto, onOpenImage, contacts, inlineReply, setInlineReply }) {
  const { details, threads, labels, account, actions } = useMail()
  const detail = details[threadId]
  const summary = threads[threadId]
  const data = detail?.data
  const self = useMemo(() => [account?.email, ...(account?.sendAs || []).map((s) => s.email)].filter(Boolean), [account])
  const [open, setOpen] = useState(() => new Set())
  const [stackOpen, setStackOpen] = useState(false)
  const top = useRef(null)
  const lastSeen = useRef(null)

  useEffect(() => {
    actions.openThread(threadId)
    setStackOpen(false)
    lastSeen.current = null
    top.current?.scrollTo?.({ top: 0 })
  }, [threadId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when this conversation changes (a new reply landed)
  useEffect(() => {
    if (detail?.stale && !detail.loading) actions.loadDetail(threadId)
  }, [detail?.stale, detail?.loading, threadId, actions])

  const inTrash = view.labelId === 'TRASH'
  const messages = useMemo(() => (data?.messages || []).filter((m) => (inTrash ? true : !m.labels.includes('TRASH'))), [data, inTrash])
  const sent = messages.filter((m) => !m.draft)
  const drafts = messages.filter((m) => m.draft)

  // Open the right letters when the conversation loads, and open new arrivals
  useEffect(() => {
    if (!sent.length) return
    const ids = sent.map((m) => m.id).join()
    if (lastSeen.current === ids) return
    const firstLoad = lastSeen.current == null
    const previous = new Set((lastSeen.current || '').split(','))
    lastSeen.current = ids
    setOpen((prev) => {
      const next = firstLoad ? plan(sent) : new Set(prev)
      if (!firstLoad) for (const m of sent) if (!previous.has(m.id)) next.add(m.id)
      return next
    })
  }, [sent])

  const labelsById = useMemo(() => Object.fromEntries((labels.user || []).map((l) => [l.id, l])), [labels.user])
  const threadLabels = data?.labels || summary?.labels || []
  const chips = threadLabels.filter((l) => !HIDDEN_LABELS.has(l) && labelsById[l]).map((l) => labelsById[l])
  const archived = !threadLabels.includes('INBOX') && !inTrash && !threadLabels.includes('SPAM')
  const spam = threadLabels.includes('SPAM')
  const starred = threadLabels.includes('STARRED')
  const subject = data?.subject || summary?.subject || ''
  const lastMessage = sent[sent.length - 1]
  const draftRecord = (m) => data?.drafts?.find((d) => d.messageId === m.id)

  const reply = (mode, message = lastMessage) => {
    if (!message) return
    const init = { ...draftFor(mode, message, { id: threadId, subject }, self), html: '' }
    if (desktop) setInlineReply({ key: `${mode}-${message.id}-${Date.now()}`, init })
    else onCompose(init)
  }

  const editDraft = (m) => {
    const record = draftRecord(m)
    const init = {
      mode: 'draft',
      to: m.to,
      cc: m.cc,
      bcc: m.bcc,
      subject: m.subject,
      html: m.html || (m.text || '').replace(/\n/g, '<br>'),
      threadId,
      inReplyTo: m.inReplyTo,
      references: m.references,
      draftId: record?.draftId || null,
      fromEmail: m.from?.email,
    }
    if (desktop) setInlineReply({ key: `draft-${m.id}`, init })
    else onCompose(init)
  }

  // Letters, with a run of 3+ folded read letters gathered into one stack
  const items = useMemo(() => {
    const out = []
    let run = []
    const flush = () => {
      if (run.length >= 3 && !stackOpen) out.push({ type: 'stack', messages: run })
      else for (const m of run) out.push({ type: 'fold', message: m })
      run = []
    }
    sent.forEach((m, i) => {
      const isOpen = open.has(m.id)
      if (!isOpen && i > 0 && i < sent.length - 1) {
        run.push(m)
        return
      }
      flush()
      out.push({ type: isOpen ? 'letter' : 'fold', message: m })
    })
    flush()
    return out
  }, [sent, open, stackOpen])

  const toolbar = (
    <div className="flex items-center gap-0.5">
      {!desktop ? (
        <IconButton label="Back to the list" onClick={onClose}>
          <ArrowLeft size={20} />
        </IconButton>
      ) : (
        <IconButton label="Close" shortcut="Esc" onClick={onClose}>
          <X size={19} />
        </IconButton>
      )}
      <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
      {inTrash ? (
        <IconButton label="Restore to Inbox" onClick={() => actions.untrash([threadId])}>
          <Undo2 size={18} />
        </IconButton>
      ) : spam ? (
        <IconButton label="Not spam" onClick={() => actions.spam([threadId], false)}>
          <ShieldCheck size={18} />
        </IconButton>
      ) : archived ? (
        <IconButton label="Move to Inbox" onClick={() => actions.toInbox([threadId])}>
          <ArchiveRestore size={18} />
        </IconButton>
      ) : (
        <IconButton label="Archive" shortcut="E" onClick={() => actions.archive([threadId])}>
          <Archive size={18} />
        </IconButton>
      )}
      {!inTrash && (
        <IconButton label="Move to Trash" shortcut="#" onClick={() => actions.trash([threadId])}>
          <Trash2 size={18} />
        </IconButton>
      )}
      <IconButton label="Mark as unread" shortcut="Shift+U" onClick={() => actions.markRead([threadId], false)}>
        <Mail size={18} />
      </IconButton>
      <IconButton label={starred ? 'Remove star' : 'Star'} shortcut="S" active={starred} onClick={() => actions.star([threadId], !starred)}>
        <Star size={18} className={starred ? 'fill-[#f2b544] text-[#f2b544]' : ''} />
      </IconButton>
      {labels.user?.length > 0 && (
        <Menu
          label="Labels"
          icon={<Tag size={18} />}
          heading="Labels"
          items={labels.user.map((l) => ({
            key: l.id,
            label: l.name,
            checked: threadLabels.includes(l.id),
            keepOpen: true,
            onClick: () => actions.setLabel([threadId], l.id, !threadLabels.includes(l.id), l.name),
          }))}
        />
      )}
      <Menu
        label="More"
        icon={<MoreHorizontal size={19} />}
        items={[
          lastMessage && { label: 'Reply', icon: <Reply size={16} />, hint: 'R', onClick: () => reply('reply') },
          lastMessage && hasOthers(lastMessage, self) && { label: 'Reply all', icon: <ReplyAll size={16} />, hint: 'A', onClick: () => reply('replyAll') },
          lastMessage && { label: 'Forward', icon: <Forward size={16} />, hint: 'F', onClick: () => reply('forward') },
          { divider: true },
          spam
            ? { label: 'Not spam', icon: <ShieldCheck size={16} />, onClick: () => actions.spam([threadId], false) }
            : { label: 'Report spam', icon: <ShieldAlert size={16} />, onClick: () => actions.spam([threadId], true) },
        ]}
      />
      {desktop && (
        <span className="ml-auto flex items-center gap-0.5">
          <IconButton label="Newer conversation" shortcut="K" onClick={onPrev} disabled={!onPrev}>
            <ChevronUp size={19} />
          </IconButton>
          <IconButton label="Older conversation" shortcut="J" onClick={onNext} disabled={!onNext}>
            <ChevronDown size={19} />
          </IconButton>
        </span>
      )}
    </div>
  )

  const crowd = summary?.people || []
  const people = [...crowd.filter((p) => !p.me).map((p) => firstName(p)), ...(crowd.some((p) => p.me) ? ['you'] : [])]
  const joined = people.length > 1 ? `${people.slice(0, -1).join(', ')} and ${people[people.length - 1]}` : people[0] || ''
  const byline = !joined ? '' : crowd.some((p) => p.me) && people.length > 1 ? `Between ${joined}` : crowd.some((p) => p.me) ? 'Just you' : `From ${joined}`

  return (
    <article className={cx('flex min-h-0 flex-col', desktop ? 'h-full' : 'min-h-full')} aria-label={subject || 'Conversation'}>
      <div
        className={cx('z-20 flex shrink-0 items-center border-b border-line bg-[#0a0f1c]/90 px-2 backdrop-blur-xl sm:px-3', desktop ? 'h-14' : 'sticky top-0 h-14')}
        style={!desktop ? { paddingTop: 'env(safe-area-inset-top, 0px)', height: 'calc(env(safe-area-inset-top, 0px) + 56px)' } : undefined}
      >
        {toolbar}
      </div>

      <div ref={top} className={cx('ml-desk relative', desktop ? 'ml-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain' : 'flex-1')}>
        <div className={cx('mx-auto w-full max-w-[860px] px-3 pb-16 pt-7 sm:px-6 lg:px-10 lg:pt-10', !desktop && 'pb-28')}>
          {!data && detail?.error ? (
            <div className="py-20 text-center">
              <p className="text-[15px] text-bone">{detail.error}</p>
              <Button className="mt-4" onClick={() => actions.loadDetail(threadId)}>
                Try again
              </Button>
            </div>
          ) : !data ? (
            <LetterSkeleton />
          ) : (
            <>
              <header className="mb-7 px-1">
                <h2 className="display text-balance text-[30px] leading-[1.06] text-bone sm:text-[38px] lg:text-[42px]">{subject || '(no subject)'}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13.5px] text-mute">
                  {byline && <span>{byline}</span>}
                  <span className="text-faint">{plural(sent.length, 'message', 'messages')}</span>
                  {chips.map((l) => (
                    <LabelChip key={l.id} label={l} />
                  ))}
                  {spam && <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-[12px] font-semibold text-danger">Spam</span>}
                  {inTrash && <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[12px] font-semibold text-mute">In Trash</span>}
                </div>
              </header>

              <div className="space-y-3">
                {items.map((item) =>
                  item.type === 'stack' ? (
                    <div key={`stack-${item.messages[0].id}`} className="ml-edges relative z-0 mb-4">
                      <button
                        type="button"
                        onClick={() => setStackOpen(true)}
                        className="ml-fold relative flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[13.5px] font-semibold text-slate transition-colors hover:text-ink2"
                      >
                        {plural(item.messages.length, 'earlier letter', 'earlier letters')}
                        <ChevronDown size={15} />
                      </button>
                    </div>
                  ) : item.type === 'fold' ? (
                    <FoldedLetter key={item.message.id} message={item.message} self={self} onOpen={() => setOpen((s) => new Set(s).add(item.message.id))} />
                  ) : (
                    <Letter
                      key={item.message.id}
                      message={item.message}
                      self={self}
                      last={item.message.id === lastMessage?.id}
                      onReply={reply}
                      onMailto={onMailto}
                      onOpenAttachment={onOpenImage}
                      onMarkUnread={() => actions.markRead([threadId], false)}
                      onCollapse={
                        sent.length > 1
                          ? () =>
                              setOpen((s) => {
                                const next = new Set(s)
                                next.delete(item.message.id)
                                return next
                              })
                          : null
                      }
                    />
                  ),
                )}

                {drafts.map((m) =>
                  inlineReply?.init?.draftId && inlineReply.init.draftId === draftRecord(m)?.draftId ? null : (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => editDraft(m)}
                      className="ml-fold flex w-full items-center gap-3 rounded-[14px] border border-dashed border-[#c4410c]/40 px-4 py-3 text-left"
                    >
                      <span className="rounded-full bg-[#c4410c] px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-white">Draft</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] text-slate">{m.snippet || 'Empty draft'}</span>
                      <span className="shrink-0 text-[13px] font-semibold text-[#c4410c]">Keep writing</span>
                    </button>
                  ),
                )}
              </div>

              {desktop && lastMessage && (
                <div className="mt-6">
                  <AnimatePresence mode="wait">
                    {inlineReply ? (
                      <Composer key={inlineReply.key} init={inlineReply.init} layout="inline" contacts={contacts} onClose={() => setInlineReply(null)} onReopen={(init) => setInlineReply({ key: `again-${Date.now()}`, init })} />
                    ) : (
                      <motion.div key="bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-fold flex flex-wrap items-center gap-2 rounded-[16px] p-2 pl-4">
                        <button type="button" onClick={() => reply('reply')} className="min-w-0 flex-1 truncate py-2 text-left text-[14.5px] text-slate hover:text-ink2">
                          Reply to {lastMessage.fromMe ? nameOf(lastMessage.to?.[0]) : nameOf(lastMessage.from)}
                        </button>
                        <button type="button" onClick={() => reply('reply')} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink2 px-3.5 text-[13.5px] font-semibold text-white">
                          <Reply size={15} /> Reply
                        </button>
                        {hasOthers(lastMessage, self) && (
                          <button type="button" onClick={() => reply('replyAll')} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.12] px-3.5 text-[13.5px] font-semibold text-ink2 hover:bg-black/[0.04]">
                            <ReplyAll size={15} /> Reply all
                          </button>
                        )}
                        <button type="button" onClick={() => reply('forward')} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.12] px-3.5 text-[13.5px] font-semibold text-ink2 hover:bg-black/[0.04]">
                          <Forward size={15} /> Forward
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!desktop && data && lastMessage && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[#0a0f1c]/[0.97] px-3 pt-2 backdrop-blur-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
          <div className="mx-auto flex max-w-[640px] items-center gap-1.5">
            {archived || inTrash ? (
              <IconButton label={inTrash ? 'Restore to Inbox' : 'Move to Inbox'} size={44} onClick={() => (inTrash ? actions.untrash([threadId]) : actions.toInbox([threadId]))}>
                {inTrash ? <Undo2 size={20} /> : <ArchiveRestore size={20} />}
              </IconButton>
            ) : (
              <IconButton
                label="Archive"
                size={44}
                onClick={() => {
                  actions.archive([threadId])
                  onClose()
                }}
              >
                <Archive size={20} />
              </IconButton>
            )}
            {!inTrash && (
              <IconButton
                label="Move to Trash"
                size={44}
                onClick={() => {
                  actions.trash([threadId])
                  onClose()
                }}
              >
                <Trash2 size={20} />
              </IconButton>
            )}
            <Button variant="ember" size="md" className="ml-auto flex-1" onClick={() => reply('reply')}>
              <Reply size={18} /> Reply{lastMessage.fromMe ? '' : ` to ${firstName(lastMessage.from)}`}
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}
