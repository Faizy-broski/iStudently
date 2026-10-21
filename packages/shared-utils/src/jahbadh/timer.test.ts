import { describe, expect, it } from 'vitest'

import {
  jtAddTime, jtClock, jtDisplayFor, jtDueAlerts, jtElapsed, jtExitAllowed, jtInitialState, jtLangFor, jtLocalTime, jtLocked, jtMinutes, jtNewTrack,
  jtParseExtras, jtParseSchedule, jtPause, jtRemaining, jtRestore, jtResume, jtStart, jtStatus, jtTick,
} from './timer'

const MIN = 60_000
const T0 = new Date(2026, 10, 2, 8, 0, 0).getTime()

describe('exam timer countdown', () => {
  it('counts down from the clock, with pauses and added time', () => {
    let t = jtStart(jtNewTrack({ durationMin: 120 }), T0)
    expect(jtRemaining(t, T0 + 30 * MIN)).toBe(90 * MIN)
    t = jtPause(t, T0 + 30 * MIN)
    expect(jtRemaining(t, T0 + 40 * MIN)).toBe(90 * MIN)
    expect(jtStatus(t, T0 + 40 * MIN)).toBe('paused')
    t = jtResume(t, T0 + 40 * MIN)
    expect(jtElapsed(t, T0 + 50 * MIN)).toBe(40 * MIN)
    t = jtAddTime(t, 10)
    expect(jtRemaining(t, T0 + 50 * MIN)).toBe(90 * MIN)
    expect(jtRemaining(t, T0 + 50 * MIN, 15)).toBe(105 * MIN)
    expect(jtStatus(t, T0 + 200 * MIN)).toBe('finished')
  })

  it('opened late, it aligns to the scheduled start (real remaining time)', () => {
    const t = jtStart(jtNewTrack({ durationMin: 90, scheduledAt: T0 }), T0 + 20 * MIN)
    expect(jtRemaining(t, T0 + 20 * MIN)).toBe(70 * MIN)
  })

  it('auto-starts at the scheduled time and auto-finishes', () => {
    const s = { ...jtInitialState(), tracks: [jtNewTrack({ durationMin: 60, scheduledAt: T0 })] }
    expect(jtTick(s, T0 - 1000)).toBeNull()
    const started = jtTick(s, T0 + 5000)!
    expect(started.tracks[0].startedAt).toBe(T0)
    expect(started.events.at(-1)?.kind).toBe('auto_start')
    const done = jtTick(started, T0 + 61 * MIN)!
    expect(done.tracks[0].finishedAt).toBe(T0 + 60 * MIN)
  })

  it('exit is allowed after ½, ⅓ or ¼ of the time', () => {
    const t = jtStart(jtNewTrack({ durationMin: 120 }), T0)
    expect(jtExitAllowed(t, T0 + 59 * MIN, 'half')).toBe(false)
    expect(jtExitAllowed(t, T0 + 60 * MIN, 'half')).toBe(true)
    expect(jtExitAllowed(t, T0 + 40 * MIN, 'third')).toBe(true)
    expect(jtExitAllowed(t, T0 + 30 * MIN, 'quarter')).toBe(true)
    expect(jtExitAllowed(t, T0 + 119 * MIN, 'off')).toBe(false)
  })

  it('fires each alert once and skips stale ones after a reload', () => {
    const t = jtStart(jtNewTrack({ durationMin: 60 }), T0)
    const at15 = jtDueAlerts([t], T0 + 45 * MIN + 1000, ['0:start'], 'off')
    expect(at15.due.map((d) => d.key)).toEqual(['left_15'])
    expect(at15.stale).toEqual(['0:left_30'])
    expect(jtDueAlerts([t], T0 + 45 * MIN + 2000, ['0:start', '0:left_30', '0:left_15'], 'off').due).toEqual([])
  })

  it('clock and local time', () => {
    expect(jtClock(90 * MIN)).toBe('1:30:00')
    expect(jtClock(5 * MIN + 1)).toBe('05:01')
    expect(jtLocalTime('2026-11-02', '08:00')).toBe(T0)
  })
})

describe('exam timer settings', () => {
  it('parses extra time per seat («6012 15»), with Arabic digits and a track', () => {
    const r = jtParseExtras('6012 15\n٦٠١٣ ١٠\n6014 20 2\nbad\n6015 0', 2)
    expect(r.extras).toEqual([
      { seat: '6012', minutes: 15, track: 0 },
      { seat: '6013', minutes: 10, track: 0 },
      { seat: '6014', minutes: 20, track: 1 },
    ])
    expect(r.errors).toEqual([4, 5])
  })

  it('parses a pasted timetable', () => {
    const r = jtParseSchedule('08:00 الرياضيات 120\n2026-11-03 9:30 اللغة العربية 90 / الصف السابع\nxx', '2026-11-02')
    expect(r.rows).toEqual([
      { date: '2026-11-02', time: '08:00', subject: 'الرياضيات', durationMin: 120, grade: '' },
      { date: '2026-11-03', time: '09:30', subject: 'اللغة العربية', durationMin: 90, grade: 'الصف السابع' },
    ])
    expect(r.errors).toEqual([3])
  })

  it('ring for grades 1–3 in automatic mode; English screen for a single English track', () => {
    expect(jtDisplayFor('auto', [jtNewTrack({ gradeCode: 2 })])).toBe('ring')
    expect(jtDisplayFor('auto', [jtNewTrack({ gradeCode: 2 }), jtNewTrack({ gradeCode: 7 })])).toBe('digits')
    expect(jtLangFor({ englishAuto: true, tracks: [jtNewTrack({ subject: 'اللغة الإنجليزية' })] })).toBe('en')
    expect(jtLangFor({ englishAuto: true, tracks: [jtNewTrack({ subject: 'English' }), jtNewTrack({ subject: 'رياضيات' })] })).toBe('ar')
    expect(jtLangFor({ englishAuto: false, tracks: [jtNewTrack({ subject: 'English' })] })).toBe('ar')
    expect(jtLangFor({ englishAuto: false, tracks: [jtNewTrack({ subject: 'رياضيات' })] }, 'en')).toBe('en')
  })

  it('PIN lock opens for two minutes', () => {
    expect(jtLocked({ pin: '', unlockedUntil: 0 }, T0)).toBe(false)
    expect(jtLocked({ pin: '1234', unlockedUntil: T0 + 2 * MIN }, T0)).toBe(false)
    expect(jtLocked({ pin: '1234', unlockedUntil: T0 + 2 * MIN }, T0 + 2 * MIN)).toBe(true)
  })

  it('writes minutes and restores a saved state', () => {
    const s = { ...jtInitialState(), tracks: [jtNewTrack({ grade: 'السابع', subject: 'الرياضيات', durationMin: 120 })], events: [{ at: T0, kind: 'start' as const, track: 0 }] }
    const text = jtMinutes(s, 'ar', { school: 'مدرسة' })
    expect(text).toContain('محضر مؤقت الامتحان')
    expect(text).toContain('08:00  بدء')
    expect(jtRestore(JSON.stringify(s)).tracks[0].subject).toBe('الرياضيات')
    expect(jtRestore('{broken').tracks).toHaveLength(1)
  })
})
