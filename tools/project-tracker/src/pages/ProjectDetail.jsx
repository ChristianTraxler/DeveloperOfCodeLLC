import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Github, ExternalLink, Edit2, Trash2, Plus,
  Clock, Calendar, MessageSquare, CheckSquare, AlertTriangle,
  Rocket, FileText, ChevronRight, Play, Pause, Square
} from 'lucide-react'
import { useProject } from '../hooks/useProjects'
import { supabase } from '../lib/supabase'
import { groupNotesByMonth } from '../lib/changelog'
import StatusBadge, { CategoryBadge, LiveBadge } from '../components/StatusBadge'
import TechTag from '../components/TechTag'
import { timerState, elapsedSeconds, secondsToHours, formatHMS } from '../lib/timer'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { project, tasks, timeEntries, notes, timer, loading, refetch, refetchTimer } = useProject(id)

  if (loading && !project) return <div className="text-muted font-mono">Loading…</div>
  if (!project) return <div className="text-muted">Project not found.</div>

  const done = tasks.filter(t => t.done).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const totalHours = timeEntries.reduce((s, e) => s + Number(e.hours || 0), 0)

  const deleteProject = async () => {
    if (!confirm(`Delete "${project.name}"?\n\nThis permanently removes the project and ALL of its tasks, time entries, and notes. This cannot be undone.`)) return
    await supabase.from('projects').delete().eq('id', id)
    navigate('/projects')
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-mono text-muted hover:text-accent">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Header */}
      <div className="surface overflow-hidden">
        {project.hero_image_url && (
          <div className="w-full h-56 overflow-hidden border-b border-ink-700">
            <img src={project.hero_image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CategoryBadge category={project.category} />
                <StatusBadge status={project.status} />
                {project.in_production && <LiveBadge />}
                {project.client_name && (
                  <span className="text-sm text-muted font-mono">· {project.client_name}</span>
                )}
              </div>
              <h1 className="text-3xl font-display font-bold text-bone">{project.name}</h1>
              {project.description && (
                <p className="text-muted mt-2 max-w-2xl">{project.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Link to={`/projects/${id}/edit`} className="btn-secondary flex items-center gap-1.5">
                <Edit2 size={14} /> Edit
              </Link>
              <button onClick={deleteProject} className="btn-secondary text-muted hover:!text-red-400 hover:!border-red-400/40 flex items-center gap-1.5">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {project.tech_stack && project.tech_stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {project.tech_stack.map(t => <TechTag key={t} name={t} />)}
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-sm font-mono">
            {project.repo_url && (
              <a href={project.repo_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-muted hover:text-accent">
                <Github size={14} /> Repo
              </a>
            )}
            {project.live_url && (
              <a href={project.live_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-muted hover:text-accent">
                <ExternalLink size={14} /> Live site
              </a>
            )}
            {project.start_date && (
              <span className="flex items-center gap-1.5 text-muted">
                <Calendar size={14} /> Started {project.start_date}
              </span>
            )}
            {project.target_date && (
              <span className="flex items-center gap-1.5 text-muted">
                <Calendar size={14} /> Target {project.target_date}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-1">Progress</div>
          <div className="text-2xl font-display font-bold text-bone mb-2">
            {done} / {total} <span className="text-accent text-xl">({pct}%)</span>
          </div>
          <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${pct}%`, boxShadow: pct > 0 ? '0 0 10px rgba(255,69,0,0.5)' : 'none' }}
            />
          </div>
        </div>
        <div className="surface p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-1">Hours</div>
          <div className="text-2xl font-display font-bold text-bone">{totalHours.toFixed(1)}</div>
          <div className="text-xs text-muted font-mono mt-1">{timeEntries.length} entries</div>
        </div>
        <div className="surface p-5">
          <div className="text-xs font-mono uppercase tracking-wider text-muted mb-1">Activity</div>
          <div className="text-2xl font-display font-bold text-bone">{notes.length}</div>
          <div className="text-xs text-muted font-mono mt-1">notes & milestones</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskList projectId={id} tasks={tasks} onChange={refetch} />
        <div className="space-y-6">
          <TimeLog projectId={id} entries={timeEntries} timer={timer} onChange={refetch} onTimerChange={refetchTimer} />
          <NotesTimeline projectId={id} notes={notes} onChange={refetch} />
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Task checklist — the core "checkmark progress as I build" feature
// ============================================================
function TaskList({ projectId, tasks, onChange }) {
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = async (task) => {
    await supabase.from('tasks').update({ done: !task.done }).eq('id', task.id)
    onChange()
  }

  const remove = async (id) => {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    onChange()
  }

  const add = async (e) => {
    e.preventDefault()
    if (!newLabel.trim() || busy) return
    setBusy(true)
    const position = tasks.length
    await supabase.from('tasks').insert({
      project_id: projectId,
      label: newLabel.trim(),
      position,
    })
    setNewLabel('')
    setBusy(false)
    onChange()
  }

  return (
    <div className="surface p-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare size={16} className="text-accent" />
        <h2 className="font-display font-bold text-bone">Progress Checklist</h2>
      </div>

      <form onSubmit={add} className="flex gap-2 mb-4">
        <input
          value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          placeholder="Add a task or milestone…"
        />
        <button type="submit" disabled={busy || !newLabel.trim()} className="btn-primary disabled:opacity-50 flex-shrink-0">
          <Plus size={16} />
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="text-sm text-muted font-mono py-4 text-center">
          No tasks yet. Add your first step above.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map(t => (
            <li
              key={t.id}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-ink-800/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggle(t)}
              />
              <span className={`flex-1 text-sm ${t.done ? 'text-muted line-through' : 'text-bone'}`}>
                {t.label}
              </span>
              <button
                onClick={() => remove(t.id)}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-opacity"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================
// Time tracking
// ============================================================
function TimeLog({ projectId, entries, timer, onChange, onTimerChange }) {
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [now, setNow] = useState(() => Date.now())

  const state = timerState(timer)

  // Tick once a second only while running; frozen while paused or absent.
  useEffect(() => {
    if (state !== 'running') return
    const handle = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(handle)
  }, [state])

  const startTimer = async () => {
    await supabase.from('timers').insert({
      project_id: projectId,
      started_at: new Date().toISOString(),
      accumulated_seconds: 0,
    })
    setNow(Date.now())
    onTimerChange()
  }

  const pauseTimer = async () => {
    await supabase.from('timers').update({
      accumulated_seconds: elapsedSeconds(timer),
      started_at: null,
    }).eq('project_id', projectId)
    onTimerChange()
  }

  const resumeTimer = async () => {
    await supabase.from('timers').update({
      started_at: new Date().toISOString(),
    }).eq('project_id', projectId)
    setNow(Date.now())
    onTimerChange()
  }

  const stopTimer = async () => {
    const total = elapsedSeconds(timer)
    await supabase.from('timers').delete().eq('project_id', projectId)
    setHours(String(secondsToHours(total)))
    onTimerChange()
  }

  const add = async (e) => {
    e.preventDefault()
    const h = parseFloat(hours)
    if (!h || h <= 0) return
    await supabase.from('time_entries').insert({
      project_id: projectId,
      hours: h,
      note: note || null,
      logged_on: date,
    })
    setHours('')
    setNote('')
    onChange()
  }

  const remove = async (id) => {
    if (!confirm('Delete this time entry?')) return
    await supabase.from('time_entries').delete().eq('id', id)
    onChange()
  }

  return (
    <div className="surface p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-accent" />
        <h2 className="font-display font-bold text-bone">Time Log</h2>
      </div>

      {/* Work timer */}
      {state === 'none' ? (
        <button
          onClick={startTimer}
          className="btn-secondary w-full flex items-center justify-center gap-2 mb-4"
        >
          <Play size={14} /> Start timer
        </button>
      ) : (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-ink-800/60 border border-ink-700">
          <span className="font-mono text-xl font-bold text-bone tabular-nums">
            {formatHMS(elapsedSeconds(timer, now))}
          </span>
          {state === 'running' ? (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-accent">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> running
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted">
              <Pause size={11} /> paused
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {state === 'running' ? (
              <button onClick={pauseTimer} className="btn-secondary !py-1.5 !px-3 flex items-center gap-1.5">
                <Pause size={13} /> Pause
              </button>
            ) : (
              <button onClick={resumeTimer} className="btn-secondary !py-1.5 !px-3 flex items-center gap-1.5">
                <Play size={13} /> Resume
              </button>
            )}
            <button onClick={stopTimer} className="btn-primary !py-1.5 !px-3 flex items-center gap-1.5">
              <Square size={13} /> Stop
            </button>
          </div>
        </div>
      )}

      <form onSubmit={add} className="space-y-2 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.25"
            min="0"
            value={hours}
            onChange={e => setHours(e.target.value)}
            placeholder="Hours"
          />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What did you work on? (optional)"
        />
        <button type="submit" className="btn-primary w-full" disabled={!hours}>
          Log time
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-muted font-mono text-center py-3">No time logged yet.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {entries.map(e => (
            <li key={e.id} className="group flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-ink-800/50">
              <span className="text-accent font-mono text-sm font-bold whitespace-nowrap">
                {Number(e.hours).toFixed(2)}h
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted font-mono">{e.logged_on}</div>
                {e.note && <div className="text-sm text-bone mt-0.5 truncate">{e.note}</div>}
              </div>
              <button
                onClick={() => remove(e.id)}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ============================================================
// Notes / changelog timeline
// ============================================================
const NOTE_KINDS = [
  { value: 'note',      label: 'Note',      Icon: FileText,        color: 'text-muted' },
  { value: 'milestone', label: 'Milestone', Icon: CheckSquare,     color: 'text-emerald-400' },
  { value: 'blocker',   label: 'Blocker',   Icon: AlertTriangle,   color: 'text-amber-400' },
  { value: 'release',   label: 'Release',   Icon: Rocket,          color: 'text-accent' },
]

// Commit bodies arrive hard-wrapped at ~72 columns (git convention), so a
// sentence that continues naturally still shows a line break mid-thought.
// Re-flow each paragraph back into one line so it wraps at the container edge
// instead — while keeping blank-line paragraph breaks and the changed-files
// list (git name-status lines like "M  path") exactly as they are.
function reflowDetails(text) {
  return text
    .split(/\n{2,}/)
    .map(block => {
      const lines = block.split('\n')
      const isFileList = lines.every(l =>
        /^[A-Z]\d*\s{2,}\S/.test(l) || /^…/.test(l)
      )
      return isFileList ? block : lines.join(' ').replace(/[ \t]+/g, ' ').trim()
    })
    .join('\n\n')
}

function NoteItem({ n, onRemove }) {
  const [open, setOpen] = useState(false)
  const k = NOTE_KINDS.find(x => x.value === n.kind) || NOTE_KINDS[0]
  const Icon = k.Icon
  const hasDetails = Boolean(n.details && n.details.trim())

  return (
    <li className="group relative pl-7">
      <span className={`absolute left-0 top-0.5 ${k.color}`}>
        <Icon size={14} />
      </span>

      <div
        className={`text-sm text-bone whitespace-pre-wrap break-words flex items-start gap-1 ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={hasDetails ? () => setOpen(o => !o) : undefined}
      >
        {hasDetails && (
          <ChevronRight
            size={14}
            className={`mt-0.5 shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
          />
        )}
        <span>{n.body}</span>
      </div>

      {hasDetails && open && (
        <pre className="mt-2 ml-1 p-3 rounded-lg bg-ink-950/60 border border-ink-700 text-xs text-muted font-mono whitespace-pre-wrap break-words">{reflowDetails(n.details)}</pre>
      )}

      <div className="flex items-center gap-2 mt-1">
        <span className={`text-[10px] font-mono uppercase tracking-wider ${k.color}`}>
          {k.label}
        </span>
        <span className="text-[10px] font-mono text-muted">
          {new Date(n.created_at).toLocaleString()}
        </span>
        {hasDetails && (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-[10px] font-mono text-muted hover:text-bone transition-colors"
          >
            {open ? 'hide details' : 'details'}
          </button>
        )}
        <button
          onClick={() => onRemove(n.id)}
          className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-opacity ml-auto"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </li>
  )
}

function NotesTimeline({ projectId, notes, onChange }) {
  const [body, setBody] = useState('')
  const [kind, setKind] = useState('note')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [openMonths, setOpenMonths] = useState(() => new Set())

  const add = async (e) => {
    e.preventDefault()
    if (!body.trim()) return
    await supabase.from('notes').insert({
      project_id: projectId,
      body: body.trim(),
      kind,
    })
    setBody('')
    setKind('note')
    onChange()
  }

  const remove = async (id) => {
    if (!confirm('Delete this note?')) return
    await supabase.from('notes').delete().eq('id', id)
    onChange()
  }

  // Current calendar month stays up top; everything older tucks into a
  // collapsed Year › Month archive. The split is derived from each note's date,
  // so notes move on their own when the month flips — see lib/changelog.js.
  const { current, archived } = groupNotesByMonth(notes)
  const archivedCount = archived.reduce(
    (sum, y) => sum + y.months.reduce((s, m) => s + m.notes.length, 0),
    0
  )

  const toggleMonth = (key) =>
    setOpenMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="surface p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-accent" />
        <h2 className="font-display font-bold text-bone">Notes & Changelog</h2>
      </div>

      <form onSubmit={add} className="space-y-2 mb-4">
        <textarea
          rows={2}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="What changed? What did you learn?"
        />
        <div className="flex gap-2">
          <select value={kind} onChange={e => setKind(e.target.value)} className="flex-1">
            {NOTE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <button type="submit" disabled={!body.trim()} className="btn-primary disabled:opacity-50">
            Add
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-muted font-mono text-center py-3">No notes yet.</p>
      ) : (
        <>
          {/* Current month — always open */}
          <div className="mb-4">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2">
              {current.label}
            </h3>
            {current.notes.length === 0 ? (
              <p className="text-sm text-muted font-mono py-1">No notes this month yet.</p>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {current.notes.map(n => (
                  <NoteItem key={n.id} n={n} onRemove={remove} />
                ))}
              </ul>
            )}
          </div>

          {/* Archive — collapsed by default, grouped Year › Month */}
          {archivedCount > 0 && (
            <div className="border-t border-ink-700 pt-3">
              <button
                onClick={() => setArchiveOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted hover:text-bone transition-colors"
              >
                <ChevronRight
                  size={14}
                  className={`transition-transform ${archiveOpen ? 'rotate-90' : ''}`}
                />
                Archived ({archivedCount})
              </button>

              {archiveOpen && (
                <div className="mt-3 space-y-4 max-h-80 overflow-y-auto pr-1">
                  {archived.map(yearGroup => (
                    <div key={yearGroup.year}>
                      <h4 className="text-[11px] font-mono tracking-wider text-muted/70 mb-1.5">
                        {yearGroup.label}
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        {yearGroup.months.map(m => {
                          const open = openMonths.has(m.key)
                          return (
                            <div key={m.key}>
                              <button
                                onClick={() => toggleMonth(m.key)}
                                className="flex items-center gap-1.5 w-full text-left text-sm text-bone hover:text-accent transition-colors"
                              >
                                <ChevronRight
                                  size={13}
                                  className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}
                                />
                                <span>{m.label}</span>
                                <span className="text-[10px] font-mono text-muted">({m.notes.length})</span>
                              </button>
                              {open && (
                                <ul className="space-y-3 mt-2 mb-2 pl-3">
                                  {m.notes.map(n => (
                                    <NoteItem key={n.id} n={n} onRemove={remove} />
                                  ))}
                                </ul>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
