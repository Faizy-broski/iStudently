/**
 * Soroban mental-math engine — pure logic, no DOM/React. Ported from the
 * reference "سوروبان جهبذ" (Soroban Jahbadh) engine.js almost verbatim
 * (structure, algorithms, and Arabic step-explanation text unchanged), typed
 * for TypeScript. Every exported function here is a straight function of its
 * inputs — safe to unit-test standalone and to call from any of the
 * mental-math tab components.
 */

export interface Ctx {
  n: number
  decimals: number
}

export type StepType = 'direct' | 'five' | 'heaven' | 'ten' | 'ten5' | 'x'

export interface Step {
  text: string
  rod: number
  snap?: number[]
  type: StepType
}

export interface PlanResult {
  ok: boolean
  steps: Step[]
}

export interface CourseConfig {
  n: number
  digits: number
  count: number
  sub: boolean
  allow: StepType[]
  req: StepType[] | null
}

export interface Term {
  sign: '+' | '-'
  v: number
}

export interface ProblemResult {
  terms: Term[]
  total: number
  skills: StepType[]
}

export interface MultPair {
  a: number
  b: number
  place: number
  p: number
}

export interface DivStepOut {
  cur: number
  qd: number
  sub: number
  rem: number
}

export interface CorruptResult {
  digits: number[]
  rod: number
  kind: 'heaven' | 'one' | 'shift'
  delta: number
}

export const PLACES = ['آحاد', 'عشرات', 'مئات', 'ألوف', 'ع. ألوف', 'م. ألوف', 'ملايين', 'ع. ملايين', 'م. ملايين', 'مليارات']
export const DEC_PLACES = ['أعشار', 'أجزاء من مئة']

export function placeName(n: number, decimals: number, i: number): string {
  const off = n - 1 - decimals - i
  return off >= 0 ? PLACES[off] || 'العمود ' + (i + 1) : DEC_PLACES[-off - 1] || 'العمود ' + (i + 1)
}

export function addAt(ctx: Ctx, d: number[], i: number, v: number, out: Step[]): boolean {
  const c = d[i]
  const name = placeName(ctx.n, ctx.decimals, i)
  if (c + v < 10) {
    let txt: string
    let type: StepType
    if (c % 5 + v <= 4) {
      txt = 'أضف ' + v + ' من الخرز السفلي في ' + name + '.'
      type = 'direct'
    } else if (v < 5) {
      txt = 'في ' + name + ': الخرز السفلي لا يكفي — أنزل خرزة الخمسة واسحب ' + (5 - v) + ' (مكوّن ' + v + ' إلى 5).'
      type = 'five'
    } else {
      txt = 'في ' + name + ': أنزل خرزة الخمسة' + (v > 5 ? ' وأضف ' + (v - 5) + ' من السفلي' : '') + '.'
      type = 'heaven'
    }
    d[i] = c + v
    out.push({ text: txt, rod: i, snap: d.slice(), type })
    return true
  }
  if (i === 0) {
    out.push({ text: 'العدد أكبر من سعة المعداد — زد عدد الأعمدة.', rod: -1, type: 'x' })
    return false
  }
  const comp = 10 - v
  const c5 = c % 5
  let inner: string
  let type: StepType
  if (c5 >= comp) {
    inner = 'اسحب ' + comp + ' من الخرز السفلي'
    type = 'ten'
  } else if (comp < 5) {
    inner = 'ارفع خرزة الخمسة وأضف ' + (5 - comp) + ' من السفلي (مكوّن ' + comp + ' إلى 5 داخل مكوّن العشرة)'
    type = 'ten5'
  } else {
    inner = 'ارفع خرزة الخمسة' + (comp > 5 ? ' واسحب ' + (comp - 5) + ' من السفلي' : '')
    type = 'ten'
  }
  d[i] = c - comp
  out.push({
    text: 'في ' + name + ': اكتملت العشرة — المكوّن ' + comp + ': ' + inner + '، ثم انقل 1 إلى ' + placeName(ctx.n, ctx.decimals, i - 1) + '.',
    rod: i,
    snap: d.slice(),
    type,
  })
  return addAt(ctx, d, i - 1, 1, out)
}

export function subAt(ctx: Ctx, d: number[], i: number, v: number, out: Step[]): boolean {
  const c = d[i]
  const name = placeName(ctx.n, ctx.decimals, i)
  if (c - v >= 0) {
    let txt: string
    let type: StepType
    if (c % 5 >= v) {
      txt = 'اسحب ' + v + ' من الخرز السفلي في ' + name + '.'
      type = 'direct'
    } else if (v < 5) {
      txt = 'في ' + name + ': ارفع خرزة الخمسة وأضف ' + (5 - v) + ' من السفلي (مكوّن ' + v + ' إلى 5).'
      type = 'five'
    } else {
      txt = 'في ' + name + ': ارفع خرزة الخمسة' + (v > 5 ? ' واسحب ' + (v - 5) + ' من السفلي' : '') + '.'
      type = 'heaven'
    }
    d[i] = c - v
    out.push({ text: txt, rod: i, snap: d.slice(), type })
    return true
  }
  if (i === 0) {
    out.push({ text: 'لا يمكن الطرح — الناتج سيكون سالباً.', rod: -1, type: 'x' })
    return false
  }
  const comp = 10 - v
  const c5 = c % 5
  let inner: string
  let type: StepType
  if (c5 + comp <= 4) {
    inner = 'أضف ' + comp + ' من الخرز السفلي'
    type = 'ten'
  } else if (comp < 5) {
    inner = 'أنزل خرزة الخمسة واسحب ' + (5 - comp) + ' من السفلي (مكوّن ' + comp + ' إلى 5 داخل الاستلاف)'
    type = 'ten5'
  } else {
    inner = 'أنزل خرزة الخمسة' + (comp > 5 ? ' وأضف ' + (comp - 5) + ' من السفلي' : '')
    type = 'ten'
  }
  d[i] = c + comp
  out.push({
    text: 'في ' + name + ': الخرز لا تكفي — استلف 1 من ' + placeName(ctx.n, ctx.decimals, i - 1) + '، والمكوّن ' + comp + ' هنا: ' + inner + '.',
    rod: i,
    snap: d.slice(),
    type,
  })
  return subAt(ctx, d, i - 1, 1, out)
}

export function planFor(ctx: Ctx, startDigits: number[], sign: '+' | '-', operand: number | string): PlanResult {
  const d = startDigits.slice()
  const out: Step[] = []
  const pad = String(operand)
    .padStart(ctx.n, '0')
    .split('')
    .map(Number)
  let ok = true
  for (let i = 0; i < ctx.n && ok; i++) {
    if (!pad[i]) continue
    ok = sign === '+' ? addAt(ctx, d, i, pad[i], out) : subAt(ctx, d, i, pad[i], out)
  }
  return { ok: ok && !out.some((s) => s.rod === -1), steps: out }
}

export function genProblem(ctx: Ctx, cfg: CourseConfig, rnd?: () => number): ProblemResult | null {
  const rand = rnd || Math.random
  const n = ctx.n
  const cap = Math.pow(10, Math.min(cfg.digits + 1, n)) - 1
  const min = cfg.digits === 1 ? 1 : Math.pow(10, cfg.digits - 1)
  const max = Math.pow(10, cfg.digits) - 1
  const exhaustive = max - min + 1 <= 120
  const fits = (d: number[], sign: '+' | '-', v: number): PlanResult | null => {
    const r = planFor(ctx, d, sign, v)
    return r.ok && !r.steps.some((s) => cfg.allow.indexOf(s.type) < 0) ? r : null
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    let running = 0
    let d = new Array(n).fill(0)
    const terms: Term[] = []
    let good = true
    const seen: StepType[] = []
    for (let i = 0; i < cfg.count; i++) {
      const sign: '+' | '-' = i > 0 && cfg.sub && rand() < 0.4 && running > min ? '-' : '+'
      let chosen: [number, PlanResult] | null = null
      if (exhaustive) {
        const cands: [number, PlanResult][] = []
        for (let v = min; v <= max; v++) {
          if (sign === '-' && v > running) continue
          if (sign === '+' && running + v > cap) continue
          const r = fits(d, sign, v)
          if (r) cands.push([v, r])
        }
        if (cfg.req && cands.length) {
          const key = cands.filter((c) => c[1].steps.some((s) => cfg.req!.indexOf(s.type) >= 0))
          if (key.length && (rand() < 0.75 || i === cfg.count - 1)) chosen = key[Math.floor(rand() * key.length)]
        }
        if (!chosen && cands.length) chosen = cands[Math.floor(rand() * cands.length)]
      } else {
        for (let k = 0; k < 80 && !chosen; k++) {
          const v = Math.floor(rand() * (max - min + 1)) + min
          if (sign === '-' && v > running) continue
          if (sign === '+' && running + v > cap) continue
          const r = fits(d, sign, v)
          if (r && (!cfg.req || k > 50 || r.steps.some((s) => cfg.req!.indexOf(s.type) >= 0))) chosen = [v, r]
        }
      }
      if (!chosen) {
        good = false
        break
      }
      const [v, r] = chosen
      r.steps.forEach((s) => seen.push(s.type))
      d = r.steps[r.steps.length - 1].snap!.slice()
      running = sign === '+' ? running + v : running - v
      terms.push({ sign, v })
    }
    if (!good || terms.length !== cfg.count || running <= 0) continue
    if (cfg.req && !seen.some((t) => cfg.req!.indexOf(t) >= 0)) continue
    return { terms, total: running, skills: seen }
  }
  return null
}

export function multPairs(a: number, b: number): MultPair[] {
  const A = String(a).split('').map(Number).reverse()
  const B = String(b).split('').map(Number).reverse()
  const out: MultPair[] = []
  for (let i = 0; i < A.length; i++) {
    for (let j = B.length - 1; j >= 0; j--) {
      out.push({ a: A[i], b: B[j], place: i + j, p: A[i] * B[j] })
    }
  }
  return out
}

export function divSteps(N: number, d: number): DivStepOut[] {
  const ds = String(N).split('').map(Number)
  const out: DivStepOut[] = []
  let rem = 0
  let started = false
  ds.forEach((dg) => {
    const cur = rem * 10 + dg
    const qd = Math.floor(cur / d)
    rem = cur % d
    if (qd > 0) started = true
    if (started) out.push({ cur, qd, sub: qd * d, rem })
  })
  return out
}

export function roundTo(x: number, n: number): number {
  const p = Math.pow(10, n)
  return Math.round(x * p) / p
}

export function errKind(expected: number, answer: number): string {
  const ad = Math.abs(answer - expected)
  const sa = String(Math.abs(expected)).split('').sort().join('')
  const sb = String(Math.abs(answer)).split('').sort().join('')
  if (sa === sb && sa.length > 1) return 'قلب الميزان'
  for (let k = 0; k < 9; k++) {
    if (ad === Math.pow(10, k)) return k === 0 ? 'عدّ' : 'فوق العشرة'
    if (ad === 5 * Math.pow(10, k)) return 'خرزة الخمسة'
    if (ad === 9 * Math.pow(10, k)) return 'اتجاه المكوّن'
  }
  return 'أخرى'
}

export function diagnose(ctx: Ctx, expected: number, answer: number, fmt?: (x: number) => string): string {
  const f = fmt || ((x: number) => String(x))
  const d = answer - expected
  const ad = Math.abs(d)
  if (d === 0) return ''
  if (errKind(expected, answer) === 'قلب الميزان') return 'الأرقام صحيحة لكن ترتيب الموازين مقلوب — راجع من أي منزلة بدأت.'
  for (let k = 0; k < 9; k++) {
    if (ad === Math.pow(10, k))
      return k === 0
        ? 'الفرق خرزة واحدة في الآحاد — تحقق من آخر حركة، غالباً خرزة زائدة أو ناقصة.'
        : 'الفرق ' + f(ad) + ' بالضبط — هذا خطأ فيه: نسيت أو زدت 1 في ' + placeName(ctx.n, ctx.decimals, ctx.n - 1 - k) + ' عند المكوّن.'
    if (ad === 5 * Math.pow(10, k))
      return 'الفرق ' + f(ad) + ' — خطأ في خرزة الخمسة: أنزلتها أو رفعتها في غير موضعها في ' + placeName(ctx.n, ctx.decimals, ctx.n - 1 - k) + '.'
    if (ad === 9 * Math.pow(10, k)) return 'الفرق ' + f(ad) + ' — يبدو أنك عكست اتجاه المكوّن (أضفت بدل أن تسحب أو العكس).'
  }
  if (ad < 5) return 'الفرق صغير — خطأ عدّ في الخرز السفلي، أبطئ قليلاً.'
  return 'راجع المسألة خطوة بخطوة على المعداد، الغالب أن حدّياً واحداً فاتك.'
}

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة']
const TEEN = ['أحد', 'اثنا', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة']
const TENS = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
const HUND = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة']

function u100(n: number): string {
  if (n < 10) return ONES[n]
  if (n === 10) return 'عشرة'
  if (n < 20) return TEEN[n - 11] + ' عشر'
  const t = TENS[Math.floor(n / 10)]
  const u = n % 10
  return u ? ONES[u] + ' و' + t : t
}
function u1000(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return h ? HUND[h] + (r ? ' و' + u100(r) : '') : u100(r)
}
function scale(n: number, f: [string, string, string, string]): string {
  if (n === 1) return f[0]
  if (n === 2) return f[1]
  if (n <= 10) return u1000(n) + ' ' + f[2]
  return u1000(n) + ' ' + f[3]
}
export function toWords(n: number): string {
  if (!isFinite(n)) return ''
  if (n === 0) return 'صفر'
  const p: string[] = []
  const mil = Math.floor(n / 1e6)
  const th = Math.floor((n % 1e6) / 1000)
  const rest = n % 1000
  if (mil) p.push(scale(mil, ['مليون', 'مليونان', 'ملايين', 'مليوناً']))
  if (th) p.push(scale(th, ['ألف', 'ألفان', 'آلاف', 'ألفاً']))
  if (rest) p.push(u1000(rest))
  return p.join(' و')
}

export function corrupt(digits: number[], rnd?: () => number): CorruptResult | null {
  const rand = rnd || Math.random
  const idx: number[] = []
  digits.forEach((d, i) => {
    if (d > 0 || i >= digits.length - 4) idx.push(i)
  })
  const kinds: CorruptResult['kind'][] = ['heaven', 'one', 'shift']
  for (let t = 0; t < 60; t++) {
    const i = idx[Math.floor(rand() * idx.length)]
    const kind = kinds[Math.floor(rand() * kinds.length)]
    const c = digits[i]
    let nv: number | null = null
    if (kind === 'heaven') nv = c >= 5 ? c - 5 : c + 5
    else if (kind === 'one') nv = c % 5 === 4 ? c - 1 : c + 1
    else nv = c % 5 >= 1 ? c - 1 : c + 1
    if (nv === null || nv < 0 || nv > 9 || nv === c) continue
    const out = digits.slice()
    out[i] = nv
    return { digits: out, rod: i, kind, delta: (nv - c) * Math.pow(10, digits.length - 1 - i) }
  }
  return null
}
