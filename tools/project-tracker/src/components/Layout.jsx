import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Plus, LayoutGrid, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Layout({ children }) {
  const { pathname } = useLocation()

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
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="code-tag text-xl font-bold tracking-tight">&lt;/DOC&gt;</span>
            <span className="hidden sm:block w-px h-5 bg-ink-600" />
            <span className="hidden sm:block text-xs uppercase tracking-[0.18em] text-muted font-mono">
              Project Tracker
            </span>
          </Link>
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
              <span>New</span>
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
