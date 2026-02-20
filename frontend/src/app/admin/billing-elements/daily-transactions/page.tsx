"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import {
  getCategories,
  getTransactions,
  type BillingElementCategory,
  type BillingElementTransaction,
} from "@/lib/api/billing-elements"

export default function DailyTransactionsPage() {
  const { profile } = useAuth()

  const [categories, setCategories] = useState<BillingElementCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState("")

  // Default date range: first of current month to today
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [fromDate, setFromDate] = useState(monthStart.toISOString().split("T")[0])
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0])

  const [transactions, setTransactions] = useState<BillingElementTransaction[]>([])
  const [expanded, setExpanded] = useState(false)
  const [reconcile, setReconcile] = useState(false)

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
      const data = await getTransactions({
        from_date: fromDate,
        to_date: toDate,
        category_id: selectedCategory || undefined,
      })
      setTransactions(data)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch transactions")
    } finally {
      setFetching(false)
    }
  }

  // Auto-fetch on mount
  useEffect(() => {
    if (!loading && profile?.school_id) handleGo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const totalFee = transactions.reduce((sum, t) => sum + (t.amount || 0), 0)

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
          Daily Transactions
        </h1>
        <p className="text-muted-foreground">
          View billing element transactions within a date range
        </p>
      </div>

      {/* Controls */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 space-y-4">
        {/* View type + Date Range */}
        <div className="flex flex-wrap items-center gap-3">
          <select className="h-8 border rounded px-2 text-sm" defaultValue="daily">
            <option value="daily">Daily Transactions</option>
          </select>
          <span className="text-sm font-medium text-gray-600">Report Timeframe:</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-8 w-40"
          />
          <span className="text-sm text-gray-400">to</span>
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
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "GO"}
          </Button>
          <button
            className="ml-auto text-sm text-[#008B8B] hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Compact View" : "Expanded View"}
          </button>
        </div>

        {/* Category + Reconcile */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 border rounded px-2 text-sm"
            >
              <option value="">All</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.title}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto">
            <label className="flex items-center gap-1 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={reconcile}
                onChange={(e) => setReconcile(e.target.checked)}
                className="accent-[#008B8B]"
              />
              Reconcile Payments
            </label>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border">
        {transactions.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500 font-medium border-b">
            No transactions were found.
          </p>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Student</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Grade Level</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[#022172] uppercase">Fee</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Date</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Comment</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Plus className="h-3.5 w-3.5 text-gray-400" />
                </td>
                <td className="px-3 py-2 font-medium text-[#008B8B]">{t.student_name}</td>
                <td className="px-3 py-2">{t.grade_level}</td>
                <td className="px-3 py-2 text-right font-mono font-bold">{t.amount.toFixed(2)}</td>
                <td className="px-3 py-2 text-gray-500">
                  {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric"
                  }) : "—"}
                </td>
                <td className="px-3 py-2 text-gray-400">{t.comment || ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50 font-semibold">
              <td className="px-3 py-3">
                <Plus className="h-3.5 w-3.5 text-gray-400" />
              </td>
              <td className="px-3 py-3 text-gray-600">Total:</td>
              <td className="px-3 py-3"></td>
              <td className="px-3 py-3 text-right font-mono font-bold text-[#022172]">
                {totalFee.toFixed(2)}
              </td>
              <td className="px-3 py-3"></td>
              <td className="px-3 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
