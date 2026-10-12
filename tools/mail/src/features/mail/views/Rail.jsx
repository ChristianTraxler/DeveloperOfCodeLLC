// Folders, labels and saved searches. The desktop's left column, and the folder sheet on phones.
import { Keyboard, PenLine, Search, Settings2, X } from 'lucide-react'
import { useMail } from '../state/MailContext.jsx'
import { FOLDERS } from '../state/views.js'
import { useSettings } from '../state/settings.js'
import { Button, Kbd, Monogram, cx } from '../ui/core.jsx'
import { LiveChip } from './LiveChip.jsx'

function Item({ active, icon: Icon, color, label, count, countTone = 'mute', onClick, onRemove, removeLabel }) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'flex h-10 w-full items-center gap-3 rounded-[12px] pl-3 pr-2.5 text-left text-[14.5px] transition-colors',
          active ? 'bg-white/[0.08] text-bone' : 'text-mute hover:bg-white/[0.04] hover:text-bone',
        )}
      >
        {Icon ? (
          <Icon size={17} className={cx('shrink-0', active ? 'text-ember' : 'text-faint group-hover:text-mute')} strokeWidth={active ? 2.2 : 1.9} />
        ) : (
          <span className="grid h-[17px] w-[17px] shrink-0 place-items-center" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color || '#98a1b5' }} />
          </span>
        )}
        <span className={cx('min-w-0 flex-1 truncate', active && 'font-medium')}>{label}</span>
        {count > 0 && (
          <span className={cx('shrink-0 text-[12.5px] font-semibold tabular-nums', countTone === 'ember' ? 'text-[#ff9a6e]' : 'text-faint', onRemove && 'group-hover:opacity-0')}>
            {count > 999 ? '999+' : count}
          </span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-faint opacity-0 transition hover:bg-white/[0.08] hover:text-bone focus:opacity-100 group-hover:opacity-100"
        >
          <X size={14} />
        </button>
      )}
    </li>
  )
}

function Heading({ children }) {
  return <p className="mb-1.5 mt-6 px-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-faint">{children}</p>
}

export function Rail({ view, onPick, onCompose, onSettings, onShortcuts, showWrite = true, className = '' }) {
  const { labels, account, api } = useMail()
  const [settings, update] = useSettings()
  const sys = Object.fromEntries((labels.system || []).map((l) => [l.id, l]))
  const countFor = (f) => (f.count === 'unread' ? sys[f.id]?.unread : f.count === 'total' ? sys[f.id]?.messages || sys[f.id]?.total : 0) || 0
  const isActive = (labelId) => !view.q && view.labelId === labelId

  return (
    <nav aria-label="Mail folders" className={cx('flex min-h-0 flex-col', className)}>
      {showWrite && (
        <div className="shrink-0 px-1 pb-5">
          <Button variant="ember" size="lg" className="w-full justify-between pl-5 pr-3" onClick={onCompose}>
            <span className="flex items-center gap-2.5">
              <PenLine size={18} strokeWidth={2.2} />
              Write
            </span>
            <Kbd className="border-[#1c0a02]/20 bg-[#1c0a02]/10 text-[#1c0a02]/70">C</Kbd>
          </Button>
        </div>
      )}

      <div className="ml-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
      <ul className="space-y-0.5">
        {FOLDERS.map((f) => (
          <Item
            key={f.id}
            active={isActive(f.id)}
            icon={f.icon}
            label={f.name}
            count={countFor(f)}
            countTone={f.id === 'INBOX' ? 'ember' : 'mute'}
            onClick={() => onPick({ labelId: f.id, q: '' })}
          />
        ))}
      </ul>

      {labels.user?.length > 0 && (
        <>
          <Heading>Labels</Heading>
          <ul className="space-y-0.5">
            {labels.user.map((l) => (
              <Item key={l.id} active={isActive(l.id)} color={l.color} label={l.name} count={l.unread} onClick={() => onPick({ labelId: l.id, q: '' })} />
            ))}
          </ul>
        </>
      )}

      {settings.saved?.length > 0 && (
        <>
          <Heading>Saved searches</Heading>
          <ul className="space-y-0.5">
            {settings.saved.map((s) => (
              <Item
                key={s.id}
                active={!!view.q && view.q === s.q}
                icon={Search}
                label={s.name}
                onClick={() => onPick({ labelId: '', q: s.q })}
                onRemove={() => update((cur) => ({ saved: cur.saved.filter((x) => x.id !== s.id) }))}
                removeLabel={`Remove the saved search ${s.name}`}
              />
            ))}
          </ul>
        </>
      )}

      </div>

      <div className="shrink-0 pt-4">
        <div className="rounded-[18px] border border-line bg-white/[0.02] p-3">
          <div className="flex items-center gap-3">
            <Monogram me size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-bone">{account?.email || 'Gmail'}</p>
              <p className="text-[12px] text-faint">{api.mode === 'demo' ? 'Example inbox' : 'Linked Gmail'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <LiveChip />
            <div className="flex items-center">
              {onShortcuts && (
                <button type="button" onClick={onShortcuts} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" className="grid h-8 w-8 place-items-center rounded-full text-faint transition-colors hover:bg-white/[0.07] hover:text-bone">
                  <Keyboard size={16} />
                </button>
              )}
              <button type="button" onClick={onSettings} aria-label="Mail settings" title="Mail settings" className="grid h-8 w-8 place-items-center rounded-full text-faint transition-colors hover:bg-white/[0.07] hover:text-bone">
                <Settings2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
