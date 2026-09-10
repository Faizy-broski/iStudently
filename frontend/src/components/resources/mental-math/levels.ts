// The 9-level progressive curriculum, ported from the reference app's LEVELS
// array verbatim (digit counts, term counts, allowed/required bead-move
// skills, and coaching tips), typed against engine.ts's CourseConfig.

import type { CourseConfig, StepType } from "@/lib/mentalMath/engine"

export interface LevelDef extends CourseConfig {
  name: { en: string; ar: string }
  tip: { en: string; ar: string }
}

export const LEVELS: LevelDef[] = [
  {
    n: 1, digits: 1, count: 3, sub: false, allow: ["direct"], req: null,
    name: { en: "Basics: single beads", ar: "الأساس: خرز الآحاد" },
    tip: { en: "Move beads with thumb (down) and index finger (up). Don't look at your hand — look at the problem.", ar: "حرّك الخرز بالإبهام للأسفل والسبابة للأعلى. لا تنظر إلى يدك — انظر إلى المسألة." },
  },
  {
    n: 2, digits: 1, count: 4, sub: true, allow: ["direct", "heaven"], req: ["heaven"],
    name: { en: "The five-bead", ar: "خرزة الخمسة" },
    tip: { en: "Five is one bead, not five. Never count the beads one by one — jump to speed from the start.", ar: "الخمسة خرزة واحدة لا خمس. لا تعدّ الخرز واحدة واحدة — انتقل إلى السرعة أبدًا." },
  },
  {
    n: 3, digits: 1, count: 4, sub: true, allow: ["direct", "heaven", "five"], req: ["five"],
    name: { en: "Friends of five", ar: "أصدقاء الخمسة" },
    tip: { en: "4=1+3, 3=2+2. When the lower beads don't suffice, drop the five and pull the friend.", ar: "4 و1 صديقان، 3 و2 صديقان. حين لا تكفي الخرز السفلي، أنزل الخمسة واسحب الصديق." },
  },
  {
    n: 4, digits: 1, count: 4, sub: true, allow: ["direct", "heaven", "five", "ten"], req: ["ten"],
    name: { en: "Friends of ten", ar: "أصدقاء العشرة" },
    tip: { en: "9&1, 8&2, 7&3, 6&4, 5&5. The complement is memorized, not calculated — this is where real mental math begins.", ar: "9 و1، 8 و2، 7 و3، 6 و4، 5 و5. المكوّن يُحفظ لا يُحسب — من هنا يبدأ الحساب الذهني الحقيقي." },
  },
  {
    n: 5, digits: 1, count: 4, sub: true, allow: ["direct", "heaven", "five", "ten", "ten5"], req: ["ten5"],
    name: { en: "Combined complement", ar: "المكوّن المركّب" },
    tip: { en: "E.g. 6+7: carry 1 to the tens, subtract complement 3 but the lower beads don't have 3 — raise five and add 2 — a complement inside a complement. Go slow until the move settles.", ar: "مثل 6+7: تنقل 1 إلى العشرات، وتسحب المكوّن 3 لكن الخرز السفلي لا يكفي — فترفع الخمسة وتضيف 2 — مكوّن داخل مكوّن. أبطئ هنا حتى تثبت الحركة." },
  },
  {
    n: 6, digits: 2, count: 3, sub: false, allow: ["direct", "heaven"], req: null,
    name: { en: "Two digits, no complements", ar: "رقمان بلا مكوّن" },
    tip: { en: "Always start from the highest place value down to the lowest — the opposite of how you read numbers on paper.", ar: "ابدأ دائمًا من المنزلة الأعلى إلى الأدنى — عكس ما تعوّدت عليه في القراءة على الورق." },
  },
  {
    n: 7, digits: 2, count: 4, sub: true, allow: ["direct", "heaven", "five", "ten", "ten5"], req: ["ten", "ten5"],
    name: { en: "Two digits with complements", ar: "رقمان مع المكوّنات" },
    tip: { en: "If you get stuck, zero the abacus and redo the whole problem — fixing mid-way locks in the error.", ar: "إذا تعثّرت، صفّر المعداد وأعد المسألة كاملة. التصحيح في المنتصف يُرسّخ الخطأ." },
  },
  {
    n: 8, digits: 3, count: 4, sub: true, allow: ["direct", "heaven", "five", "ten", "ten5"], req: ["ten", "ten5"],
    name: { en: "Three digits", ar: "ثلاث منازل" },
    tip: { en: "Your hand moves further now, and eyes must jump ahead to the next number. This is the first step toward Anzan.", ar: "يدك تتحرك أبعد الآن، وعيناك يجب أن تسبقا إلى الرقم التالي. هذه أول خطوة نحو الأنزان." },
  },
  {
    n: 9, digits: 2, count: 6, sub: true, allow: ["direct", "heaven", "five", "ten", "ten5"], req: null,
    name: { en: "Speed: six operations", ar: "سرعة: ست عمليات" },
    tip: { en: "Close your eyes between problems to memorize the abacus's feel, not just its look.", ar: "أغمض عينيك بين المسائل لتحفظ إحساس المعداد لا شكله فقط." },
  },
]

/** Given a session log filtered to mode 'course', finds the skill with lowest accuracy among skills tried >=3 times. */
export function weakestSkill(entries: { ok: boolean; skills?: string[] }[]): StepType | null {
  const stats: Record<string, { n: number; ok: number }> = {}
  entries.forEach((x) => {
    ;(x.skills || []).forEach((s) => {
      stats[s] = stats[s] || { n: 0, ok: 0 }
      stats[s].n++
      if (x.ok) stats[s].ok++
    })
  })
  const keys = Object.keys(stats).filter((k) => stats[k].n >= 3)
  if (!keys.length) return null
  return keys.sort((a, b) => stats[a].ok / stats[a].n - stats[b].ok / stats[b].n)[0] as StepType
}
