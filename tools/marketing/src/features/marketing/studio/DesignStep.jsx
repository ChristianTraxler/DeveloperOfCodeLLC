// Design: inbox details, the sections of the email, the look, and a live preview beside it.
import { useMemo, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { GripVertical, Plus, ChevronUp, ChevronDown, Copy, Trash2, CopyPlus, Lock } from 'lucide-react'
import { BLOCK_INFO, ADDABLE, blockSummary, makeBlock } from '../data/blocks.js'
import { THEMES, THEME_ORDER, HEADINGS, HEADING_ORDER, BUTTONS, BUTTON_ORDER } from '../email/themes.js'
import { Button, cx } from '../ui/core.jsx'
import { Field, Input, Segmented } from '../ui/fields.jsx'
import { Menu } from '../ui/Menu.jsx'
import { Sheet } from '../ui/Sheet.jsx'
import { EmailFrame } from '../ui/EmailFrame.jsx'
import { InboxMock, DeviceSwitch, PreviewAs, PhoneFrame } from '../ui/preview.jsx'
import { BlockEditor, BLOCK_ICONS, TagInput } from './BlockEditor.jsx'

function Section({ title, hint, children, action }) {
  return (
    <section className="border-b border-line px-4 py-7 sm:px-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">{title}</h3>
          {hint && <p className="mt-1 text-[13px] leading-snug text-faint">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function InboxDetails({ campaign, change, contact }) {
  const subjectLen = (campaign.subject || '').length
  const preLen = (campaign.preheader || '').length
  return (
    <Section title="Inbox details" hint="What people see before they open it.">
      <InboxMock campaign={campaign} contact={contact} />
      <div className="mt-6 space-y-5">
        <Field label="From name" htmlFor="mk-from">
          <Input id="mk-from" value={campaign.fromName} onChange={(e) => change({ fromName: e.target.value }, 'fromName')} size="sm" />
        </Field>
        <Field label="Subject line" htmlFor="mk-subject">
          <TagInput id="mk-subject" value={campaign.subject} onChange={(v) => change({ subject: v }, 'subject')} placeholder="Say what's inside in a few words" maxHint={`${subjectLen} / 60`} />
        </Field>
        <Field label="Preview text" htmlFor="mk-preheader">
          <TagInput id="mk-preheader" value={campaign.preheader} onChange={(v) => change({ preheader: v }, 'preheader')} placeholder="The gray line after the subject" maxHint={`${preLen} / 90`} />
        </Field>
      </div>
    </Section>
  )
}

function Row({ block, selected, onSelect, actions, handle }) {
  const Icon = BLOCK_ICONS[block.type]
  return (
    <div className={cx('group flex items-center gap-1.5 rounded-[16px] border bg-panel/80 py-1.5 pl-1 pr-1 transition-colors', selected ? 'border-ember/60 bg-ember/[0.06]' : 'border-line hover:border-line2')}>
      {handle || (
        <span className="grid h-10 w-7 shrink-0 place-items-center text-faint/70" title="Always in place" aria-hidden="true">
          <Lock size={13} />
        </span>
      )}
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] py-1 text-left" aria-label={`Edit ${BLOCK_INFO[block.type].label}`}>
        <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border', selected ? 'border-ember/40 bg-ember/15 text-ember' : 'border-line2 bg-white/[0.03] text-mute')}>
          <Icon size={16} />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-medium leading-tight">{BLOCK_INFO[block.type].label}</span>
          <span className="block truncate text-[12.5px] text-faint">{blockSummary(block)}</span>
        </span>
      </button>
      {actions && <Menu items={actions} label={`Actions for ${BLOCK_INFO[block.type].label}`} />}
    </div>
  )
}

function DraggableRow({ block, children }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={block} dragListener={false} dragControls={controls} as="li" className="relative list-none" whileDrag={{ scale: 1.015, zIndex: 20, boxShadow: '0 24px 60px -18px rgba(0,0,0,0.9)' }}>
      {children(
        <button
          type="button"
          aria-label="Drag to move"
          onPointerDown={(e) => controls.start(e)}
          className="grid h-10 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-[10px] text-faint transition-colors hover:text-bone active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>,
      )}
    </Reorder.Item>
  )
}

function BlockList({ campaign, change, selected, onSelect, onAdd }) {
  const blocks = campaign.blocks
  const header = blocks.find((b) => b.type === 'header')
  const footer = blocks.find((b) => b.type === 'footer')
  const middle = blocks.filter((b) => b.type !== 'header' && b.type !== 'footer')

  const setMiddle = (list) => change((c) => ({ ...c, blocks: [header, ...list, footer].filter(Boolean) }))
  const move = (id, dir) => {
    const i = middle.findIndex((b) => b.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= middle.length) return
    const list = middle.slice()
    ;[list[i], list[j]] = [list[j], list[i]]
    setMiddle(list)
  }
  const duplicate = (id) => {
    const i = middle.findIndex((b) => b.id === id)
    const copy = { ...JSON.parse(JSON.stringify(middle[i])), id: makeBlock('spacer').id }
    const list = middle.slice()
    list.splice(i + 1, 0, copy)
    setMiddle(list)
    onSelect(copy.id)
  }
  const remove = (id) => setMiddle(middle.filter((b) => b.id !== id))

  return (
    <Section
      title="Email content"
      hint="Tap a section to edit it. Drag to reorder."
      action={
        <Button variant="ghost" size="xs" onClick={() => onAdd(null)}>
          <Plus size={15} /> Add
        </Button>
      }
    >
      <div className="space-y-2">
        {header && <Row block={header} selected={selected === header.id} onSelect={() => onSelect(header.id)} />}
        <Reorder.Group axis="y" values={middle} onReorder={setMiddle} as="ul" className="space-y-2">
          {middle.map((b, i) => (
            <DraggableRow key={b.id} block={b}>
              {(handle) => (
                <Row
                  block={b}
                  handle={handle}
                  selected={selected === b.id}
                  onSelect={() => onSelect(b.id)}
                  actions={[
                    { label: 'Move up', icon: <ChevronUp size={17} />, onClick: () => move(b.id, -1), disabled: i === 0 },
                    { label: 'Move down', icon: <ChevronDown size={17} />, onClick: () => move(b.id, 1), disabled: i === middle.length - 1 },
                    { label: 'Duplicate', icon: <Copy size={17} />, onClick: () => duplicate(b.id) },
                    { label: 'Add a section below', icon: <CopyPlus size={17} />, onClick: () => onAdd(b.id) },
                    { divider: true, key: 'd' },
                    { label: 'Remove', icon: <Trash2 size={17} />, onClick: () => remove(b.id), danger: true },
                  ]}
                />
              )}
            </DraggableRow>
          ))}
        </Reorder.Group>
        {footer && <Row block={footer} selected={selected === footer.id} onSelect={() => onSelect(footer.id)} />}
      </div>
      <button type="button" onClick={() => onAdd(null)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-line2 text-[14px] font-medium text-mute transition-colors hover:border-ember/50 hover:text-bone">
        <Plus size={16} /> Add a section
      </button>
    </Section>
  )
}

function Swatch({ theme }) {
  const t = THEMES[theme]
  return (
    <span className="flex h-12 w-full overflow-hidden rounded-[10px] ring-1 ring-inset ring-white/10" aria-hidden="true">
      <span className="flex-[3]" style={{ background: t.bg }}>
        <span className="mx-auto mt-2.5 block h-5 w-[70%] rounded-[4px]" style={{ background: t.card }}>
          <span className="ml-1.5 mt-1.5 inline-block h-1.5 w-[45%] rounded-full align-top" style={{ background: t.ink }} />
        </span>
      </span>
      <span className="flex-1" style={{ background: t.accent }} />
      <span className="flex-1" style={{ background: t.band }} />
    </span>
  )
}

function StylePanel({ campaign, change }) {
  const style = campaign.style
  const set = (patch, key) => change((c) => ({ ...c, style: { ...c.style, ...patch } }), key)
  return (
    <Section title="Look and feel" hint="Colors, headline style and buttons for this email.">
      <div className="space-y-6">
        <Field label="Colors">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {THEME_ORDER.map((id) => (
              <button key={id} type="button" aria-pressed={style.theme === id} onClick={() => set({ theme: id })} className={cx('rounded-[14px] border-2 p-1.5 text-left transition-colors', style.theme === id ? 'border-ember' : 'border-transparent hover:border-line2')}>
                <Swatch theme={id} />
                <span className="block px-1 pb-0.5 pt-2 text-[13px] font-medium">{THEMES[id].name}</span>
                <span className="line-clamp-2 block px-1 text-[11.5px] leading-snug text-faint">{THEMES[id].note}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="Headlines">
          <Segmented value={style.headings} onChange={(v) => set({ headings: v })} label="Headline style" options={HEADING_ORDER.map((id) => ({ value: id, label: HEADINGS[id].name }))} />
        </Field>
        <Field label="Buttons">
          <Segmented value={style.buttons} onChange={(v) => set({ buttons: v })} label="Button shape" options={BUTTON_ORDER.map((id) => ({ value: id, label: BUTTONS[id].name }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="No first name? Say" htmlFor="mk-fallback">
            <Input id="mk-fallback" value={style.fallback} onChange={(e) => set({ fallback: e.target.value }, 'fallback')} size="sm" />
          </Field>
          <Field label="No business? Say" htmlFor="mk-bizfallback">
            <Input id="mk-bizfallback" value={style.bizFallback} onChange={(e) => set({ bizFallback: e.target.value }, 'bizFallback')} size="sm" />
          </Field>
        </div>
      </div>
    </Section>
  )
}

export function AddSectionSheet({ open, onClose, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} kicker="Email content" title="Add a section">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ADDABLE.map((type) => {
          const Icon = BLOCK_ICONS[type]
          return (
            <button key={type} type="button" onClick={() => onPick(type)} className="flex items-start gap-3 rounded-[16px] border border-line p-3.5 text-left transition-colors hover:border-ember/50 hover:bg-white/[0.03]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-line2 text-mute">
                <Icon size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-medium">{BLOCK_INFO[type].label}</span>
                <span className="block text-[12.5px] leading-snug text-faint">{BLOCK_INFO[type].hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

export function PreviewPane({ campaign, settings, people, contact, setContact, selected, onSelect, desktop }) {
  const [device, setDevice] = useState('desktop')
  const showPhone = !desktop || device === 'phone'
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        {desktop && <DeviceSwitch value={device} onChange={setDevice} />}
        <PreviewAs people={people} value={contact} onChange={setContact} className="ml-auto w-full max-w-[300px]" />
      </div>
      <div className={cx('min-h-0 flex-1', desktop ? 'mk-desk p-5 xl:p-8' : 'bg-white')}>
        {!desktop ? (
          <EmailFrame campaign={campaign} settings={settings} contact={contact} selected={selected} onSelect={onSelect} />
        ) : showPhone ? (
          <div className="mx-auto h-full max-h-[860px] w-full max-w-[400px]">
            <PhoneFrame>
              <EmailFrame campaign={campaign} settings={settings} contact={contact} selected={selected} onSelect={onSelect} />
            </PhoneFrame>
          </div>
        ) : (
          <div className="mx-auto h-full w-full max-w-[700px] overflow-hidden rounded-[18px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
            <EmailFrame campaign={campaign} settings={settings} contact={contact} selected={selected} onSelect={onSelect} />
          </div>
        )}
      </div>
    </div>
  )
}

export function DesignStep({ campaign, settings, change, selected, setSelected, onPreviewSelect, people, contact, setContact, desktop, mobileView, onOpenSettings }) {
  const [adding, setAdding] = useState(null)
  const block = useMemo(() => campaign.blocks.find((b) => b.id === selected) || null, [campaign.blocks, selected])

  const patchBlock = (id, patch, key) => change((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }), key)
  const addBlock = (type) => {
    const fresh = makeBlock(type)
    change((c) => {
      const list = c.blocks.slice()
      const afterIndex = adding?.after ? list.findIndex((b) => b.id === adding.after) : -1
      const footerIndex = list.findIndex((b) => b.type === 'footer')
      const at = afterIndex >= 0 ? afterIndex + 1 : footerIndex >= 0 ? footerIndex : list.length
      list.splice(at, 0, fresh)
      return { ...c, blocks: list }
    })
    setAdding(null)
    setSelected(fresh.id)
  }

  const editor = (
    <div className={cx('mk-scroll h-full overflow-y-auto overscroll-contain', desktop && 'border-r border-line')}>
      {block ? (
        <BlockEditor
          key={block.id}
          block={block}
          settings={settings}
          onOpenSettings={onOpenSettings}
          onPatch={(patch, key) => patchBlock(block.id, patch, key)}
          onBack={() => setSelected(null)}
          onDuplicate={() => {
            const copy = { ...JSON.parse(JSON.stringify(block)), id: makeBlock('spacer').id }
            change((c) => {
              const list = c.blocks.slice()
              list.splice(list.findIndex((b) => b.id === block.id) + 1, 0, copy)
              return { ...c, blocks: list }
            })
            setSelected(copy.id)
          }}
          onRemove={() => {
            change((c) => ({ ...c, blocks: c.blocks.filter((b) => b.id !== block.id) }))
            setSelected(null)
          }}
        />
      ) : (
        <>
          <InboxDetails campaign={campaign} change={change} contact={contact} />
          <BlockList campaign={campaign} change={change} selected={selected} onSelect={setSelected} onAdd={(after) => setAdding({ after })} />
          <StylePanel campaign={campaign} change={change} />
          <div className="h-10" />
        </>
      )}
    </div>
  )

  const preview = <PreviewPane campaign={campaign} settings={settings} people={people} contact={contact} setContact={setContact} selected={selected} onSelect={onPreviewSelect || setSelected} desktop={desktop} />

  return (
    <>
      {desktop ? (
        <div className="grid h-full min-h-0 grid-cols-[minmax(380px,460px)_minmax(0,1fr)]">
          {editor}
          {preview}
        </div>
      ) : (
        <div className="h-full min-h-0">{mobileView === 'preview' ? preview : editor}</div>
      )}
      <AddSectionSheet open={!!adding} onClose={() => setAdding(null)} onPick={addBlock} />
    </>
  )
}
