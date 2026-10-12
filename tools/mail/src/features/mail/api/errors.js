// Errors from the mail backend, with wording a person can act on.

export class MailError extends Error {
  constructor(code, message, detail = null) {
    super(message || FRIENDLY[code] || 'Something went wrong.')
    this.code = code || 'server'
    this.detail = detail
  }
}

export const FRIENDLY = {
  signed_out: 'Your admin session ended. Sign in again to keep using Mail.',
  not_allowed: 'This admin login is not allowed to use Mail.',
  not_linked: 'Link your Gmail to start using Mail.',
  reauth: 'Google asked you to link Gmail again. It only takes a moment.',
  rate_limited: 'Gmail asked for a short pause. Try again in a few seconds.',
  network: "Couldn't reach the mail server. Check your connection and try again.",
  too_large: 'Attachments add up to more than 20 MB. Share large files as a link instead.',
  no_recipients: 'Add at least one person to send it to.',
  bad_address: 'One of the addresses is not a valid email.',
  not_found: 'That conversation is gone. It may have been deleted in Gmail.',
  config: 'Mail is missing a setting on the server. See the setup guide.',
  server: 'Something went wrong on the mail server. Try again in a moment.',
  push_off: 'Live updates are not set up on the server yet.',
}

export const friendly = (err) => (err instanceof MailError ? err.message : FRIENDLY.network)
