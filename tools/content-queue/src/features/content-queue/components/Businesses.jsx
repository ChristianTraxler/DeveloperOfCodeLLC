// The businesses a post can be for: the "For" picker (with "Add a business" at the end), the
// add and edit form, and the Businesses list at the bottom of the page.
import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Dialog } from './overlay'
import { useQueue } from '../data/QueueContext'
import { HOME_ACCOUNT, accountIdFor, cleanHandle, cleanSite, initialsOf } from '../data/accounts'

const ADD = '__add'
const EMPTY = { name: '', handle: '', site: '', about: '' }

// Add (account null) or edit a business. Calls onSaved with the business's id.
export function BusinessDialog({ open, account, onClose, onSaved }) {
  const { accounts, addAccount, updateAccount } = useQueue()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm(account ? { name: account.name, handle: account.handle, site: account.site, about: account.about } : EMPTY)
    setError('')
  }, [open, account])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const submit = (e) => {
    e?.preventDefault()
    const name = form.name.trim().replace(/\s+/g, ' ')
    if (!name) return setError('Give the business a name.')
    const clash = accounts.find((a) => a.id !== account?.id && a.name.toLowerCase() === name.toLowerCase())
    if (clash) return setError(`${clash.name} is already in the list.`)
    const fields = {
      name,
      handle: cleanHandle(form.handle) || cleanHandle(name),
      site: cleanSite(form.site),
      about: form.about.trim(),
      initials: initialsOf(name),
    }
    if (account) {
      updateAccount(account.id, fields)
      onSaved?.(account.id)
    } else {
      const id = accountIdFor(name, accounts)
      addAccount({ id, ...fields })
      onSaved?.(id)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={460}
      labelledBy="cq-biz-title"
      title={account ? `Edit ${account.name}` : 'Add a business'}
      description={account ? undefined : 'It shows up in every "For" list and in the filters. Only the name is needed.'}
      footer={
        <>
          <button className="cq-btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="cq-btn-primary" onClick={submit}>
            {account ? 'Save changes' : 'Add business'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="cq-biz-name" className="cq-field-label">
            Business name
          </label>
          <input
            id="cq-biz-name"
            data-autofocus
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            aria-invalid={!!error}
            aria-describedby={error ? 'cq-biz-error' : undefined}
            className="cq-input"
            placeholder="Brown Mountain Beach Resort"
            autoComplete="off"
          />
          {error && (
            <p id="cq-biz-error" className="mt-1.5 text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="cq-biz-handle" className="cq-field-label">
              Social handle
            </label>
            <input id="cq-biz-handle" value={form.handle} onChange={(e) => set({ handle: e.target.value })} className="cq-input" placeholder="@handle" autoComplete="off" autoCapitalize="none" />
          </div>
          <div>
            <label htmlFor="cq-biz-site" className="cq-field-label">
              Website
            </label>
            <input id="cq-biz-site" value={form.site} onChange={(e) => set({ site: e.target.value })} className="cq-input" placeholder="example.com" inputMode="url" autoComplete="off" autoCapitalize="none" />
          </div>
        </div>
        <div>
          <label htmlFor="cq-biz-about" className="cq-field-label">
            What they do
          </label>
          <input id="cq-biz-about" value={form.about} onChange={(e) => set({ about: e.target.value })} className="cq-input" placeholder="Bakery, Asheville" autoComplete="off" />
        </div>
        <p className="text-[13px] text-faint">The handle, website and description are only used by the live post preview.</p>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

// A "For" select with "Add a business" as its last choice. onDialog(true/false) tells a parent
// overlay (the composer) that a dialog is open, so Escape closes only the dialog.
export function AccountSelect({ id, value, onChange, className, onDialog }) {
  const { accounts, accountById } = useQueue()
  const [adding, setAdding] = useState(false)
  const open = (v) => {
    setAdding(v)
    onDialog?.(v)
  }
  // A post can point at a business that was removed; keep it selectable so the value stays.
  const missing = value && !accounts.some((a) => a.id === value)
  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => (e.target.value === ADD ? open(true) : onChange(e.target.value))}
        className={className}
      >
        {missing && <option value={value}>{accountById(value).name}</option>}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
        <option value={ADD}>+ Add a business…</option>
      </select>
      {/* React events bubble out of the dialog's portal; keep its Enter and submit away from the
          form this select sits in (Capture an idea), which would try to add an idea. */}
      <span className="contents" onSubmit={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <BusinessDialog
          open={adding}
          account={null}
          onClose={() => open(false)}
          onSaved={(newId) => {
            onChange(newId)
            open(false)
          }}
        />
      </span>
    </>
  )
}

// The full list: add, edit and remove.
export function BusinessesDialog({ open, onClose, onRemoved }) {
  const { accounts, posts, removeAccount } = useQueue()
  const [editing, setEditing] = useState(undefined) // undefined: closed, null: adding, object: editing
  const [removing, setRemoving] = useState(null)
  const countFor = (id) => posts.filter((p) => p.account === id).length
  const used = removing ? countFor(removing.id) : 0

  return (
    <>
      <Dialog
        open={open && editing === undefined && !removing}
        onClose={onClose}
        width={520}
        labelledBy="cq-bizlist-title"
        title="Businesses"
        description="Who posts can be for. Add clients here as you take them on."
        footer={
          <>
            <button className="cq-btn-quiet" onClick={onClose}>
              Done
            </button>
            <button className="cq-btn-primary" data-autofocus onClick={() => setEditing(null)}>
              <Plus size={16} /> Add a business
            </button>
          </>
        }
      >
        <ul className="-my-1 divide-y divide-line">
          {accounts.map((a) => {
            const n = countFor(a.id)
            return (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line2 font-mono text-[12px] text-mute" aria-hidden="true">
                  {a.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-bone">{a.name}</div>
                  <div className="truncate text-[13px] text-faint">
                    {n === 1 ? '1 post' : `${n} posts`}
                    {a.site ? ` · ${a.site}` : ''}
                  </div>
                </div>
                <button className="cq-icon-btn" aria-label={`Edit ${a.name}`} onClick={() => setEditing(a)}>
                  <Pencil size={16} />
                </button>
                {a.id === HOME_ACCOUNT ? (
                  <span className="w-10" aria-hidden="true" />
                ) : (
                  <button className="cq-icon-btn hover:text-danger" aria-label={`Remove ${a.name}`} onClick={() => setRemoving(a)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </Dialog>

      <BusinessDialog open={open && editing !== undefined} account={editing || null} onClose={() => setEditing(undefined)} onSaved={() => setEditing(undefined)} />

      <Dialog
        open={open && !!removing}
        onClose={() => setRemoving(null)}
        width={440}
        labelledBy="cq-bizrm-title"
        title={`Remove ${removing?.name}?`}
        description={
          used
            ? `${used === 1 ? '1 post is' : `${used} posts are`} for this business. ${used === 1 ? 'It stays' : 'They stay'} in the queue and show as "Removed business" until you pick someone else.`
            : 'It comes off every "For" list. No posts use it.'
        }
        footer={
          <>
            <button className="cq-btn-quiet" data-autofocus onClick={() => setRemoving(null)}>
              Cancel
            </button>
            <button
              className="cq-btn cq-btn-quiet border-danger/50 text-danger hover:bg-danger/10"
              onClick={() => {
                removeAccount(removing.id)
                onRemoved?.(removing)
                setRemoving(null)
              }}
            >
              Remove business
            </button>
          </>
        }
      />
    </>
  )
}
