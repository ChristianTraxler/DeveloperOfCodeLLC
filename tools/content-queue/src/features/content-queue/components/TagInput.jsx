import { useMemo, useState } from 'react'
import { X } from 'lucide-react'

export const cleanTag = (t) =>
  t
    .toLowerCase()
    .replace(/^#/, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 32)

/** Tags as removable tokens. Enter, comma or Tab adds; Backspace on empty removes the last one. */
export default function TagInput({ id, value, onChange, suggestions = [], placeholder = 'Add a tag' }) {
  const [draft, setDraft] = useState('')
  const [focus, setFocus] = useState(false)

  const add = (raw) => {
    const t = cleanTag(raw)
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }

  const matches = useMemo(() => {
    const q = cleanTag(draft)
    return suggestions.filter((s) => !value.includes(s) && (!q || s.includes(q))).slice(0, 6)
  }, [draft, suggestions, value])

  return (
    <div>
      <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-[10px] border border-line bg-well px-2 py-1.5 transition-colors focus-within:border-ember/70 hover:border-line2">
        {value.map((t) => (
          <span key={t} className="inline-flex h-8 items-center gap-1 rounded-[7px] border border-line2 bg-raised pl-2.5 pr-1 text-[13px] text-bone">
            <span className="text-faint">#</span>
            {t}
            <button
              type="button"
              className="grid h-6 w-6 place-items-center rounded-[5px] text-faint hover:bg-line hover:text-bone"
              onClick={() => onChange(value.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const v = e.target.value
            if (/[,\n]/.test(v)) v.split(/[,\n]/).forEach(add)
            else setDraft(v)
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || (e.key === 'Tab' && draft)) && draft.trim()) {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setTimeout(() => setFocus(false), 180)
            if (draft.trim()) add(draft)
          }}
          placeholder={value.length ? '' : placeholder}
          className="h-8 min-w-[110px] flex-1 bg-transparent px-1.5 text-[15px] text-bone placeholder:text-faint focus:outline-none"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
        />
      </div>
      {focus && matches.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested tags">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
              className="inline-flex h-8 items-center rounded-[7px] border border-dashed border-line2 px-2.5 text-[13px] text-mute hover:border-mute hover:text-bone"
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
