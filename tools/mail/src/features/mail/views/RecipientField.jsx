// To, Cc and Bcc: chips for each person, with suggestions from people you've emailed.
import { useId, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { isEmail, parseAddressList, sameEmail } from '../lib/address.js'
import { nameOf } from '../lib/format.js'
import { Monogram, cx } from '../ui/core.jsx'

export function RecipientField({ label, value, onChange, contacts = [], autoFocus, after }) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const input = useRef(null)
  const id = useId()

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!q) return []
    return contacts
      .filter((c) => !value.some((v) => sameEmail(v.email, c.email)))
      .filter((c) => c.email.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q))
      .slice(0, 5)
  }, [text, contacts, value])

  const commit = (raw) => {
    const found = parseAddressList(raw).filter((a) => a.email)
    if (!found.length) return false
    const next = [...value]
    for (const a of found) {
      const known = contacts.find((c) => sameEmail(c.email, a.email))
      if (!next.some((v) => sameEmail(v.email, a.email))) next.push({ name: a.name || known?.name || '', email: a.email })
    }
    onChange(next)
    setText('')
    setActive(0)
    return true
  }

  const pick = (c) => {
    onChange([...value, { name: c.name || '', email: c.email }])
    setText('')
    setActive(0)
    input.current?.focus()
  }

  const onKeyDown = (e) => {
    if (suggestions.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setActive((i) => (e.key === 'ArrowDown' ? (i + 1) % suggestions.length : (i - 1 + suggestions.length) % suggestions.length))
      return
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && suggestions.length && text.trim()) {
      e.preventDefault()
      pick(suggestions[active] || suggestions[0])
      return
    }
    if ((e.key === 'Enter' || e.key === ',' || e.key === ';' || (e.key === 'Tab' && text.trim())) && text.trim()) {
      e.preventDefault()
      commit(text)
      return
    }
    if (e.key === 'Backspace' && !text && value.length) {
      e.preventDefault()
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="relative flex min-h-[48px] items-start gap-2 border-b border-black/[0.08] py-1.5">
      <label htmlFor={id} className="w-14 shrink-0 pt-[9px] text-[13.5px] text-slate">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-0.5" onClick={() => input.current?.focus()}>
        {value.map((a, i) => {
          const ok = isEmail(a.email)
          return (
            <span
              key={`${a.email}${i}`}
              title={a.email}
              className={cx('inline-flex h-8 max-w-full items-center gap-1.5 rounded-full pl-1 pr-1.5 text-[13.5px]', ok ? 'bg-[#f0eee9] text-ink2' : 'bg-[#fde8e4] text-[#a3261a] ring-1 ring-[#e8a093]')}
            >
              <Monogram address={a} size={24} />
              <span className="truncate">{a.name || a.email}</span>
              <button
                type="button"
                aria-label={`Remove ${a.name || a.email}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(value.filter((_, j) => j !== i))
                }}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-slate hover:bg-black/10 hover:text-ink2"
              >
                <X size={12} strokeWidth={2.6} />
              </button>
            </span>
          )
        })}
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => {
            const v = e.target.value
            if (/[,;]\s*$/.test(v) || (v.includes(',') && v.length > 6)) {
              if (commit(v)) return
            }
            setText(v)
            setActive(0)
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text')
            if (/[,;\n]/.test(pasted) || /<[^>]+@/.test(pasted)) {
              e.preventDefault()
              commit(pasted)
            }
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (text.trim()) commit(text)
          }}
          aria-autocomplete="list"
          aria-controls={`${id}-list`}
          className={cx("h-8 flex-1 bg-transparent text-[15px] text-ink2 placeholder:text-slate/60 focus:outline-none", value.length ? "min-w-[56px]" : "min-w-[120px]")}
          placeholder={value.length ? '' : 'Name or email'}
        />
      </div>
      {after && <div className="shrink-0 pt-1">{after}</div>}
      {focused && suggestions.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute left-14 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-[14px] border border-black/10 bg-white p-1 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.45)]">
          {suggestions.map((c, i) => (
            <li key={c.email} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                className={cx('flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left', i === active ? 'bg-[#f0eee9]' : 'hover:bg-[#f6f4ef]')}
              >
                <Monogram address={c} size={30} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-ink2">{nameOf(c)}</span>
                  <span className="block truncate text-[12.5px] text-slate">{c.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
