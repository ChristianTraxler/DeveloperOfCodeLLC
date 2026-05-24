import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Filter as FilterIcon } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import ProjectCard from '../components/ProjectCard'
import TechTag from '../components/TechTag'

const STATUSES = ['planning', 'active', 'paused', 'completed', 'archived']
const CATEGORIES = ['all', 'client', 'personal']

export default function Projects() {
  const { projects, loading } = useProjects()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [activeTech, setActiveTech] = useState(new Set())

  const allTech = useMemo(() => {
    const set = new Set()
    projects.forEach(p => (p.tech_stack || []).forEach(t => set.add(t)))
    return [...set].sort()
  }, [projects])

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (category !== 'all' && p.category !== category) return false
      if (status !== 'all' && p.status !== status) return false
      if (search && !`${p.name} ${p.description || ''} ${p.client_name || ''}`.toLowerCase().includes(search.toLowerCase())) return false
      if (activeTech.size > 0) {
        const stack = new Set(p.tech_stack || [])
        for (const t of activeTech) if (!stack.has(t)) return false
      }
      return true
    })
  }, [projects, category, status, search, activeTech])

  const toggleTech = (t) => {
    const next = new Set(activeTech)
    next.has(t) ? next.delete(t) : next.add(t)
    setActiveTech(next)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-mono mb-2">
            <span className="code-tag">&lt;</span> All Work <span className="code-tag">/&gt;</span>
          </p>
          <h1 className="text-4xl font-display font-bold text-bone">Projects</h1>
        </div>
        <Link to="/projects/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New project
        </Link>
      </div>

      {/* Filter bar */}
      <div className="surface p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
              {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
              <option value="all">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {allTech.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-ink-700/50">
            <FilterIcon size={13} className="text-muted" />
            <span className="text-xs font-mono uppercase tracking-wider text-muted">Stack:</span>
            {allTech.map(t => (
              <TechTag
                key={t}
                name={t}
                active={activeTech.has(t)}
                onClick={() => toggleTech(t)}
              />
            ))}
            {activeTech.size > 0 && (
              <button
                onClick={() => setActiveTech(new Set())}
                className="text-xs font-mono text-muted hover:text-accent ml-2"
              >
                clear
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-muted font-mono py-12 text-center">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="text-muted">No projects match your filters.</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-mono text-muted">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        </>
      )}
    </div>
  )
}
