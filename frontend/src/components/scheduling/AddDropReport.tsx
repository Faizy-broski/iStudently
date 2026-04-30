"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import { getAddDropLog, type AddDropRecord } from "@/lib/api/scheduling"
import { CalendarDays, Download, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useTranslations, useLocale } from "next-intl"

export function AddDropReport() {
  const t = useTranslations("school.scheduling.add_drop_report")
  const tCommon = useTranslations("common")
  const locale = useLocale()

  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id
  const academicYearId = selectedAcademicYear

  const today = new Date()

  // Start date: first day of current month
  const [startMonth, setStartMonth] = useState(String(today.getMonth()))
  const [startDay, setStartDay] = useState("1")
  const [startYear, setStartYear] = useState(String(today.getFullYear()))

  // End date: today
  const [endMonth, setEndMonth] = useState(String(today.getMonth()))
  const [endDay, setEndDay] = useState(String(today.getDate()))
  const [endYear, setEndYear] = useState(String(today.getFullYear()))

  const [search, setSearch] = useState("")
  const [queryKey, setQueryKey] = useState(0) // trigger refetch

  const buildDate = useCallback((m: string, d: string, y: string) => {
    const month = String(parseInt(m) + 1).padStart(2, "0")
    const day = String(parseInt(d)).padStart(2, "0")
    return `${y}-${month}-${day}`
  }, [])

  const startDate = buildDate(startMonth, startDay, startYear)
  const endDate = buildDate(endMonth, endDay, endYear)

  // Fetch add/drop log
  const { data: records, isLoading } = useSWR(
    user && academicYearId
      ? ["add-drop-report", academicYearId, startDate, endDate, campusId, queryKey]
      : null,
    async () => getAddDropLog(academicYearId!, startDate, endDate, campusId),
    { revalidateOnFocus: false }
  )

  const filteredRecords = useMemo(() => {
    const allRecords: AddDropRecord[] = records || []
    if (!search.trim()) return allRecords
    const q = search.toLowerCase()
    return allRecords.filter(
      (r) =>
        (r.student_name || "").toLowerCase().includes(q) ||
        r.student_id.toLowerCase().includes(q) ||
        r.course_title.toLowerCase().includes(q) ||
        (r.course_period_title || "").toLowerCase().includes(q)
    )
  }, [records, search])

  const handleGo = () => {
    setQueryKey((k) => k + 1)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    const [y, m, d] = dateStr.substring(0, 10).split("-")
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    return date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "2-digit" })
  }

  const days31 = Array.from({ length: 31 }, (_, i) => String(i + 1))
  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - 2 + i))

  const MONTH_NAMES = [
    tCommon("months.0"), tCommon("months.1"), tCommon("months.2"),
    tCommon("months.3"), tCommon("months.4"), tCommon("months.5"),
    tCommon("months.6"), tCommon("months.7"), tCommon("months.8"),
    tCommon("months.9"), tCommon("months.10"), tCommon("months.11"),
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Timeframe selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t("timeframe")}</span>

        {/* Start date */}
        <Select value={startMonth} onValueChange={setStartMonth}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={i} value={String(i)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={startDay} onValueChange={setStartDay}>
          <SelectTrigger className="w-16 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days31.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={startYear} onValueChange={setStartYear}>
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">{t("to")}</span>

        {/* End date */}
        <Select value={endMonth} onValueChange={setEndMonth}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((m, i) => (
              <SelectItem key={i} value={String(i)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={endDay} onValueChange={setEndDay}>
          <SelectTrigger className="w-16 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {days31.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={endYear} onValueChange={setEndYear}>
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={handleGo}>
          {tCommon("go")}
        </Button>
      </div>

      {/* Count + search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-amber-600">
            {t("found_records", { count: filteredRecords.length })}
          </span>
          <button className="text-muted-foreground hover:text-foreground" title={tCommon("download")}>
            <Download className="h-4 w-4" />
          </button>
        </div>
        <div className="relative w-64">
          <Input
            placeholder={tCommon("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8 rtl:pl-8 rtl:pr-3"
          />
          <Search className="absolute right-2 rtl:left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Records table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {tCommon("student")}
                </th>
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {tCommon("student_id")}
                </th>
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {tCommon("course")}
                </th>
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {t("th_course_period")}
                </th>
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {t("th_enrolled")}
                </th>
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {t("th_dropped")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {t("no_records_found")}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => (
                  <tr
                    key={`${record.student_id}-${record.course_title}-${record.date}-${idx}`}
                    className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                    }`}
                  >
                    <td className="px-4 py-3 text-primary font-medium">
                      {record.student_name || record.student_id}
                    </td>
                    <td className="px-4 py-3">{record.student_number || "—"}</td>
                    <td className="px-4 py-3">{record.course_title}</td>
                    <td className="px-4 py-3">{record.course_period_title || "—"}</td>
                    <td className="px-4 py-3">
                      {record.action === "add" ? formatDate(record.date) : ""}
                    </td>
                    <td className="px-4 py-3">
                      {record.action === "drop" ? formatDate(record.date) : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
