import { CheckCircle2, Copy, Mail, PenLine, Trash2 } from 'lucide-react'
import { Menu, MenuHeading, MenuItem, MenuRule } from './overlay'
import { StatusGlyph } from './marks'
import { STATUSES } from '../lib/platforms'

export default function PostMenu({ anchor, open, onClose, post, onAction }) {
  const run = (type, extra) => () => {
    onClose('select')
    onAction(type, post, extra)
  }
  return (
    <Menu anchor={anchor} open={open} onClose={onClose}>
      <MenuItem icon={PenLine} onSelect={run('edit')}>
        Open in composer
      </MenuItem>
      {post.status !== 'posted' && (
        <MenuItem icon={CheckCircle2} onSelect={run('posted')}>
          Mark as posted
        </MenuItem>
      )}
      <MenuItem icon={Mail} onSelect={run('promote')}>
        Promote via email
      </MenuItem>
      <MenuItem icon={Copy} onSelect={run('duplicate')}>
        Duplicate as draft
      </MenuItem>
      <MenuRule />
      <MenuHeading>Move to</MenuHeading>
      {STATUSES.filter((s) => s.id !== post.status).map((s) => (
        <MenuItem key={s.id} onSelect={run('move', s.id)}>
          <span className="inline-flex items-center gap-2.5">
            <StatusGlyph status={s.id} />
            {s.label}
          </span>
        </MenuItem>
      ))}
      <MenuRule />
      <MenuItem icon={Trash2} danger onSelect={run('delete')}>
        Delete
      </MenuItem>
    </Menu>
  )
}
