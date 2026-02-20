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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function AddDropReport() {
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
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" })
  }

  const days31 = Array.from({ length: 31 }, (_, i) => String(i + 1))
  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - 2 + i))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Add / Drop Report</h1>
      </div>

      {/* Timeframe selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Timeframe:</span>

        {/* Start date */}
        <Select value={startMonth} onValueChange={setStartMonth}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
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

        <span className="text-sm text-muted-foreground">to</span>

        {/* End date */}
        <Select value={endMonth} onValueChange={setEndMonth}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
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
          GO
        </Button>
      </div>

      {/* Count + search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-amber-600">
            {filteredRecords.length} schedule record{filteredRecords.length !== 1 ? "s" : ""} were found.
          </span>
          <button className="text-muted-foreground hover:text-foreground" title="Download">
            <Download className="h-4 w-4" />
          </button>
        </div>
        <div className="relative w-64">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Student
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Student ID
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Course
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Course Period
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Enrolled
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Dropped
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No schedule records found for the selected timeframe.
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
                    <td className="px-4 py-3">{record.student_id.substring(0, 8)}</td>
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
