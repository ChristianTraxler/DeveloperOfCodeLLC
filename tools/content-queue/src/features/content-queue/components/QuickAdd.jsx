import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { blankPost, useQueue } from '../data/QueueContext'
import { AccountSelect } from './Businesses'
import { useToast } from './overlay'
import TagInput from './TagInput'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export default function QuickAdd({ onOpen }) {
  const { add, allTags } = useQueue()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState([])
  const [account, setAccount] = useState('doc')
  const [error, setError] = useState('')
  const titleRef = useRef(null)

  const submit = (e) => {
    e?.preventDefault()
    if (!title.trim()) {
      setError('Give the idea a title so you can find it later.')
      titleRef.current?.focus()
      return
    }
    const post = blankPost({ title: title.trim(), notes: notes.trim(), tags, account, status: 'idea' })
    add(post)
    setTitle('')
    setNotes('')
    setTags([])
    setError('')
    toast('Idea added to the queue', { action: { label: 'Open', run: () => onOpen(post.id) } })
    titleRef.current?.focus()
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
      }}
      className="rounded-[16px] border border-line bg-panel"
      aria-labelledby="cq-quick-title"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <h2 id="cq-quick-title" className="text-[14px] font-semibold tracking-[0.01em] text-bone [font-stretch:108%]">
          Capture an idea
        </h2>
        <span className="hidden font-mono text-[11px] text-faint sm:inline">{isMac ? '⌘' : 'Ctrl'} + Enter to add</span>
      </div>
      <div className="flex flex-col gap-3.5 px-4 py-4 sm:px-5">
        <div>
          <label htmlFor="cq-quick-title-input" className="sr-only">
            Idea title
          </label>
          <input
            id="cq-quick-title-input"
            ref={titleRef}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (error) setError('')
            }}
            placeholder="What's the idea?"
            aria-invalid={!!error}
            aria-describedby={error ? 'cq-quick-error' : undefined}
            className="w-full border-0 bg-transparent p-0 font-display text-[21px] font-[420] leading-snug tracking-[-0.01em] text-bone placeholder:text-faint focus:outline-none"
            enterKeyHint="next"
          />
          {error && (
            <p id="cq-quick-error" className="mt-1.5 text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="cq-quick-notes" className="sr-only">
            Notes
          </label>
          <textarea
            id="cq-quick-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes, angle, a link to come back to"
            className="cq-input min-h-[68px] resize-y text-[14px] leading-relaxed"
          />
        </div>
        <div className="grid gap-3">
          <div className="min-w-0">
            <label htmlFor="cq-quick-tags" className="sr-only">
              Tags
            </label>
            <TagInput id="cq-quick-tags" value={tags} onChange={setTags} suggestions={allTags} placeholder="Tags" />
          </div>
          <div className="flex gap-2">
            <label htmlFor="cq-quick-account" className="sr-only">
              For
            </label>
            <AccountSelect
              id="cq-quick-account"
              value={account}
              onChange={setAccount}
              className="cq-input h-[46px] min-w-0 flex-1 py-0 text-[14px]"
            />
            <button type="submit" className="cq-btn-primary h-[46px] shrink-0 px-4">
              Add idea
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
