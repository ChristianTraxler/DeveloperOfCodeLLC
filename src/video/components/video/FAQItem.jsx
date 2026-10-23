import { useId, useState } from 'react'
import { Icon } from './Icons'
import { Text } from './ui'

// Accessible disclosure: a real button with aria-expanded controlling a labelled region.
export default function FAQItem({ item, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className="border-b border-ink/10">
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-6 py-6 text-left font-display text-xl font-light leading-snug text-ink transition-colors hover:text-ember-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember sm:text-[1.45rem]"
        >
          <Text>{item.q}</Text>
          <span
            aria-hidden="true"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-ink/20 transition-transform duration-300 ${open ? 'rotate-45 bg-ink text-paper' : ''}`}
          >
            <Icon name="plus" className="h-4 w-4" />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        hidden={!open}
        className="max-w-3xl pb-7 pr-12 text-[1.02rem] leading-relaxed text-mute"
      >
        <Text>{item.a}</Text>
      </div>
    </div>
  )
}
