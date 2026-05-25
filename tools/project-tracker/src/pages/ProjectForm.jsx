import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProjects } from '../hooks/useProjects'

const STATUSES = ['planning', 'active', 'paused', 'completed', 'archived']

const EMPTY = {
  name: '',
  description: '',
  category: 'personal',
  status: 'planning',
  in_production: false,
  client_name: '',
  repo_url: '',
  live_url: '',
  hero_image_url: '',
  tech_stack: [],
  start_date: '',
  target_date: '',
}

export default function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { createProject, updateProject } = useProjects()
  const [form, setForm] = useState(EMPTY)
  const [techInput, setTechInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          ...data,
          start_date: data.start_date || '',
          target_date: data.target_date || '',
          tech_stack: data.tech_stack || [],
        })
      }
    })
  }, [id, isEdit])

  const update = (patch) => setForm(f => ({ ...f, ...patch }))

  const addTech = (raw) => {
    const t = raw.trim()
    if (!t || form.tech_stack.includes(t)) return
    update({ tech_stack: [...form.tech_stack, t] })
  }

  const removeTech = (t) => {
    update({ tech_stack: form.tech_stack.filter(x => x !== t) })
  }

  const onTechKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTech(techInput)
      setTechInput('')
    } else if (e.key === 'Backspace' && !techInput && form.tech_stack.length) {
      removeTech(form.tech_stack[form.tech_stack.length - 1])
    }
  }

  const handleImage = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    const ext = file.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('project-images')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (upErr) {
      setError(upErr.message)
    } else {
      const { data } = supabase.storage.from('project-images').getPublicUrl(path)
      update({ hero_image_url: data.publicUrl })
    }
    setUploading(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      category: form.category,
      status: form.status,
      in_production: form.in_production,
      client_name: form.client_name || null,
      repo_url: form.repo_url || null,
      live_url: form.live_url || null,
      hero_image_url: form.hero_image_url || null,
      tech_stack: form.tech_stack,
      start_date: form.start_date || null,
      target_date: form.target_date || null,
      completed_date: form.status === 'completed' ? (form.completed_date || new Date().toISOString().slice(0, 10)) : null,
    }
    const result = isEdit
      ? await updateProject(id, payload)
      : await createProject(payload)
    setSaving(false)
    if (result.error) {
      setError(result.error.message || 'Save failed.')
    } else {
      navigate(isEdit ? `/projects/${id}` : '/projects')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-mono text-muted hover:text-accent">
        <ArrowLeft size={14} /> Back
      </button>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-accent font-mono mb-2">
          <span className="code-tag">&lt;</span> {isEdit ? 'Edit' : 'New'} <span className="code-tag">/&gt;</span>
        </p>
        <h1 className="text-3xl font-display font-bold text-bone">
          {isEdit ? 'Edit project' : 'New project'}
        </h1>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="surface p-6 space-y-5">
          <Field label="Name *">
            <input value={form.name} onChange={e => update({ name: e.target.value })} placeholder="e.g., TaskFlow" required />
          </Field>

          <Field label="Description">
            <textarea
              rows={3}
              value={form.description || ''}
              onChange={e => update({ description: e.target.value })}
              placeholder="Brief summary of what this project does"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select value={form.category} onChange={e => update({ category: e.target.value })}>
                <option value="personal">Personal</option>
                <option value="client">Client</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => update({ status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-muted mb-1.5 block">
              Production
            </span>
            <button
              type="button"
              onClick={() => update({ in_production: !form.in_production })}
              aria-pressed={form.in_production}
              className={`inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border font-mono text-sm uppercase tracking-wider transition-all ${
                form.in_production
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                  : 'border-ink-600 text-muted hover:border-emerald-400/30 hover:text-emerald-300'
              }`}
            >
              {form.in_production ? (
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-sonar motion-reduce:hidden" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-ink-500" />
              )}
              {form.in_production ? 'In production · Live' : 'Mark as in production'}
            </button>
          </div>

          {form.category === 'client' && (
            <Field label="Client name">
              <input value={form.client_name || ''} onChange={e => update({ client_name: e.target.value })} placeholder="e.g., Renegade Wellness Center" />
            </Field>
          )}
        </div>

        <div className="surface p-6 space-y-5">
          <h2 className="text-sm font-mono uppercase tracking-wider text-accent">Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="GitHub repo URL">
              <input value={form.repo_url || ''} onChange={e => update({ repo_url: e.target.value })} placeholder="https://github.com/…" />
            </Field>
            <Field label="Live URL">
              <input value={form.live_url || ''} onChange={e => update({ live_url: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
        </div>

        <div className="surface p-6 space-y-5">
          <h2 className="text-sm font-mono uppercase tracking-wider text-accent">Tech stack</h2>
          <Field label="Tags (press Enter or comma to add)">
            <input
              value={techInput}
              onChange={e => setTechInput(e.target.value)}
              onKeyDown={onTechKey}
              placeholder="React, Supabase, Tailwind…"
            />
          </Field>
          {form.tech_stack.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.tech_stack.map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono border border-accent/40 text-accent bg-accent/5">
                  {t}
                  <button type="button" onClick={() => removeTech(t)} className="hover:text-bone">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="surface p-6 space-y-5">
          <h2 className="text-sm font-mono uppercase tracking-wider text-accent">Hero image</h2>
          {form.hero_image_url && (
            <div className="relative">
              <img src={form.hero_image_url} alt="" className="w-full max-h-64 object-cover rounded-lg border border-ink-700" />
              <button
                type="button"
                onClick={() => update({ hero_image_url: '' })}
                className="absolute top-2 right-2 bg-ink-950/80 backdrop-blur p-2 rounded-lg border border-ink-600 hover:border-red-400 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer w-fit">
            <Upload size={14} />
            {uploading ? 'Uploading…' : form.hero_image_url ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </label>
        </div>

        <div className="surface p-6 space-y-5">
          <h2 className="text-sm font-mono uppercase tracking-wider text-accent">Timeline</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <input type="date" value={form.start_date || ''} onChange={e => update({ start_date: e.target.value })} />
            </Field>
            <Field label="Target date">
              <input type="date" value={form.target_date || ''} onChange={e => update({ target_date: e.target.value })} />
            </Field>
          </div>
        </div>

        {error && (
          <div className="surface p-4 border-red-400/40 bg-red-400/5 text-red-300 text-sm font-mono">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-mono uppercase tracking-wider text-muted mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  )
}
