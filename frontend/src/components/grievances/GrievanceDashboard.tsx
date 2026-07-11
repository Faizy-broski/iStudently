"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Clock, Search, AlertTriangle, CheckCircle2, Archive, TrendingUp } from "lucide-react"
import { grievancesApi, type GrievanceDashboardStats } from "@/lib/api/grievances"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from "recharts"

const PRIORITY_COLORS: Record<string, string> = {
  low: "#94a3b8",
  normal: "#3b82f6",
  high: "#f59e0b",
  urgent: "#fb923c",
  critical: "#ef4444",
}

export function GrievanceDashboard() {
  const t = useTranslations("grievances.dashboard")
  const tPriority = useTranslations("grievances.priority")
  const [stats, setStats] = useState<GrievanceDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    grievancesApi.getDashboardStats().then((res) => {
      if (res.success && res.data) setStats(res.data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!stats) return <p className="text-muted-foreground">{t("failed_to_load")}</p>

  const statCards = [
    { title: t("stat_pending"), value: stats.pending, icon: Clock, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
    { title: t("stat_under_investigation"), value: stats.under_investigation, icon: Search, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
    { title: t("stat_overdue"), value: stats.overdue, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
    { title: t("stat_resolved"), value: stats.resolved, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    { title: t("stat_closed"), value: stats.closed, icon: Archive, color: "text-gray-600", bg: "bg-gray-100 dark:bg-gray-800" },
    { title: t("stat_escalated"), value: stats.escalated, icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
  ]

  const pieData = Object.entries(stats.by_priority)
    .map(([priority, count]) => ({ name: priority, label: tPriority(priority as Parameters<typeof tPriority>[0]), value: count }))
    .filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("total_complaints", { count: stats.total })}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.title}</p>
                <p className="text-xl font-bold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold mb-4">{t("by_priority")}</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_complaints_yet")}</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
