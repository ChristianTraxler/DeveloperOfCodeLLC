import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Returns the single most-recently-started running timer across all projects,
// along with its project's id and name. Used by the global navbar/floating
// indicator so the user can see a timer ticking even after they navigate away
// from the project page. Paused timers are intentionally ignored — only an
// actively-running clock surfaces here.
//
// Source of truth lives in Supabase. The hook fetches on mount and listens on
// the `timers` channel via Realtime; on any change it refetches. Project name
// is joined client-side from a separate lookup keyed by `project_id`.
export function useRunningTimer() {
  const [data, setData] = useState(null) // { projectId, name, startedAt }

  const refetch = useCallback(async () => {
    const { data: rows } = await supabase
      .from('timers')
      .select('project_id, started_at, accumulated_seconds')
      .not('started_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)

    const row = rows && rows[0]
    if (!row) { setData(null); return }

    const { data: project } = await supabase
      .from('projects').select('name').eq('id', row.project_id).maybeSingle()

    setData({
      projectId: row.project_id,
      name: project?.name || '',
      startedAt: row.started_at,
      accumulatedSeconds: row.accumulated_seconds || 0,
    })
  }, [])

  useEffect(() => { refetch() }, [refetch])

  useEffect(() => {
    const channel = supabase
      .channel('running-timer')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timers' },
        () => refetch()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refetch])

  return data
}
