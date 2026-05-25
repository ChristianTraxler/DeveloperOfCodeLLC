// Pure helpers for the per-project work timer.
// A timer row is { started_at: string|null (ISO), accumulated_seconds: number }
// or null/undefined when no timer exists.

export function timerState(timer) {
  if (!timer) return 'none'
  return timer.started_at ? 'running' : 'paused'
}

// Total elapsed whole seconds. While running, add (now - started_at) to the
// banked seconds; while paused, just the banked seconds. `now` is ms epoch.
export function elapsedSeconds(timer, now = Date.now()) {
  if (!timer) return 0
  const banked = timer.accumulated_seconds || 0
  if (!timer.started_at) return banked
  const startedMs = new Date(timer.started_at).getTime()
  const running = Math.max(0, Math.floor((now - startedMs) / 1000))
  return banked + running
}

// Seconds -> decimal hours, rounded to 2 dp to match numeric(6,2).
export function secondsToHours(seconds) {
  return Math.round((seconds / 3600) * 100) / 100
}

// Seconds -> "HH:MM:SS".
export function formatHMS(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
