// Who emails come from, where replies go, and the footer details the law asks for.
import { useEffect, useState } from 'react'
import { useMarketing } from '../MarketingContext.jsx'
import { Sheet } from '../ui/Sheet.jsx'
import { Button } from '../ui/core.jsx'
import { Field, Input, Textarea } from '../ui/fields.jsx'
import { useToast } from '../ui/Toast.jsx'

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim())

export function SettingsSheet({ open, onClose, focus }) {
  const { settings, actions } = useMarketing()
  const toast = useToast()
  const [form, setForm] = useState(settings)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setForm(settings)
      setErrors({})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const save = (e) => {
    e.preventDefault()
    const next = {}
    if (!form.fromName.trim()) next.fromName = 'Add the name people will see.'
    if (!isEmail(form.fromEmail)) next.fromEmail = 'Enter an email address on your own domain.'
    if (!isEmail(form.replyTo)) next.replyTo = 'Enter the inbox you check for replies.'
    if (form.testEmail && !isEmail(form.testEmail)) next.testEmail = 'Enter an email address, or leave it blank.'
    setErrors(next)
    if (Object.keys(next).length) return
    actions.updateSettings({ ...form, mailingAddress: form.mailingAddress.trim() })
    toast('Settings saved')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker="Marketing"
      title="Sender settings"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ember" className="ml-auto" type="submit" form="mk-settings">
            Save settings
          </Button>
        </>
      }
    >
      <form id="mk-settings" onSubmit={save} className="space-y-8" noValidate>
        <fieldset className="space-y-5">
          <legend className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">Who it's from</legend>
          <Field label="From name" htmlFor="s-from" error={errors.fromName} hint="A person's name gets opened more often than a company name.">
            <Input id="s-from" value={form.fromName} onChange={(e) => set({ fromName: e.target.value })} size="sm" />
          </Field>
          <Field label="Sending address" htmlFor="s-addr" error={errors.fromEmail} hint="Must be on a domain you verify for sending, such as developerofcode.com.">
            <Input id="s-addr" type="email" value={form.fromEmail} onChange={(e) => set({ fromEmail: e.target.value })} size="sm" />
          </Field>
          <Field label="Replies go to" htmlFor="s-reply" error={errors.replyTo} hint="Use an inbox you check. Replies from clients land here.">
            <Input id="s-reply" type="email" value={form.replyTo} onChange={(e) => set({ replyTo: e.target.value })} size="sm" />
          </Field>
          <Field label="Send tests to" htmlFor="s-test" error={errors.testEmail}>
            <Input id="s-test" type="email" value={form.testEmail} onChange={(e) => set({ testEmail: e.target.value })} size="sm" />
          </Field>
        </fieldset>

        <fieldset className="space-y-5">
          <legend className="mb-4 text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">Footer details</legend>
          <Field label="Business name" htmlFor="s-legal">
            <Input id="s-legal" value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} size="sm" />
          </Field>
          <Field label="Mailing address" htmlFor="s-mail" hint="Required in every marketing email. A P.O. box or a private mailbox works.">
            <Textarea id="s-mail" data-autofocus={focus === 'address' ? true : undefined} value={form.mailingAddress} onChange={(e) => set({ mailingAddress: e.target.value })} rows={3} placeholder={'Street or P.O. box\nCity, NC ZIP'} />
          </Field>
          <Field label="Phone shown in emails" htmlFor="s-phone">
            <Input id="s-phone" type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} size="sm" />
          </Field>
        </fieldset>
      </form>
    </Sheet>
  )
}
