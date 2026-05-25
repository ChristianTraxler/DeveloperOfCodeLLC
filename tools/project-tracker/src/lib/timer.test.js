import { describe, it, expect } from 'vitest'
import { timerState, elapsedSeconds, secondsToHours, formatHMS } from './timer'

describe('timerState', () => {
  it('is "none" when there is no timer row', () => {
    expect(timerState(null)).toBe('none')
    expect(timerState(undefined)).toBe('none')
  })
  it('is "running" when started_at is set', () => {
    expect(timerState({ started_at: new Date().toISOString(), accumulated_seconds: 0 })).toBe('running')
  })
  it('is "paused" when started_at is null', () => {
    expect(timerState({ started_at: null, accumulated_seconds: 100 })).toBe('paused')
  })
})

describe('elapsedSeconds', () => {
  it('is 0 for no timer', () => {
    expect(elapsedSeconds(null)).toBe(0)
  })
  it('returns banked seconds while paused (ignores now)', () => {
    expect(elapsedSeconds({ started_at: null, accumulated_seconds: 42 }, 9_999_999)).toBe(42)
  })
  it('adds the running segment to banked seconds', () => {
    const timer = { started_at: new Date(1_000_000).toISOString(), accumulated_seconds: 10 }
    expect(elapsedSeconds(timer, 1_005_000)).toBe(15) // +5s running
  })
  it('floors partial seconds of the running segment', () => {
    const timer = { started_at: new Date(1_000_000).toISOString(), accumulated_seconds: 0 }
    expect(elapsedSeconds(timer, 1_005_999)).toBe(5)
  })
  it('never goes negative if the clock is skewed', () => {
    const timer = { started_at: new Date(2_000_000).toISOString(), accumulated_seconds: 7 }
    expect(elapsedSeconds(timer, 1_000_000)).toBe(7)
  })
})

describe('secondsToHours', () => {
  it('converts whole hours', () => {
    expect(secondsToHours(3600)).toBe(1)
    expect(secondsToHours(5400)).toBe(1.5)
  })
  it('rounds to 2 decimals', () => {
    expect(secondsToHours(5025)).toBe(1.4)   // 1.3958… -> 1.40
    expect(secondsToHours(30)).toBe(0.01)    // 0.0083… -> 0.01
  })
  it('is 0 for 0 seconds', () => {
    expect(secondsToHours(0)).toBe(0)
  })
})

describe('formatHMS', () => {
  it('formats zero', () => {
    expect(formatHMS(0)).toBe('00:00:00')
  })
  it('formats h:m:s with zero padding', () => {
    expect(formatHMS(5025)).toBe('01:23:45')
    expect(formatHMS(3661)).toBe('01:01:01')
  })
  it('floors fractional input and clamps negatives', () => {
    expect(formatHMS(61.9)).toBe('00:01:01')
    expect(formatHMS(-5)).toBe('00:00:00')
  })
})
