"use client"

import { Button } from "@/components/ui/button"
import { useTT } from "./useTT"
import type { useSessionLog } from "./useSessionLog"
import type { useProgress } from "./useProgress"

const MODE_LABEL: Record<string, { en: string; ar: string }> = {
  course: { en: "Course", ar: "المنهج المتدرج" },
  mult: { en: "Multiplication", ar: "الضرب" },
  div: { en: "Division", ar: "القسمة" },
  exam: { en: "Level Exam", ar: "اختبار المستوى" },
  anzanExam: { en: "Anzan Exam", ar: "اختبار الأنزان" },
  hunt: { en: "Error Hunt", ar: "اكتشاف الخطأ" },
  comp: { en: "Complements", ar: "المكوّنات" },
  anzan: { en: "Anzan", ar: "الأنزان" },
  dict: { en: "Dictation", ar: "الإملاء" },
  slips: { en: "Slips", ar: "القسائم" },
  form: { en: "Number Formation", ar: "تكوين عدد" },
  read: { en: "Reading Abacus", ar: "قراءة معداد" },
}

export function SessionReport({ session, progress, level }: { session: ReturnType<typeof useSessionLog>; progress: ReturnType<typeof useProgress>; level: number }) {
  const tt = useTT()
  const log = session.log
  const total = log.length
  const ok = log.filter((x) => x.ok).length
  const accuracy = total ? Math.round((ok / total) * 100) : 0
  const times = log.filter((x) => x.ok && x.ms).map((x) => x.ms! / 1000)
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0

  const byMode: Record<string, { n: number; ok: number; t: number; tn: number }> = {}
  log.forEach((x) => {
    byMode[x.mode] = byMode[x.mode] || { n: 0, ok: 0, t: 0, tn: 0 }
    byMode[x.mode].n++
    if (x.ok) { byMode[x.mode].ok++; if (x.ms) { byMode[x.mode].t += x.ms / 1000; byMode[x.mode].tn++ } }
  })
  const weakest = Object.keys(byMode).sort((a, b) => byMode[a].ok / byMode[a].n - byMode[b].ok / byMode[b].n)[0]

  const sessions = progress.progress.sessions
  const streak = progress.streakDays()

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard value={total} label={tt("Attempts", "محاولة")} />
        <StatCard value={`${accuracy}%`} label={tt("Accuracy", "الدقة")} />
        <StatCard value={avg ? avg.toFixed(1) : "—"} label={tt("Avg. time (s)", "متوسط الزمن (ث)")} />
        <StatCard value={level} label={tt("Current level", "المستوى الحالي")} />
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{tt("No attempts yet this sitting — try any tab and come back here.", "لا توجد محاولات بعد في هذه الجلسة — جرّب أي تبويب وعُد إلى هنا.")}</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-start text-muted-foreground">
                <th className="p-2 text-start">{tt("Activity", "النشاط")}</th>
                <th className="p-2 text-start">{tt("Attempts", "محاولات")}</th>
                <th className="p-2 text-start">{tt("Accuracy", "الدقة")}</th>
                <th className="p-2 text-start">{tt("Avg. time", "متوسط الزمن")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(byMode).map((k) => (
                <tr key={k} className="border-b">
                  <td className="p-2">{tt(MODE_LABEL[k]?.en || k, MODE_LABEL[k]?.ar || k)}</td>
                  <td className="p-2">{byMode[k].n}</td>
                  <td className="p-2">{Math.round((byMode[k].ok / byMode[k].n) * 100)}%</td>
                  <td className="p-2">{byMode[k].tn ? (byMode[k].t / byMode[k].tn).toFixed(1) + "s" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="rounded-lg border-s-4 border-blue-500 bg-muted/40 p-3 text-sm">
            {total < 5
              ? tt("Keep going — the report gets more useful after five attempts.", "تابع — التقرير يصبح أدق بعد خمس محاولات.")
              : tt(`Focus your next sitting on "${tt(MODE_LABEL[weakest]?.en || weakest, MODE_LABEL[weakest]?.ar || weakest)}" — it's your weakest spot right now.`, `ركّز جلستك القادمة على «${tt(MODE_LABEL[weakest]?.en || weakest, MODE_LABEL[weakest]?.ar || weakest)}» — أضعف نقطة عندك الآن.`)}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => progress.saveSessionBlock(level, log)} disabled={total === 0}>{tt("Save today's progress", "احفظ تقدم اليوم")}</Button>
        <span className="text-sm text-muted-foreground">{tt(`${sessions.length} saved session(s) — ${streak}-day streak.`, `${sessions.length} جلسة محفوظة — تتابع ${streak} يوم.`)}</span>
      </div>

      {sessions.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-start text-muted-foreground">
              <th className="p-2 text-start">{tt("Date", "التاريخ")}</th>
              <th className="p-2 text-start">{tt("Level", "المستوى")}</th>
              <th className="p-2 text-start">{tt("Attempts", "محاولات")}</th>
              <th className="p-2 text-start">{tt("Correct", "صحيحة")}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(-8).reverse().map((s, i) => (
              <tr key={i} className="border-b">
                <td className="p-2">{s.date}</td>
                <td className="p-2">{s.level}</td>
                <td className="p-2">{s.attempts}</td>
                <td className="p-2">{s.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
