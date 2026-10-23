import { money } from '../../lib/format'
import { Text } from './ui'

// One line in the add-ons list: name and detail on the left, price on the right.
export default function AddOnRow({ item }) {
  return (
    <li className="group flex items-start justify-between gap-6 border-b border-ink/10 py-5 transition-colors hover:bg-white/50 sm:px-4">
      <div className="min-w-0">
        <p className="font-medium leading-snug text-ink">
          <Text>{item.name}</Text>
        </p>
        {item.detail && (
          <p className="mt-1 text-sm text-mute">
            <Text>{item.detail}</Text>
          </p>
        )}
      </div>
      <p className="shrink-0 text-right">
        <span className="font-display text-2xl font-light tabular-nums text-ink">{typeof item.price === 'number' ? money(item.price) : item.price}</span>
        <span className="block text-xs text-mute">{item.unit}</span>
      </p>
    </li>
  )
}
