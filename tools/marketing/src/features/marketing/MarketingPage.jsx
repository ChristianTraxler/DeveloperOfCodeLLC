// Entry point for the Marketing tool inside the Admin Hub.
//
// Props:
//   path      the part of the route after /marketing, for example '', 'people', 'report/c12' or 'edit/c12'
//   navigate  function(subPath) that moves within the tool, for example navigate('people')
import { useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { Plus, Settings2 } from 'lucide-react'
import { MarketingProvider, useMarketing } from './MarketingContext.jsx'
import { ToastProvider, useToast } from './ui/Toast.jsx'
import { Button } from './ui/core.jsx'
import { Tabs } from './ui/fields.jsx'
import { Sheet } from './ui/Sheet.jsx'
import { EmailFrame } from './ui/EmailFrame.jsx'
import { DeviceSwitch, InboxMock, PhoneFrame, PreviewAs } from './ui/preview.jsx'
import { resolveAudience } from './data/segments.js'
import { Home } from './home/Home.jsx'
import { People } from './people/People.jsx'
import { SettingsSheet } from './settings/SettingsSheet.jsx'
import { Studio } from './studio/Studio.jsx'
import { Report } from './report/Report.jsx'
import './marketing.css'

const EASE = [0.2, 0.7, 0.2, 1]

function PreviewSheet({ id, onClose, onEdit }) {
  const { campaigns, contacts, settings, now } = useMarketing()
  const campaign = campaigns.find((c) => c.id === id)
  const [device, setDevice] = useState('phone')
  const [person, setPerson] = useState(null)
  const people = campaign ? resolveAudience(contacts, campaign.audience, now).recipients : []
  const contact = person || people[0] || contacts[0]
  return (
    <Sheet
      open={!!campaign}
      onClose={onClose}
      kicker="Preview"
      title={campaign?.name || ''}
      width={760}
      footer={
        campaign && (
          <>
            <Button variant="quiet" onClick={onClose}>
              Close
            </Button>
            {campaign.status !== 'sent' && (
              <Button variant="solid" className="ml-auto" onClick={() => onEdit(campaign.id)}>
                Edit this email
              </Button>
            )}
          </>
        )
      }
    >
      {campaign && (
        <div className="space-y-4">
          <InboxMock campaign={campaign} contact={contact} />
          <div className="flex flex-wrap items-center gap-2">
            <DeviceSwitch value={device} onChange={setDevice} />
            <PreviewAs people={people.length ? people : contacts} value={contact} onChange={setPerson} className="ml-auto w-full max-w-[280px]" />
          </div>
          <div className="mk-desk h-[68vh] min-h-[480px] rounded-[20px] p-3 sm:p-5">
            {device === 'phone' ? (
              <PhoneFrame className="max-w-[360px]">
                <EmailFrame campaign={campaign} settings={settings} contact={contact} interactive={false} />
              </PhoneFrame>
            ) : (
              <div className="h-full overflow-hidden rounded-[14px] ring-1 ring-white/10">
                <EmailFrame campaign={campaign} settings={settings} contact={contact} interactive={false} />
              </div>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Inner({ path, navigate }) {
  const { campaigns, contacts, actions } = useMarketing()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsFocus, setSettingsFocus] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [seg, id] = String(path || '').split('/')
  const tab = seg === 'people' ? 'people' : 'emails'
  const openSettings = (focus = null) => {
    setSettingsFocus(focus)
    setSettingsOpen(true)
  }
  const newEmail = () => {
    const newId = actions.createFromTemplate('blank')
    navigate(`edit/${newId}`)
  }

  return (
    <>
      {seg === 'report' ? (
        <Report id={id} navigate={navigate} onPreview={setPreviewId} />
      ) : (
        <main className="mx-auto max-w-[1120px] px-4 pb-28 pt-10 sm:px-6 sm:pt-16 lg:px-10" {...(seg === 'edit' ? { inert: '', 'aria-hidden': true } : {})}>
          <header className="mb-10 sm:mb-14">
            <motion.h1
              initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, ease: EASE }}
              className="display text-[clamp(52px,14.5vw,112px)] leading-[0.88]"
            >
              Marketing
            </motion.h1>
            <p className="mt-6 max-w-[48ch] text-[16.5px] leading-relaxed text-mute sm:text-[17px]">Emails to your clients and leads. Write one, pick who gets it, then see who opened, clicked and reached out.</p>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Tabs
                value={tab}
                onChange={(v) => navigate(v === 'people' ? 'people' : '')}
                tabs={[
                  { value: 'emails', label: 'Emails', count: campaigns.length },
                  { value: 'people', label: 'People', count: contacts.length },
                ]}
              />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => openSettings()} aria-label="Sender settings" className="max-sm:w-10 max-sm:px-0">
                  <Settings2 size={16} />
                  <span className="max-sm:hidden">Settings</span>
                </Button>
                <Button variant="ember" size="sm" onClick={newEmail}>
                  <Plus size={16} /> New email
                </Button>
              </div>
            </div>
          </header>
          {tab === 'people' ? <People /> : <Home navigate={navigate} onOpenSettings={() => openSettings('address')} onPreview={setPreviewId} />}
        </main>
      )}

      <AnimatePresence>{seg === 'edit' && id && <Studio key={id} id={id} navigate={navigate} onOpenSettings={openSettings} />}</AnimatePresence>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} focus={settingsFocus} />
      <PreviewSheet
        id={previewId}
        onClose={() => setPreviewId(null)}
        onEdit={(cid) => {
          setPreviewId(null)
          navigate(`edit/${cid}`)
        }}
      />
    </>
  )
}

export default function MarketingPage({ path = '', navigate = () => {} }) {
  const existing = useMarketing()
  const body = (
    <ToastProvider>
      <MotionConfig reducedMotion="user">
        <Inner path={path} navigate={navigate} />
      </MotionConfig>
    </ToastProvider>
  )
  return existing ? body : <MarketingProvider>{body}</MarketingProvider>
}

export { useToast }
