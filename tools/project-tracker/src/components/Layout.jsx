import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Plus, LayoutGrid, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRunningTimer } from '../hooks/useRunningTimer'
import { elapsedSeconds, formatHMS } from '../lib/timer'

export default function Layout({ children }) {
  const { pathname } = useLocation()
  const running = useRunningTimer()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.replace('/admin/login.html')
  }

  const navItem = (to, label, Icon) => {
    const active = pathname === to || (to !== '/' && pathname.startsWith(to))
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono transition-colors ${
          active
            ? 'text-accent bg-ink-800'
            : 'text-muted hover:text-bone hover:bg-ink-800/60'
        }`}
      >
        <Icon size={16} strokeWidth={2} />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="code-tag text-xl font-bold tracking-tight">&lt;/DOC&gt;</span>
            <span className="hidden sm:block w-px h-5 bg-ink-600" />
            <span className="hidden sm:block text-xs uppercase tracking-[0.18em] text-muted font-mono">
              Project Tracker
            </span>
          </Link>

          {/* Desktop only: running-timer pill in the center of the navbar. */}
          <RunningTimerPill running={running} className="hidden md:flex" />

          <nav className="flex items-center gap-1">
            <a
              href="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-mono transition-colors text-muted hover:text-bone hover:bg-ink-800/60"
            >
              <LayoutGrid size={16} strokeWidth={2} />
              <span className="hidden sm:inline">Hub</span>
            </a>
            {navItem('/', 'Dashboard', LayoutDashboard)}
            {navItem('/projects', 'Projects', FolderKanban)}
            <Link
              to="/projects/new"
              className="btn-primary ml-2 flex items-center gap-1.5"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span className="hidden sm:inline">New</span>
            </Link>
            <button
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="ml-1 flex items-center justify-center p-2 rounded-lg text-muted hover:text-accent hover:bg-ink-800/60 transition-colors"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 animate-fade-in">
        {children}
      </main>

      {/* Mobile/tablet only: floating pill so the running timer stays visible
          when the navbar version is hidden. */}
      <RunningTimerFloating running={running} />

      <footer className="border-t border-ink-700/40 mt-20 py-8 text-center text-xs text-muted font-mono">
        <p>
          <span className="code-tag">&lt;/DOC&gt;</span> Project Tracker · Developer of Code, LLC ·{' '}
          <a href="https://developerofcode.com" className="hover:text-accent transition-colors">
            developerofcode.com
          </a>
        </p>
      </footer>
    </div>
  )
}

// Shared 1-second tick so both the navbar pill and the floating pill update
// in lockstep without each component spinning up its own interval.
function useSecondTick(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const handle = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(handle)
  }, [active])
  return now
}

function RunningTimerPill({ running, className = '' }) {
  const now = useSecondTick(Boolean(running))
  if (!running) return null
  // useRunningTimer only returns rows where started_at is set, so we can build
  // the timer object inline for elapsedSeconds.
  const seconds = elapsedSeconds(
    { started_at: running.startedAt, accumulated_seconds: running.accumulatedSeconds },
    now,
  )
  return (
    <Link
      to={`/projects/${running.projectId}`}
      className={`items-center gap-2 px-3 py-1.5 rounded-full bg-ink-800/70 border border-accent/30 text-bone hover:border-accent transition-colors max-w-xs ${className}`}
      title={`Tracking time on ${running.name}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
      <span className="text-xs font-mono truncate">{running.name || 'Project'}</span>
      <span className="text-xs font-mono tabular-nums text-accent">{formatHMS(seconds)}</span>
    </Link>
  )
}

function RunningTimerFloating({ running }) {
  const now = useSecondTick(Boolean(running))
  if (!running) return null
  const seconds = elapsedSeconds(
    { started_at: running.startedAt, accumulated_seconds: running.accumulatedSeconds },
    now,
  )
  return (
    <Link
      to={`/projects/${running.projectId}`}
      className="md:hidden fixed left-1/2 -translate-x-1/2 bottom-4 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink-900/95 backdrop-blur-md border border-accent/40 shadow-lg shadow-accent/10 text-bone max-w-[90vw]"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      title={`Tracking time on ${running.name}`}
    >
      <span className="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
      <span className="text-sm font-mono truncate">{running.name || 'Project'}</span>
      <span className="text-sm font-mono tabular-nums text-accent">{formatHMS(seconds)}</span>
    </Link>
  )
}
