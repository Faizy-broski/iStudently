"use client"

import { useTranslations } from "next-intl"
import { CheckCircle2, Circle, ChevronLeft } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { JcOverview } from "@/lib/api/jahbadh-control"
import { cn } from "@/lib/utils"
import { Tile } from "../shared"
import { Note, jcTabs, type TabProps } from "./shared"

type Step = { key: string; tab: string; done: boolean | null }

/** The C12 workflow as a checklist; each step opens the tab where it is done. */
export function jcSteps(o: JcOverview): Step[] {
  const c = o.counts
  const s = o.session
  const after = (status: string) => ["draft", "registration", "committees_locked", "exam_running", "grading", "unmasked", "published", "archived"].indexOf(s.status) >= ["draft", "registration", "committees_locked", "exam_running", "grading", "unmasked", "published", "archived"].indexOf(status)
  const steps: Step[] = [
    { key: "grades", tab: "setup", done: o.grades.length > 0 },
    { key: "students", tab: "students", done: c.participating > 0 },
    { key: "numbers", tab: "students", done: c.participating > 0 && c.numbered === c.participating },
    { key: "committees", tab: "committees", done: c.committees > 0 && c.capacity >= c.participating && c.participating > 0 },
    { key: "distribution", tab: "committees", done: c.participating > 0 && c.placed === c.participating },
    { key: "lock", tab: "committees", done: !!s.committees_locked_at },
    { key: "planning", tab: "planning", done: null },
    { key: "prints", tab: "prints", done: null },
    { key: "examday", tab: "examday", done: after("grading") },
    { key: "entry", tab: "entry", done: after("unmasked") },
    { key: "unmask", tab: "quality", done: o.rights.unmasked },
    { key: "results", tab: "results", done: after("published") },
  ]
  const tabs = jcTabs(o) as string[]
  return steps.filter((x) => tabs.includes(x.tab))
}

export function OverviewTab({ overview: o, onOpen }: TabProps & { onOpen: (tab: string) => void }) {
  const t = useTranslations("examControl")
  const c = o.counts
  const steps = jcSteps(o)
  return (
    <div className="space-y-4">
      {o.rights.manage ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Tile label={t("count_students")} value={c.students} />
          <Tile label={t("count_participating")} value={c.participating} tone="success" />
          <Tile label={t("count_numbered")} value={`${c.numbered}/${c.participating}`} tone={c.numbered === c.participating ? "success" : "warning"} />
          <Tile label={t("count_committees")} value={c.committees} />
          <Tile label={t("count_capacity")} value={c.capacity} tone={c.capacity >= c.participating ? "success" : "destructive"} />
          <Tile label={t("count_placed")} value={`${c.placed}/${c.participating}`} tone={c.placed === c.participating ? "success" : "warning"} />
          <Tile label={t("count_special")} value={c.special} />
        </div>
      ) : (
        <Note>{t("memberRoles", { roles: o.rights.roles.map((r) => t(`role_${r}`)).join("، ") || t("role_chief") })}</Note>
      )}
      {!o.rights.unmasked && o.rights.entry && !o.rights.manage ? <Note tone="warning">{t("blindNote")}</Note> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("workflow")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {steps.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onOpen(s.tab)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-start hover:bg-muted"
            >
              {s.done ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Circle className={cn("size-5 shrink-0", s.done === false ? "text-warning" : "text-muted-foreground")} />}
              <span className="w-6 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{t(`step_${s.key}`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`step_${s.key}_hint`)}</span>
              </span>
              <ChevronLeft className="size-4 text-muted-foreground ltr:rotate-180" />
            </button>
          ))}
        </CardContent>
      </Card>

      {o.grades.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("gradesInSession")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {o.grades.map((g) => (
              <div key={g.grade_level_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-2 last:border-0">
                <span className="font-medium">{g.grade_level_name}</span>
                <span className="text-muted-foreground">{t("numberCode")}: <span dir="ltr">{g.number_code}</span></span>
                <span className="text-muted-foreground">{g.subjects.map((s) => `${s.name} (${s.max})`).join("، ")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
