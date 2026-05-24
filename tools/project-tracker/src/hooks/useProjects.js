import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('*, tasks(id, done), time_entries(hours)')
      .order('updated_at', { ascending: false })

    if (error) setError(error.message)
    else setProjects(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = async (payload) => {
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single()
    if (!error) await fetchProjects()
    return { data, error }
  }

  const updateProject = async (id, patch) => {
    const { error } = await supabase.from('projects').update(patch).eq('id', id)
    if (!error) await fetchProjects()
    return { error }
  }

  const deleteProject = async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (!error) await fetchProjects()
    return { error }
  }

  return { projects, loading, error, fetchProjects, createProject, updateProject, deleteProject }
}

export function useProject(id) {
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: p }, { data: t }, { data: te }, { data: n }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('project_id', id).order('position'),
      supabase.from('time_entries').select('*').eq('project_id', id).order('logged_on', { ascending: false }),
      supabase.from('notes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    ])
    setProject(p)
    setTasks(t || [])
    setTimeEntries(te || [])
    setNotes(n || [])
    setLoading(false)
  }, [id])

  const refetchNotes = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('notes').select('*').eq('project_id', id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }, [id])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Live updates: when a note is inserted/changed for this project (e.g. from a
  // git commit), refresh just the changelog — no page refresh, no loading flash.
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`notes-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `project_id=eq.${id}` },
        () => refetchNotes()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id, refetchNotes])

  return { project, tasks, timeEntries, notes, loading, refetch }
}
