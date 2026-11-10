"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { CalendarCheck2, FileInput, GraduationCap, UserRoundCheck } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { jgDataApi } from "@/lib/api/jahbadh-data"
import { getAllTeachers } from "@/lib/api/teachers"
import type { JgBase } from "./shared"

const NONE = "__none__"

/** Class home card: homeroom teacher «رائد الفصل» (B9), daily attendance, name import, rollover. */
export function SectionDataTools({ base, sectionId, campusId, isAdmin, viewOnly }: { base: JgBase; sectionId: string; campusId: string | null; isAdmin: boolean; viewOnly: boolean }) {
  const t = useTranslations("jgData")
  const homeroom = useSWR(["jg-homeroom", sectionId, campusId], async () => (await jgDataApi.homeroom(sectionId, campusId)).data ?? null)
  const staff = useSWR(isAdmin ? ["jg-homeroom-staff", campusId] : null, async () => (await getAllTeachers({ limit: 500, campus_id: campusId ?? undefined })).data)
  const query = `?section=${sectionId}`

  const assign = async (value: string) => {
    const res = await jgDataApi.setHomeroom(sectionId, value === NONE ? null : value, campusId)
    if (!res.success) return toast.error(res.code === "not_migrated" ? t("notMigrated") : res.code === "invalid_staff" ? t("err_invalid_staff") : res.error)
    homeroom.mutate(res.data!, false)
    toast.success(t("saved"))
  }

  const staffName = (s: { profile?: { first_name?: string | null; last_name?: string | null } | null; employee_number?: string }) =>
    [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(" ") || s.employee_number || "—"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {t("sectionTools")}
          {!isAdmin && viewOnly ? <Badge variant="secondary">{t("homeroomBadge")}</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <UserRoundCheck className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{t("homeroom")}:</span>
          {isAdmin ? (
            <Select value={homeroom.data?.staff_id ?? NONE} onValueChange={assign}>
              <SelectTrigger className="w-64"><SelectValue placeholder={t("pickHomeroom")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("noHomeroom")}</SelectItem>
                {(staff.data ?? []).filter((s) => s.is_active !== false).map((s) => <SelectItem key={s.id} value={s.id}>{staffName(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-semibold" dir="auto">{homeroom.data?.name ?? t("noHomeroom")}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`${base}/daily-attendance${query}`}><CalendarCheck2 className="size-4" />{t("attendanceTitle")}</Link>
          </Button>
          {isAdmin ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`${base}/import${query}`}><FileInput className="size-4" />{t("importTitle")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`${base}/rollover${query}`}><GraduationCap className="size-4" />{t("rolloverTitle")}</Link>
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
