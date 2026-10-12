// One conversation in the list. Hover actions on desktop, swipe and long-press on touch.
import { memo, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { Archive, ArchiveRestore, Check, MailOpen, Mail, Paperclip, Star, Trash2, Undo2 } from 'lucide-react'
import { CATEGORY_TAGS, HIDDEN_LABELS } from '../state/views.js'
import { firstName, nameOf, stamp } from '../lib/format.js'
import { LabelChip, Monogram, cx } from '../ui/core.jsx'

const SWIPE = 96

// In Sent, name the people on the other side of the conversation, not whoever wrote last.
function otherSide(t) {
  const others = (t.people || []).filter((p) => !p.me)
  return others.length ? others : t.to || []
}

function senderLine(t, labelId) {
  if (labelId === 'SENT') {
    const list = otherSide(t)
    const names = list.map((a) => (list.length > 1 ? firstName(a) : nameOf(a)))
    return { text: names.length ? `To: ${names.join(', ')}` : 'To: (no one yet)' }
  }
  if (t.draft && (labelId === 'DRAFT' || t.count === 0)) {
    const names = (t.draftTo?.length ? t.draftTo : t.count === 0 ? t.to || [] : []).map((a) => nameOf(a))
    return { text: names.length ? names.join(', ') : '(no recipient)', draft: true }
  }
  const people = t.people || []
  if (people.length <= 1) {
    const p = people[0]
    return { text: p ? (p.me ? 'me' : nameOf(p)) : nameOf(t.from) }
  }
  const names = people.map((p) => (p.me ? 'me' : firstName(p)))
  return { text: names.length > 3 ? `${names[0]} .. ${names.slice(-2).join(', ')}` : names.join(', ') }
}

function HoverAction({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="grid h-7 w-7 place-items-center rounded-full text-mute transition-colors hover:bg-white/[0.09] hover:text-bone"
    >
      {children}
    </button>
  )
}

export const ThreadRow = memo(function ThreadRow({
  thread: t,
  labelId,
  selected,
  checked,
  selecting,
  fresh,
  touch,
  now,
  labelsById,
  onOpen,
  onCheck,
  onArchive,
  onTrash,
  onRestore,
  onToggleRead,
  onToggleStar,
}) {
  const x = useMotionValue(0)
  const leftOpacity = useTransform(x, [0, SWIPE * 0.6, SWIPE], [0, 0.6, 1])
  const rightOpacity = useTransform(x, [-SWIPE, -SWIPE * 0.6, 0], [1, 0.6, 0])
  const press = useRef(null)
  const moved = useRef(false)
  const swallow = useRef(false)
  const [swiping, setSwiping] = useState(false)

  const who = senderLine(t, labelId)
  const inTrash = labelId === 'TRASH'
  const archived = !t.labels.includes('INBOX') && !inTrash && labelId !== 'SPAM'
  const chips = t.labels
    .filter((l) => !HIDDEN_LABELS.has(l) && labelsById[l] && l !== labelId)
    .map((l) => labelsById[l])
    .slice(0, 2)
  const category = CATEGORY_TAGS[t.labels.find((l) => CATEGORY_TAGS[l])]
  // The face on a row is whoever you're talking with, even when you wrote last
  const others = (t.people || []).filter((p) => !p.me)
  const monogramAddress =
    labelId === 'SENT'
      ? otherSide(t)[0]
      : t.draft && (labelId === 'DRAFT' || t.count === 0)
        ? (t.draftTo?.length ? t.draftTo : t.to)?.[0]
        : t.lastFromMe && others.length
          ? others[others.length - 1]
          : t.from
  const isMe = labelId !== 'SENT' && t.lastFromMe && !(t.people || []).some((p) => !p.me)

  const startPress = () => {
    if (!touch) return
    moved.current = false
    swallow.current = false
    clearTimeout(press.current)
    press.current = setTimeout(() => {
      if (!moved.current) {
        navigator.vibrate?.(10)
        swallow.current = true
        onCheck(t.id, true)
      }
    }, 480)
  }
  const endPress = () => clearTimeout(press.current)

  const open = () => {
    // A swipe or a long press ends with the finger lifting over the row. That release is not a tap.
    if (swallow.current) {
      swallow.current = false
      return
    }
    if (selecting) onCheck(t.id)
    else onOpen(t.id)
  }

  const hoverTools = !touch && !selecting
  return (
    <div className="relative" data-thread={t.id}>
      {touch && !selecting && (
        <>
          <motion.div className="ml-swipe-under bg-[#3454a0]/35 text-[#c6d4ff]" style={{ opacity: leftOpacity }} aria-hidden="true">
            <span className="flex items-center gap-2">
              {t.unread ? <MailOpen size={18} /> : <Mail size={18} />}
              {t.unread ? 'Read' : 'Unread'}
            </span>
          </motion.div>
          <motion.div className="ml-swipe-under justify-end bg-ember/30 text-[#ffb08f]" style={{ opacity: rightOpacity }} aria-hidden="true">
            <span className="flex items-center gap-2">
              {inTrash ? 'Restore' : archived ? 'Inbox' : 'Archive'}
              {inTrash ? <Undo2 size={18} /> : archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
            </span>
          </motion.div>
        </>
      )}
      <motion.div
        drag={touch && !selecting ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        dragSnapToOrigin={false}
        onDragStart={() => {
          moved.current = true
          swallow.current = true
          setSwiping(true)
          clearTimeout(press.current)
        }}
        onDragEnd={(_, info) => {
          const dx = info.offset.x
          const settle = () => animate(x, 0, { type: 'spring', stiffness: 500, damping: 38 }).then(() => setSwiping(false))
          if (dx <= -SWIPE) {
            animate(x, -window.innerWidth, { duration: 0.22 }).then(() => (inTrash ? onRestore(t.id) : archived ? onRestore(t.id) : onArchive(t.id)))
          } else if (dx >= SWIPE) {
            settle()
            onToggleRead(t.id, t.unread)
          } else {
            settle()
          }
        }}
        style={{ x, touchAction: 'pan-y' }}
        className={cx(
          'group relative rounded-[18px] transition-colors duration-200',
          selected ? 'bg-white/[0.075]' : checked ? 'bg-ember/[0.09]' : swiping ? 'bg-[#0b101c]' : 'hover:bg-white/[0.035]',
          fresh && !selected && 'ml-arrived',
        )}
      >
        <button
          type="button"
          onClick={open}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(e) => touch && e.preventDefault()}
          aria-current={selected ? 'true' : undefined}
          aria-label={`${t.unread ? 'Unread. ' : ''}${who.text}. ${t.subject || 'No subject'}. ${stamp(t.date, now)}`}
          className="flex w-full min-w-0 items-start gap-3 rounded-[18px] px-3 py-3.5 text-left sm:gap-3.5 sm:px-3.5"
        >
          <span className="relative mt-0.5 shrink-0">
            {checked || selecting ? (
              <span className={cx('grid h-10 w-10 place-items-center rounded-full border-2 transition-colors', checked ? 'border-ember bg-ember text-[#1c0a02]' : 'border-line2 text-transparent')}>
                <Check size={18} strokeWidth={3} />
              </span>
            ) : (
              <Monogram address={monogramAddress} me={isMe} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cx('flex items-baseline gap-2', hoverTools && 'group-focus-within:pr-[122px] group-hover:pr-[122px]')}>
              {t.unread && <span className="mb-[3px] h-[7px] w-[7px] shrink-0 self-center rounded-full bg-ember" aria-hidden="true" />}
              <span className={cx('min-w-0 truncate text-[15px] leading-tight', t.unread ? 'wide font-semibold text-bone' : 'font-medium text-bone/75')}>
                {who.draft ? <span className="text-[#ff8a5b]">Draft · </span> : null}
                {who.text}
              </span>
              {t.count > 1 && <span className="shrink-0 text-[12.5px] tabular-nums text-faint">{t.count}</span>}
              {t.draft && !who.draft && <span className="shrink-0 text-[12.5px] font-medium text-[#ff8a5b]">Draft</span>}
              <span className={cx('ml-auto shrink-0 pl-2 text-[12.5px] tabular-nums', t.unread ? 'font-semibold text-bone' : 'text-faint', hoverTools && 'group-focus-within:hidden group-hover:hidden')}>{stamp(t.date, now)}</span>
            </span>
            <span className={cx('mt-1 block truncate text-[14px] leading-snug', t.unread ? 'font-medium text-bone' : 'text-bone/70')}>{t.subject || '(no subject)'}</span>
            <span className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-faint md:line-clamp-1">{t.snippet || ' '}</span>
            {(chips.length > 0 || t.attachments || category || t.starred) && (
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                {t.starred && <Star size={14} className="fill-[#f2b544] text-[#f2b544]" aria-label="Starred" />}
                {t.attachments && (
                  <span className="inline-flex h-[22px] items-center gap-1 rounded-full border border-line px-2 text-[11.5px] font-medium text-mute">
                    <Paperclip size={12} /> Files
                  </span>
                )}
                {chips.map((l) => (
                  <LabelChip key={l.id} label={l} />
                ))}
                {category && labelId === 'INBOX' && <span className="text-[11.5px] font-medium text-faint">{category}</span>}
              </span>
            )}
          </span>
        </button>

        {hoverTools && (
          <span className="absolute right-2 top-[9px] hidden items-center gap-0.5 group-focus-within:flex group-hover:flex sm:right-2.5">
            {inTrash ? (
              <HoverAction label="Restore" onClick={() => onRestore(t.id)}>
                <Undo2 size={16} />
              </HoverAction>
            ) : archived ? (
              <HoverAction label="Move to Inbox" onClick={() => onRestore(t.id)}>
                <ArchiveRestore size={16} />
              </HoverAction>
            ) : (
              <HoverAction label="Archive" onClick={() => onArchive(t.id)}>
                <Archive size={16} />
              </HoverAction>
            )}
            {!inTrash && (
              <HoverAction label="Move to Trash" onClick={() => onTrash(t.id)}>
                <Trash2 size={16} />
              </HoverAction>
            )}
            <HoverAction label={t.unread ? 'Mark as read' : 'Mark as unread'} onClick={() => onToggleRead(t.id, t.unread)}>
              {t.unread ? <MailOpen size={16} /> : <Mail size={16} />}
            </HoverAction>
            <HoverAction label={t.starred ? 'Remove star' : 'Star'} onClick={() => onToggleStar(t.id, !t.starred)}>
              <Star size={16} className={t.starred ? 'fill-[#f2b544] text-[#f2b544]' : ''} />
            </HoverAction>
          </span>
        )}

        {hoverTools && (
          <button
            type="button"
            aria-label={`Select ${t.subject || 'conversation'}`}
            onClick={(e) => {
              e.stopPropagation()
              onCheck(t.id, true)
            }}
            className="absolute left-3 top-4 hidden h-10 w-10 place-items-center rounded-full border-2 border-line2 bg-[#0e1422] text-white/25 transition-colors hover:border-ember/70 hover:text-ember group-hover:grid sm:left-3.5"
          >
            <Check size={18} strokeWidth={3} />
          </button>
        )}
      </motion.div>
    </div>
  )
})
