"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  getCategories,
  getCategoryBreakdown,
  type BillingElementCategory,
  type CategoryBreakdownResult,
} from "@/lib/api/billing-elements"

export default function CategoryBreakdownPage() {
  const t = useTranslations("admin.billing_elements.category_breakdown")
  const tCommon = useTranslations("common")
  const { profile } = useAuth()

  const [categories, setCategories] = useState<BillingElementCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")
  const [metric, setMetric] = useState<"number" | "amount">("number")
  const [breakdownByGrade, setBreakdownByGrade] = useState(false)

  // Date range — default: 8 months ago to today
  const today = new Date()
  const eightMonthsAgo = new Date(today)
  eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8)
  const [fromDate, setFromDate] = useState(eightMonthsAgo.toISOString().split("T")[0])
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0])

  const [result, setResult] = useState<CategoryBreakdownResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    if (profile?.school_id) fetchCategories()
  }, [profile?.school_id, fetchCategories])

  const handleGo = async () => {
    setFetching(true)
    try {
      const data = await getCategoryBreakdown({
        category_id: selectedCategory || undefined,
        from_date: fromDate,
        to_date: toDate,
        breakdown_by_grade: breakdownByGrade,
        metric,
      })
      setResult(data)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("toast.fetch_failed"))
    } finally {
      setFetching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Controls */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 space-y-4">
        {/* Category Select */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 border rounded px-3 text-sm"
          >
            <option value="">{t("choose_category")}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.title}</option>
            ))}
          </select>
        </div>

        {/* Metric Toggle + Breakdown checkbox */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="radio"
                checked={metric === "number"}
                onChange={() => setMetric("number")}
                className="accent-[#008B8B]"
              />
              {t("number")}
            </label>
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="radio"
                checked={metric === "amount"}
                onChange={() => setMetric("amount")}
                className="accent-[#008B8B]"
              />
              {tCommon("amount")}
            </label>
          </div>
          <div className="text-sm font-medium text-[#008B8B]">{t("total")}</div>
          <div className="ml-auto">
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={breakdownByGrade}
                onChange={(e) => setBreakdownByGrade(e.target.checked)}
                className="accent-[#008B8B]"
              />
              {t("breakdown_by_grade")}
            </label>
          </div>
        </div>

        {/* Date Range */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600">{t("report_timeframe")}</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 w-40"
          />
          <span className="text-sm text-gray-400">{tCommon("to")}</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-8 w-40"
          />
          <Button
            size="sm"
            className="bg-[#008B8B] hover:bg-[#007070] text-white px-6"
            onClick={handleGo}
            disabled={fetching}
          >
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : tCommon("go")}
          </Button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase">
                  {breakdownByGrade ? t("grade_level") : t("category")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#022172] uppercase">
                  {metric === "number" ? t("count") : tCommon("amount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.breakdown.map((row, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-[#008B8B]">
                    {breakdownByGrade
                      ? row.grade_name || t("unknown")
                      : row.category_title || t("uncategorized")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {metric === "number" ? row.count : row.total_amount.toFixed(2)}
                  </td>
                </tr>
              ))}
              {result.breakdown.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-gray-400">
                    {t("no_data")}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-[#022172]">{t("total")}</td>
                <td className="px-4 py-3 text-right font-mono text-[#022172]">
                  {metric === "number" ? result.total_count : result.total_amount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
