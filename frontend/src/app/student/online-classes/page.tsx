"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Video, Loader2, Users, CalendarClock, ListChecks } from "lucide-react"
import { listOpenOnlineClasses, enrollInOnlineClass, type OpenOnlineClass } from "@/lib/api/online-classes"

export default function StudentBrowseOnlineClassesPage() {
  const t = useTranslations("online_classes")
  const [courses, setCourses] = useState<OpenOnlineClass[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await listOpenOnlineClasses()
    if (res.data) setCourses(res.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleEnroll = async (id: string) => {
    setEnrolling(id)
    const res = await enrollInOnlineClass(id)
    setEnrolling(null)
    if (res.error) { toast.error(res.error); return }
    toast.success(t("msg_enrolled"))
    load()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Video className="h-6 w-6" /> {t("browse_open_courses")}</h1>
          <p className="text-muted-foreground mt-1">{t("student_subtitle")}</p>
        </div>
        <Button variant="outline" asChild className="gap-2">
          <Link href="/student/online-classes/enrolled"><ListChecks className="h-4 w-4" /> {t("my_enrolled_classes")}</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : courses.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Video className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{t("no_open_courses")}</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map(c => {
            const full = c.seats_remaining <= 0
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base" dir="auto">{c.title}</CardTitle>
                  {c.description && <CardDescription dir="auto">{c.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {c.scheduled_days && (
                      <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {c.scheduled_days}</span>
                    )}
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t("seats_remaining", { count: c.seats_remaining })}</span>
                  </div>
                  <Button
                    size="sm"
                    disabled={full || enrolling === c.id}
                    onClick={() => handleEnroll(c.id)}
                    className="w-full gap-1.5"
                  >
                    {enrolling === c.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {full ? t("full") : t("enroll")}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
