import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Returns the single most-recently-started running timer across all projects,
// along with its project's id and name. Used by the global navbar/floating
// indicator so the user can see a timer ticking even after they navigate away
// from the project page. Paused timers are intentionally ignored — only an
// actively-running clock surfaces here.
//
// Source of truth lives in Supabase. We refresh on three signals so the pill
// stays in sync even when Realtime is unavailable (e.g. the timers table has
// not yet been added to the supabase_realtime publication):
//   1. Realtime postgres_changes on the timers table — primary, instant.
//   2. A periodic poll every 15s — fallback when Realtime is off.
//   3. visibilitychange — refresh the moment the user returns to the tab.
// Project name is joined client-side from a separate lookup.
const POLL_INTERVAL_MS = 15_000

export function useRunningTimer() {
  const [data, setData] = useState(null) // { projectId, name, startedAt, accumulatedSeconds }

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

  // Realtime subscription — fires immediately when the timers row is
  // inserted/updated/deleted, including from another tab.
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

  // Polling fallback — covers the case where the timers table is not yet
  // included in the supabase_realtime publication. 15s is a low enough
  // interval that the pill never feels stale and a low enough query rate
  // that it's effectively free.
  useEffect(() => {
    const id = setInterval(() => { refetch() }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refetch])

  // Refresh as soon as the tab/app comes back into focus — most useful on
  // mobile where iOS pauses background timers and sockets.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetch])

  return data
}
