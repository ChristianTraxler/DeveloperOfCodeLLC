// The Mail tool for the Developer of Code Admin Hub.
//
//   <MailTool api={api} path={subPath} navigate={(sub) => ...} />
//
// api:      createGmailApi({ supabase }) in the admin, createDemoApi() in the preview
// path:     the part of the route after "mail/", for example "f/SENT" or "f/INBOX/t/18c2..."
// navigate: called with a new sub-path; the host turns it into its own route (#/mail/<sub>)
import './mail.css'
import { ToastProvider } from './ui/Toast.jsx'
import { MailProvider } from './state/MailContext.jsx'
import { MailShell } from './views/MailShell.jsx'

export function MailTool({ api, path = '', navigate }) {
  return (
    <ToastProvider>
      <MailProvider api={api}>
        <MailShell path={path} navigate={navigate} />
      </MailProvider>
    </ToastProvider>
  )
}
