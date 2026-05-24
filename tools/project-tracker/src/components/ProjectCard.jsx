import { Link } from 'react-router-dom'
import { Github, ExternalLink, Clock } from 'lucide-react'
import StatusBadge, { CategoryBadge } from './StatusBadge'
import TechTag from './TechTag'

export default function ProjectCard({ project }) {
  const tasks = project.tasks || []
  const done = tasks.filter(t => t.done).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const hours = (project.time_entries || []).reduce((sum, e) => sum + Number(e.hours || 0), 0)

  return (
    <Link
      to={`/projects/${project.id}`}
      className="surface surface-hover p-5 block transition-all hover:shadow-glow group"
    >
      {project.hero_image_url && (
        <div className="aspect-video -mx-5 -mt-5 mb-4 overflow-hidden rounded-t-xl border-b border-ink-700">
          <img
            src={project.hero_image_url}
            alt={project.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CategoryBadge category={project.category} />
            {project.client_name && (
              <span className="text-xs text-muted truncate font-mono">{project.client_name}</span>
            )}
          </div>
          <h3 className="text-lg font-display font-bold text-bone group-hover:text-accent transition-colors truncate">
            {project.name}
          </h3>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {project.description && (
        <p className="text-sm text-muted line-clamp-2 mb-4">{project.description}</p>
      )}

      {project.tech_stack && project.tech_stack.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {project.tech_stack.slice(0, 4).map((t) => (
            <TechTag key={t} name={t} />
          ))}
          {project.tech_stack.length > 4 && (
            <span className="text-[11px] text-muted font-mono leading-none">+{project.tech_stack.length - 4}</span>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs font-mono text-muted mb-1.5">
            <span>{done} / {total} tasks</span>
            <span className="text-accent">{pct}%</span>
          </div>
          <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${pct}%`, boxShadow: pct > 0 ? '0 0 10px rgba(255,69,0,0.5)' : 'none' }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted font-mono mt-4 pt-3 border-t border-ink-800">
        <div className="flex items-center gap-3">
          {hours > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {hours.toFixed(1)}h
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project.repo_url && (
            <span className="text-muted hover:text-accent" title="Has repo">
              <Github size={13} />
            </span>
          )}
          {project.live_url && (
            <span className="text-muted hover:text-accent" title="Live URL">
              <ExternalLink size={13} />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
