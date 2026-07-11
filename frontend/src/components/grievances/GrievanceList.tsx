"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, Search, PlusCircle, AlertTriangle } from "lucide-react"
import { grievancesApi, type Grievance, type GrievanceView, type GrievanceStatus } from "@/lib/api/grievances"

const STATUS_KEYS: GrievanceStatus[] = [
  "submitted", "pending_review", "assigned", "under_investigation", "awaiting_info",
  "resolved", "closed", "reopened", "escalated", "rejected",
]

const STATUS_COLORS: Record<GrievanceStatus, string> = {
  submitted: "bg-blue-100 text-blue-800",
  pending_review: "bg-amber-100 text-amber-800",
  assigned: "bg-purple-100 text-purple-800",
  under_investigation: "bg-purple-100 text-purple-800",
  awaiting_info: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  reopened: "bg-orange-100 text-orange-800",
  escalated: "bg-red-100 text-red-800",
  rejected: "bg-gray-100 text-gray-800",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
}

interface GrievanceListProps {
  detailHrefBase: string
  submitHref: string
  /** Only admins get an "All" tab; other roles are always scoped to their own. */
  isAdmin?: boolean
}

export function GrievanceList({ detailHrefBase, submitHref, isAdmin = false }: GrievanceListProps) {
  const t = useTranslations("grievances.list")
  const tStatus = useTranslations("grievances.status")
  const tPriority = useTranslations("grievances.priority")
  const router = useRouter()
  const [view, setView] = useState<GrievanceView>(isAdmin ? "all" : "mine")
  const [status, setStatus] = useState<string>("")
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<Grievance[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await grievancesApi.list(view, { status: status || undefined, search: search || undefined, limit: 50 })
      if (res.success && res.data) {
        setItems(res.data)
        setTotal(res.pagination?.total ?? res.data.length)
      }
    } finally {
      setLoading(false)
    }
  }, [view, status, search])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const isOverdue = (g: Grievance) =>
    !!g.due_date &&
    new Date(g.due_date) < new Date() &&
    !["resolved", "closed", "rejected"].includes(g.status)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("complaint_count", { count: total })}</p>
        </div>
        <Button onClick={() => router.push(submitHref)} className="gap-2">
          <PlusCircle className="h-4 w-4" /> {t("submit_complaint")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && (
          <Tabs value={view} onValueChange={(v) => setView(v as GrievanceView)}>
            <TabsList>
              <TabsTrigger value="all">{t("tab_all")}</TabsTrigger>
              <TabsTrigger value="assigned">{t("tab_assigned")}</TabsTrigger>
              <TabsTrigger value="mine">{t("tab_mine")}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search_placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>

        <Select value={status || "__all__"} onValueChange={(v) => setStatus(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder={t("all_statuses")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("all_statuses")}</SelectItem>
            {STATUS_KEYS.map((value) => (
              <SelectItem key={value} value={value}>{tStatus(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">{t("no_complaints")}</p>
          ) : (
            <div className="divide-y">
              {items.map((g) => (
                <div
                  key={g.id}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`${detailHrefBase}/${g.id}`)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{g.complaint_number}</span>
                        <Badge className={PRIORITY_COLORS[g.priority]} variant="secondary">{tPriority(g.priority)}</Badge>
                        {g.is_confidential && <Badge variant="outline">{t("confidential")}</Badge>}
                        {g.is_anonymous && <Badge variant="outline">{t("anonymous")}</Badge>}
                        {isOverdue(g) && (
                          <Badge className="bg-red-100 text-red-800 gap-1">
                            <AlertTriangle className="h-3 w-3" /> {t("overdue")}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate mt-1">{g.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{g.category?.name || t("uncategorized")} • {new Date(g.submitted_at).toLocaleDateString()}</p>
                    </div>
                    <Badge className={STATUS_COLORS[g.status]}>{tStatus(g.status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
