import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Activity, CheckCircle2, Clock, Briefcase, TrendingUp, AlertCircle } from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { isConfigured } from '../lib/supabase'
import ProjectCard from '../components/ProjectCard'

function StatCard({ icon: Icon, label, value, accent, sub }) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-[0.18em] font-mono text-muted">{label}</span>
        <Icon size={16} className={accent ? 'text-accent' : 'text-muted'} strokeWidth={2} />
      </div>
      <div className="text-3xl font-display font-bold text-bone">{value}</div>
      {sub && <div className="text-xs text-muted mt-1 font-mono">{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { projects, loading } = useProjects()

  const stats = useMemo(() => {
    const allTasks = projects.flatMap(p => p.tasks || [])
    const allTime = projects.flatMap(p => p.time_entries || [])
    return {
      total: projects.length,
      active: projects.filter(p => p.status === 'active').length,
      completed: projects.filter(p => p.status === 'completed').length,
      planning: projects.filter(p => p.status === 'planning').length,
      paused: projects.filter(p => p.status === 'paused').length,
      tasksDone: allTasks.filter(t => t.done).length,
      tasksTotal: allTasks.length,
      hours: allTime.reduce((s, e) => s + Number(e.hours || 0), 0),
      clientProjects: projects.filter(p => p.category === 'client').length,
      personalProjects: projects.filter(p => p.category === 'personal').length,
    }
  }, [projects])

  const overallPct = stats.tasksTotal > 0 ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0

  if (!isConfigured) {
    return (
      <div className="surface p-8 border-amber-400/40 bg-amber-400/5">
        <div className="flex gap-4">
          <AlertCircle className="text-amber-400 flex-shrink-0 mt-1" />
          <div>
            <h2 className="font-display text-xl text-bone mb-2">Supabase not configured</h2>
            <p className="text-muted mb-4">
              Create a Supabase project, run <code className="text-accent font-mono text-sm">supabase/schema.sql</code> in the SQL editor, then copy <code className="text-accent font-mono text-sm">.env.example</code> to <code className="text-accent font-mono text-sm">.env.local</code> and fill in your URL and anon key.
            </p>
            <p className="text-sm text-muted font-mono">See README.md for the full walkthrough.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-mono mb-2">
            <span className="code-tag">&lt;</span> Overview <span className="code-tag">/&gt;</span>
          </p>
          <h1 className="text-4xl font-display font-bold text-bone">Dashboard</h1>
          <p className="text-muted mt-2">Every project, every task, every hour — at a glance.</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Briefcase}
          label="Projects"
          value={stats.total}
          sub={`${stats.clientProjects} client · ${stats.personalProjects} personal`}
        />
        <StatCard
          icon={Activity}
          label="Active"
          value={stats.active}
          accent
          sub={`${stats.planning} planning · ${stats.paused} paused`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
          sub={stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% of all` : '—'}
        />
        <StatCard
          icon={Clock}
          label="Hours logged"
          value={stats.hours.toFixed(1)}
          sub="across all projects"
        />
      </div>

      {/* Overall progress bar */}
      {stats.tasksTotal > 0 && (
        <div className="surface p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <span className="text-sm font-mono uppercase tracking-wider text-muted">
                Overall task progress
              </span>
            </div>
            <span className="font-display font-bold text-bone">
              {stats.tasksDone} / {stats.tasksTotal} <span className="text-accent">({overallPct}%)</span>
            </span>
          </div>
          <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-dim to-accent transition-all duration-700"
              style={{ width: `${overallPct}%`, boxShadow: '0 0 14px rgba(255,69,0,0.4)' }}
            />
          </div>
        </div>
      )}

      {/* Recent projects */}
      <div>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-display font-bold text-bone">Recent projects</h2>
          <Link to="/projects" className="text-sm font-mono text-accent hover:underline">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="text-muted font-mono">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="surface p-10 text-center">
            <p className="text-muted mb-4">No projects yet.</p>
            <Link to="/projects/new" className="btn-primary inline-flex">
              Create your first project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.slice(0, 6).map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
