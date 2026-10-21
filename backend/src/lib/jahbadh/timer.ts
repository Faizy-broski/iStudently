// GENERATED from packages/shared-utils/src/jahbadh/timer.ts by scripts/sync-jahbadh-engine.sh — do not edit.
// Jahbadh exam room timer («مؤقت امتحانات جهبذ», brief Part D): pure state and rules, shared by the
// web page and the app. The screens keep the state (and persist it, for reload continuity); every
// function here takes `now` so the countdown is always computed from the clock, never from ticks.

export type JtAssessment = 'final' | 'term' | 'certificate' | 'second_round' | 'short' | 'monthly' | 'oral' | 'practical'
export type JtLang = 'ar' | 'en'
export type JtDisplay = 'digits' | 'ring' | 'auto'
export type JtVoice = 'off' | 'beep' | 'speech' | 'clips'
export type JtExitRule = 'off' | 'half' | 'third' | 'quarter'
export type JtTrackStatus = 'idle' | 'scheduled' | 'running' | 'paused' | 'finished'

export const JT_ASSESSMENTS: { key: JtAssessment; exam: boolean }[] = [
  { key: 'final', exam: true },
  { key: 'term', exam: true },
  { key: 'certificate', exam: true },
  { key: 'second_round', exam: true },
  { key: 'short', exam: false },
  { key: 'monthly', exam: false },
  { key: 'oral', exam: false },
  { key: 'practical', exam: false },
]
export const jtIsExam = (a: JtAssessment) => JT_ASSESSMENTS.find((x) => x.key === a)?.exam ?? true

export interface JtTrack {
  id: string
  grade: string
  /** Official grade code 1–14 when known (picks the ring display for grades 1–3). */
  gradeCode: number | null
  subject: string
  durationMin: number
  /** Minutes added to the whole track during the exam. */
  addedMin: number
  startedAt: number | null
  pausedAt: number | null
  pausedMs: number
  finishedAt: number | null
  /** Scheduled start (epoch ms) for auto-start; null = manual. */
  scheduledAt: number | null
}

export interface JtSeatExtra {
  seat: string
  minutes: number
  /** Index of the track (0-based); seats belong to the first track unless given. */
  track: number
}

export type JtEventKind = 'start' | 'pause' | 'resume' | 'add_time' | 'seat_extra' | 'announce' | 'finish' | 'reset' | 'unlock' | 'auto_start' | 'exit_allowed'
export interface JtEvent {
  at: number
  kind: JtEventKind
  track?: number
  text?: string
  minutes?: number
}

export interface JtState {
  version: 1
  stage: 'basic' | 'secondary'
  assessment: JtAssessment
  period: string
  room: string
  tracks: JtTrack[]
  extras: JtSeatExtra[]
  announcement: string
  display: JtDisplay
  voice: JtVoice
  exitRule: JtExitRule
  englishAuto: boolean
  autoStart: boolean
  pin: string
  unlockedUntil: number
  attendance: { present: number; total: number }
  /** Alert keys already fired, per track ("0:15" = track 0, 15 minutes left). */
  fired: string[]
  events: JtEvent[]
  /** Exam control link (schedule import, minutes attachment), when used. */
  link: { sessionId: string; dayId: string; committeeId: string | null } | null
}

let seq = 0
export const jtNewId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`

export function jtNewTrack(partial: Partial<JtTrack> = {}): JtTrack {
  return { id: jtNewId(), grade: '', gradeCode: null, subject: '', durationMin: 120, addedMin: 0, startedAt: null, pausedAt: null, pausedMs: 0, finishedAt: null, scheduledAt: null, ...partial }
}

export function jtInitialState(): JtState {
  return {
    version: 1, stage: 'basic', assessment: 'final', period: '', room: '', tracks: [jtNewTrack()], extras: [], announcement: '', display: 'auto', voice: 'speech',
    exitRule: 'half', englishAuto: true, autoStart: true, pin: '', unlockedUntil: 0, attendance: { present: 0, total: 0 }, fired: [], events: [], link: null,
  }
}

export const JT_MAX_TRACKS = 3

// ---- countdown ------------------------------------------------------------------------------------------

export const jtTotalMs = (t: JtTrack) => (t.durationMin + t.addedMin) * 60_000

export function jtElapsed(t: JtTrack, now: number): number {
  if (t.startedAt === null) return 0
  const end = t.finishedAt ?? t.pausedAt ?? now
  return Math.max(0, end - t.startedAt - t.pausedMs)
}

export const jtRemaining = (t: JtTrack, now: number, extraMin = 0) => Math.max(0, jtTotalMs(t) + extraMin * 60_000 - jtElapsed(t, now))

export function jtStatus(t: JtTrack, now: number): JtTrackStatus {
  if (t.finishedAt !== null) return 'finished'
  if (t.startedAt === null) return t.scheduledAt !== null && t.scheduledAt > now ? 'scheduled' : 'idle'
  if (t.pausedAt !== null) return 'paused'
  return jtRemaining(t, now) <= 0 ? 'finished' : 'running'
}

/** Start now, or — when opened after the scheduled time — as if started on schedule (real remaining time). */
export function jtStart(t: JtTrack, now: number): JtTrack {
  const startedAt = t.scheduledAt !== null && t.scheduledAt <= now && now - t.scheduledAt < jtTotalMs(t) ? t.scheduledAt : now
  return { ...t, startedAt, pausedAt: null, pausedMs: 0, finishedAt: null }
}
export const jtPause = (t: JtTrack, now: number): JtTrack => (t.startedAt === null || t.pausedAt !== null || t.finishedAt !== null ? t : { ...t, pausedAt: now })
export const jtResume = (t: JtTrack, now: number): JtTrack => (t.pausedAt === null ? t : { ...t, pausedMs: t.pausedMs + (now - t.pausedAt), pausedAt: null })
export const jtAddTime = (t: JtTrack, minutes: number): JtTrack => ({ ...t, addedMin: Math.max(-t.durationMin, t.addedMin + minutes), finishedAt: null })
export const jtFinish = (t: JtTrack, now: number): JtTrack => ({ ...t, finishedAt: t.finishedAt ?? now })
export const jtReset = (t: JtTrack): JtTrack => ({ ...t, startedAt: null, pausedAt: null, pausedMs: 0, finishedAt: null, addedMin: 0 })

/** End time (epoch ms) of a running track, with optional seat extra minutes; null when not running. */
export function jtEndsAt(t: JtTrack, now: number, extraMin = 0): number | null {
  if (t.startedAt === null || t.pausedAt !== null) return null
  return now + jtRemaining(t, now, extraMin)
}

const EXIT_FRACTION: Record<JtExitRule, number | null> = { off: null, half: 1 / 2, third: 1 / 3, quarter: 1 / 4 }

/** Students may leave once this share of the time has passed (½, ⅓ or ¼). */
export function jtExitAllowed(t: JtTrack, now: number, rule: JtExitRule): boolean {
  const f = EXIT_FRACTION[rule]
  if (f === null || t.startedAt === null) return false
  return jtElapsed(t, now) >= f * t.durationMin * 60_000
}

/** Ring progress 0–1 (share of the time left). */
export const jtProgress = (t: JtTrack, now: number) => (jtTotalMs(t) ? jtRemaining(t, now) / jtTotalMs(t) : 0)

export function jtClock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

export function jtTimeOfDay(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ---- alerts ---------------------------------------------------------------------------------------------

/** Minutes-left marks that trigger a voice alert. */
export const JT_ALERT_MARKS = [30, 15, 5, 1] as const
export type JtAlertKey = `left_${(typeof JT_ALERT_MARKS)[number]}` | 'end' | 'exit' | 'start'

/**
 * Alerts that became due; `fired` holds the ids already played ("0:left_15"). Marks only fire when the
 * track is longer than the mark. An alert more than a minute late (after a reload) is returned in
 * `stale` instead, so the room is not flooded: add both lists' ids to `fired`.
 */
export function jtDueAlerts(tracks: JtTrack[], now: number, fired: string[], exitRule: JtExitRule): { due: { track: number; key: JtAlertKey; id: string }[]; stale: string[] } {
  const out: { track: number; key: JtAlertKey; id: string }[] = []
  const stale: string[] = []
  tracks.forEach((t, i) => {
    if (t.startedAt === null || t.pausedAt !== null) return
    const rem = jtRemaining(t, now)
    const elapsed = jtElapsed(t, now)
    const due = (key: JtAlertKey, crossedAt: number) => {
      const id = `${i}:${key}`
      if (fired.includes(id)) return
      if (crossedAt <= 60_000) out.push({ track: i, key, id })
      else stale.push(id)
    }
    if (elapsed < 60_000) due('start', elapsed)
    for (const m of JT_ALERT_MARKS) if (t.durationMin + t.addedMin > m && rem <= m * 60_000) due(`left_${m}`, m * 60_000 - rem)
    if (rem <= 0) due('end', -rem)
    const f = EXIT_FRACTION[exitRule]
    if (f !== null && elapsed >= f * t.durationMin * 60_000) due('exit', elapsed - f * t.durationMin * 60_000)
  })
  return { due: out, stale }
}

const NUM_AR: Record<number, string> = { 1: 'دقيقة واحدة', 5: 'خمس دقائق', 15: 'خمس عشرة دقيقة', 30: 'ثلاثون دقيقة' }

/** Spoken text of an alert. */
export function jtAlertSpeech(key: JtAlertKey, lang: JtLang, subject = ''): string {
  if (lang === 'en') {
    if (key === 'start') return `The ${subject ? `${subject} ` : ''}exam has started. Good luck.`
    if (key === 'end') return 'Time is up. Please stop writing and put your pens down.'
    if (key === 'exit') return 'Students who have finished may now leave quietly.'
    const m = Number(key.split('_')[1])
    return m === 1 ? 'One minute left.' : `${m} minutes left.`
  }
  if (key === 'start') return `بدأ امتحان ${subject || 'المادة'}، بالتوفيق للجميع.`
  if (key === 'end') return 'انتهى الوقت، يرجى التوقف عن الكتابة ووضع الأقلام.'
  if (key === 'exit') return 'يُسمح الآن بالخروج لمن أنهى إجابته بهدوء.'
  return `تبقّى ${NUM_AR[Number(key.split('_')[1])]} على نهاية الامتحان.`
}

// ---- display, language, texts ------------------------------------------------------------------------

/** Automatic display: the ring for young pupils (grades 1–3), large digits for everyone else. */
export function jtDisplayFor(mode: JtDisplay, tracks: JtTrack[]): 'digits' | 'ring' {
  if (mode !== 'auto') return mode
  const codes = tracks.map((t) => t.gradeCode).filter((c): c is number => c !== null)
  return codes.length && codes.every((c) => c <= 3) ? 'ring' : 'digits'
}

const ENGLISH = /english|انجليز|إنجليز|الإنكليزية|الانكليزية/i
/**
 * Board language: the app's language (English UI → English board); an Arabic board switches to English
 * when the room runs a single English track (setting on by default).
 */
export const jtLangFor = (s: Pick<JtState, 'tracks' | 'englishAuto'>, uiLang = 'ar'): JtLang =>
  uiLang.startsWith('en') || (s.englishAuto && s.tracks.length === 1 && ENGLISH.test(s.tracks[0].subject)) ? 'en' : 'ar'

export const JT_TEXT = {
  ar: {
    title: { final: 'الامتحان النهائي', term: 'امتحان نهاية الفترة', certificate: 'امتحان الشهادة', second_round: 'امتحان الدور الثاني', short: 'اختبار قصير', monthly: 'اختبار شهري', oral: 'اختبار شفوي', practical: 'اختبار عملي' } as Record<JtAssessment, string>,
    remaining: 'الوقت المتبقي',
    endsAt: 'ينتهي في',
    notStarted: 'لم يبدأ',
    startsAt: 'يبدأ في',
    paused: 'متوقف مؤقتاً',
    finished: 'انتهى الوقت',
    exitAllowed: 'يُسمح بالخروج',
    exitNotYet: 'لا يُسمح بالخروج',
    extraTime: 'وقت إضافي',
    seat: 'رقم الجلوس',
    attendance: 'الحضور',
    noise: 'مستوى الضوضاء',
    locked: 'مقفل',
    examRules: ['أبقِ هاتفك مغلقاً وخارج الطاولة.', 'لا يُسمح بالحديث أو تبادل الأدوات.', 'اكتب رقم جلوسك بوضوح على ورقة الإجابة.', 'ارفع يدك إذا احتجت إلى المراقب.', 'راجع إجابتك قبل التسليم.'],
    testRules: ['اقرأ الأسئلة بهدوء.', 'اكتب اسمك على الورقة.', 'ارفع يدك إذا احتجت مساعدة.'],
  },
  en: {
    title: { final: 'Final exam', term: 'End-of-term exam', certificate: 'Certificate exam', second_round: 'Second-round exam', short: 'Short test', monthly: 'Monthly test', oral: 'Oral test', practical: 'Practical test' } as Record<JtAssessment, string>,
    remaining: 'Time left',
    endsAt: 'Ends at',
    notStarted: 'Not started',
    startsAt: 'Starts at',
    paused: 'Paused',
    finished: "Time's up",
    exitAllowed: 'You may leave',
    exitNotYet: 'No leaving yet',
    extraTime: 'Extra time',
    seat: 'Seat',
    attendance: 'Attendance',
    noise: 'Noise level',
    locked: 'Locked',
    examRules: ['Keep your phone switched off and away from the desk.', 'No talking or sharing of tools.', 'Write your seat number clearly on the answer sheet.', 'Raise your hand if you need the invigilator.', 'Check your answers before handing in.'],
    testRules: ['Read the questions calmly.', 'Write your name on the paper.', 'Raise your hand if you need help.'],
  },
} as const

export const jtRules = (a: JtAssessment, lang: JtLang) => (jtIsExam(a) ? JT_TEXT[lang].examRules : JT_TEXT[lang].testRules)

// ---- input parsing ----------------------------------------------------------------------------------------

const digitsLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** Extra time per seat: one per line, «6012 15» (seat, minutes) or «6012 15 2» (track 2). */
export function jtParseExtras(text: string, trackCount = 1): { extras: JtSeatExtra[]; errors: number[] } {
  const extras: JtSeatExtra[] = []
  const errors: number[] = []
  digitsLatin(text)
    .split(/\r?\n/)
    .forEach((line, i) => {
      const parts = line.trim().split(/[\s,:;،+]+/).filter(Boolean)
      if (!parts.length) return
      const [seat, min, tr] = parts
      const minutes = Number(min)
      const track = tr ? Number(tr) - 1 : 0
      if (!/^\d+$/.test(seat ?? '') || !Number.isFinite(minutes) || minutes <= 0 || minutes > 240 || !Number.isInteger(track) || track < 0 || track >= trackCount) errors.push(i + 1)
      else {
        const prev = extras.findIndex((x) => x.seat === seat)
        const row = { seat, minutes, track }
        if (prev >= 0) extras[prev] = row
        else extras.push(row)
      }
    })
  return { extras, errors }
}

export const jtExtrasText = (extras: JtSeatExtra[]) => extras.map((x) => `${x.seat} ${x.minutes}${x.track ? ` ${x.track + 1}` : ''}`).join('\n')

/**
 * A pasted timetable: one exam per line, «08:00 الرياضيات 120», optionally with a date first
 * («2026-11-02 08:00 …») and the grade last after a «/» («… 120 / الصف السابع»).
 */
export function jtParseSchedule(text: string, today: string): { rows: { date: string; time: string; subject: string; durationMin: number; grade: string }[]; errors: number[] } {
  const rows: { date: string; time: string; subject: string; durationMin: number; grade: string }[] = []
  const errors: number[] = []
  digitsLatin(text)
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim()
      if (!line) return
      const m = line.match(/^(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}):(\d{2})\s+(.+?)\s+(\d{1,3})(?:\s*\/\s*(.+))?$/)
      if (!m) return errors.push(i + 1)
      const [, date, hh, mm, subject, dur, grade] = m
      if (Number(hh) > 23 || Number(mm) > 59 || Number(dur) <= 0) return errors.push(i + 1)
      rows.push({ date: date ?? today, time: `${hh.padStart(2, '0')}:${mm}`, subject: subject.trim(), durationMin: Number(dur), grade: (grade ?? '').trim() })
    })
  return { rows, errors }
}

/** Epoch ms of a local date + time («2026-11-02», «08:00»). */
export function jtLocalTime(date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime()
}

// ---- tick, PIN, minutes ---------------------------------------------------------------------------------

/** Applies auto-start and auto-finish; returns the new state and the events it produced (or null when unchanged). */
export function jtTick(s: JtState, now: number): JtState | null {
  let changed = false
  const events: JtEvent[] = []
  const tracks = s.tracks.map((t, i) => {
    if (s.autoStart && t.startedAt === null && t.finishedAt === null && t.scheduledAt !== null && t.scheduledAt <= now && now - t.scheduledAt < jtTotalMs(t)) {
      changed = true
      events.push({ at: now, kind: 'auto_start', track: i })
      return jtStart(t, now)
    }
    if (t.startedAt !== null && t.finishedAt === null && t.pausedAt === null && jtRemaining(t, now) <= 0) {
      changed = true
      const at = t.startedAt + t.pausedMs + jtTotalMs(t)
      events.push({ at, kind: 'finish', track: i })
      return { ...t, finishedAt: at }
    }
    return t
  })
  return changed ? { ...s, tracks, events: [...s.events, ...events] } : null
}

export const JT_UNLOCK_MS = 2 * 60_000
export const jtLocked = (s: Pick<JtState, 'pin' | 'unlockedUntil'>, now: number) => !!s.pin && now >= s.unlockedUntil

const EVENT_TEXT: Record<JtLang, Record<JtEventKind, string>> = {
  ar: { start: 'بدء', pause: 'إيقاف مؤقت', resume: 'استئناف', add_time: 'إضافة وقت', seat_extra: 'وقت إضافي لمقعد', announce: 'إعلان', finish: 'انتهاء', reset: 'إعادة ضبط', unlock: 'فتح القفل', auto_start: 'بدء تلقائي', exit_allowed: 'السماح بالخروج' },
  en: { start: 'Start', pause: 'Pause', resume: 'Resume', add_time: 'Time added', seat_extra: 'Seat extra time', announce: 'Announcement', finish: 'End', reset: 'Reset', unlock: 'Unlocked', auto_start: 'Auto start', exit_allowed: 'Exit allowed' },
}

/** Plain-text minutes of the session (copy, print, attach to the committee's exam-day record). */
export function jtMinutes(s: JtState, lang: JtLang, header: { school?: string; date?: string } = {}): string {
  const T = JT_TEXT[lang]
  const L = lang === 'ar'
  const lines: string[] = []
  lines.push(L ? 'محضر مؤقت الامتحان' : 'Exam timer minutes')
  if (header.school) lines.push(header.school)
  lines.push(`${T.title[s.assessment]}${s.period ? ` — ${s.period}` : ''}${s.room ? ` — ${L ? 'القاعة' : 'Room'} ${s.room}` : ''}${header.date ? ` — ${header.date}` : ''}`)
  s.tracks.forEach((t, i) => {
    const mins = t.durationMin + t.addedMin
    lines.push(`${L ? 'المسار' : 'Track'} ${i + 1}: ${t.grade} — ${t.subject} — ${mins} ${L ? 'دقيقة' : 'min'}${t.addedMin ? ` (${t.addedMin > 0 ? '+' : ''}${t.addedMin})` : ''}`)
  })
  if (s.extras.length) lines.push(`${T.extraTime}: ${s.extras.map((x) => `${x.seat} +${x.minutes}`).join('، ')}`)
  if (s.attendance.total) lines.push(`${T.attendance}: ${s.attendance.present}/${s.attendance.total}`)
  lines.push('')
  for (const e of s.events) {
    const tr = e.track !== undefined && s.tracks.length > 1 ? ` [${e.track + 1}]` : ''
    const extra = e.minutes ? ` ${e.minutes > 0 ? '+' : ''}${e.minutes}` : ''
    lines.push(`${jtTimeOfDay(e.at)}  ${EVENT_TEXT[lang][e.kind]}${tr}${extra}${e.text ? ` — ${e.text}` : ''}`)
  }
  return lines.join('\n')
}

/** Restores a persisted state (reload continuity); anything unreadable starts fresh. */
export function jtRestore(raw: string | null | undefined): JtState {
  try {
    const s = raw ? (JSON.parse(raw) as JtState) : null
    if (s && s.version === 1 && Array.isArray(s.tracks) && s.tracks.length) return { ...jtInitialState(), ...s }
  } catch {
    // fall through
  }
  return jtInitialState()
}
