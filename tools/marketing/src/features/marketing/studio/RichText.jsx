// A small rich text editor: bold, italic, links, lists and merge tags. Output is cleaned HTML.
import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Link2, List, ListOrdered, X } from 'lucide-react'
import { cleanRich, tokensToChips, MERGE_TAGS, safeUrl } from '../lib/rich.js'
import { cx } from '../ui/core.jsx'

function ToolButton({ label, onAction, children, active }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAction}
      className={cx('grid h-9 w-9 place-items-center rounded-[10px] transition-colors', active ? 'bg-white/[0.12] text-bone' : 'text-mute hover:bg-white/[0.07] hover:text-bone')}
    >
      {children}
    </button>
  )
}

export function RichText({ id, value, onChange, placeholder = 'Write something', minHeight = 140 }) {
  const ref = useRef(null)
  const last = useRef(null)
  const saved = useRef(null)
  const [linking, setLinking] = useState(false)
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!ref.current) return
    if (value === last.current) return
    ref.current.innerHTML = tokensToChips(value || '')
    last.current = value
  }, [value])

  const emit = () => {
    const html = cleanRich(ref.current.innerHTML)
    last.current = html
    onChange(html)
  }

  const run = (cmd, arg) => {
    ref.current.focus()
    document.execCommand(cmd, false, arg)
    emit()
  }

  const insertTag = (tag) => {
    ref.current.focus()
    const chip = `<span class="mk-merge" data-merge="${tag.key}" contenteditable="false">${tag.label}</span>&nbsp;`
    document.execCommand('insertHTML', false, chip)
    emit()
  }

  const startLink = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && ref.current.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange()
    else saved.current = null
    setUrl('')
    setLinking(true)
  }

  const applyLink = (e) => {
    e.preventDefault()
    const href = safeUrl(url)
    ref.current.focus()
    const sel = window.getSelection()
    if (saved.current) {
      sel.removeAllRanges()
      sel.addRange(saved.current)
    }
    if (href !== '#') {
      if (sel && !sel.isCollapsed) document.execCommand('createLink', false, href)
      else document.execCommand('insertHTML', false, `<a href="${href}">${url.replace(/^https?:\/\//, '')}</a>&nbsp;`)
    }
    setLinking(false)
    emit()
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-line2 bg-black/30 transition-colors focus-within:border-ember/70 focus-within:ring-4 focus-within:ring-ember/10">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1.5">
        <ToolButton label="Bold" onAction={() => run('bold')}>
          <Bold size={16} />
        </ToolButton>
        <ToolButton label="Italic" onAction={() => run('italic')}>
          <Italic size={16} />
        </ToolButton>
        <ToolButton label="Add a link" onAction={startLink} active={linking}>
          <Link2 size={16} />
        </ToolButton>
        <ToolButton label="Bulleted list" onAction={() => run('insertUnorderedList')}>
          <List size={16} />
        </ToolButton>
        <ToolButton label="Numbered list" onAction={() => run('insertOrderedList')}>
          <ListOrdered size={16} />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-line2" aria-hidden="true" />
        {MERGE_TAGS.map((tag) => (
          <button
            key={tag.key}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTag(tag)}
            className="h-8 rounded-[9px] px-2.5 text-[12.5px] font-medium text-mute transition-colors hover:bg-white/[0.07] hover:text-bone"
          >
            + {tag.label}
          </button>
        ))}
      </div>
      {linking && (
        <form onSubmit={applyLink} className="flex items-center gap-2 border-b border-line bg-white/[0.02] px-2.5 py-2">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link, like developerofcode.com"
            aria-label="Link address"
            className="h-9 min-w-0 flex-1 rounded-[10px] border border-line2 bg-black/30 px-3 text-[14px] placeholder:text-faint focus:border-ember/70 focus:outline-none"
          />
          <button type="submit" className="h-9 rounded-full bg-bone px-3.5 text-[13px] font-semibold text-ink">
            Add link
          </button>
          <button type="button" aria-label="Cancel link" onClick={() => setLinking(false)} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-white/[0.07]">
            <X size={16} />
          </button>
        </form>
      )}
      <div
        id={id}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="Text"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, text)
        }}
        className="mk-rich px-4 py-3 text-[15.5px] leading-relaxed outline-none"
        style={{ minHeight }}
      />
    </div>
  )
}
