"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, TrendingDown, TrendingUp, BarChart3, FileText, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { getMyScore, getLogs, type PerformanceScore, type StaffPerformanceLog } from "@/lib/api/performance"
import { useAuth } from "@/context/AuthContext"

const ESCALATION_COLORS: Record<string, string> = {
  none:            "bg-gray-100 text-gray-700",
  verbal_alert:    "bg-yellow-100 text-yellow-700",
  written_warning: "bg-orange-100 text-orange-700",
  final_warning:   "bg-red-100 text-red-800",
}
const ESCALATION_LABELS: Record<string, string> = {
  none: "None", verbal_alert: "Verbal Alert",
  written_warning: "Written Warning", final_warning: "Final Warning",
}

export default function TeacherPerformancePage() {
  const router = useRouter()
  const { profile } = useAuth()

  const [score,   setScore]   = useState<PerformanceScore | null>(null)
  const [logs,    setLogs]    = useState<StaffPerformanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  useEffect(() => {
    if (!profile?.staff_id) return
    setLoading(true)
    Promise.all([
      getMyScore(),
      getLogs({ staffId: profile.staff_id, limit: 100 }),
    ]).then(([s, lr]) => {
      setScore(s)
      setLogs(lr.data)
    }).catch(err => {
      setError(err.message || "Failed to load performance data")
    }).finally(() => setLoading(false))
  }, [profile?.staff_id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-lg font-medium">{error}</p>
            <Button className="mt-4" onClick={() => router.back()}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">
            My Performance
          </h1>
          <p className="text-sm text-muted-foreground">معدلات الأداء والكفاءة</p>
        </div>
      </div>

      {score && (
        <>
          {/* Score overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Circular meter */}
            <Card className="flex flex-col items-center justify-center py-8 md:col-span-1">
              <CardContent className="flex flex-col items-center gap-3">
                <div className="relative h-36 w-36">
                  <svg viewBox="0 0 100 100" className="-rotate-90">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="38" fill="none"
                      stroke={score.score >= 80 ? "#16a34a" : score.score >= 60 ? "#d97706" : "#dc2626"}
                      strokeWidth="10"
                      strokeDasharray={`${(score.score / 100) * 238.8} 238.8`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold">{score.score}</span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                </div>
                <p className={`text-base font-semibold ${score.score >= 80 ? "text-green-600" : score.score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                  {score.score >= 80 ? "Excellent" : score.score >= 60 ? "Good" : "Needs Improvement"}
                </p>
              </CardContent>
            </Card>

            {/* Stat cards */}
            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-muted-foreground">Demerit Points</span>
                  </div>
                  <p className="text-3xl font-bold text-red-600">-{score.total_demerit}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Redemption Points</span>
                  </div>
                  <p className="text-3xl font-bold text-green-600">+{score.total_redemption}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Total Incidents</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{score.log_count}</p>
                </CardContent>
              </Card>

              {/* Formula explanation */}
              <Card className="sm:col-span-3">
                <CardContent className="py-4">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Score formula:</strong>{" "}
                    100 − (total demerit points) + (total redemption points), clamped between 0 and 100.
                    Your current score: 100 − {score.total_demerit} + {score.total_redemption} = <strong>{score.score}</strong>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Incident log — read only */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Incident History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Action</th>
                    <th className="text-center px-4 py-3 text-muted-foreground font-medium">Type</th>
                    <th className="text-center px-4 py-3 text-muted-foreground font-medium">Escalation</th>
                    <th className="text-center px-4 py-3 text-muted-foreground font-medium">Points</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const pts = log.custom_points ?? log.action?.default_points ?? 0
                    const isDemerit = log.action?.action_type === "violation_demerit"
                    return (
                      <tr key={log.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{log.action?.action_name_en}</p>
                          <p className="text-xs text-muted-foreground" dir="rtl">{log.action?.action_name_ar}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={isDemerit ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                            {isDemerit ? (
                              <><TrendingDown className="mr-1 h-3 w-3 inline" />Violation</>
                            ) : (
                              <><TrendingUp className="mr-1 h-3 w-3 inline" />Reward</>
                            )}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={ESCALATION_COLORS[log.action?.escalation_stage || "none"]}>
                            {ESCALATION_LABELS[log.action?.escalation_stage || "none"]}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-center font-semibold ${isDemerit ? "text-red-600" : "text-green-600"}`}>
                          {isDemerit ? pts : `+${pts}`}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                          {log.notes || "—"}
                          {log.letter_generated && (
                            <FileText className="inline ml-2 h-3 w-3 text-orange-500" title="Disciplinary letter issued" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No incidents on record
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
