"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  Building2, Calendar, CheckCircle2, ChevronRight,
  Loader2, School, Clock, SkipForward,
} from "lucide-react"
import { createCampus, getSetupStatus } from "@/lib/api/setup-status"
import { createAcademicYear } from "@/lib/api/academics"
import { createMarkingPeriod } from "@/lib/api/marking-periods"

type Step = "welcome" | "campus" | "academic-year" | "quarters" | "complete"

interface QuarterDraft {
  title: string
  short_name: string
  start_date: string
  end_date: string
}

function splitIntoQuarters(startDate: string, endDate: string): QuarterDraft[] {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalMs = end.getTime() - start.getTime()
  const quarterMs = Math.floor(totalMs / 4)

  return [1, 2, 3, 4].map((q) => {
    const qStart = new Date(start.getTime() + (q - 1) * quarterMs)
    const qEnd = q === 4 ? end : new Date(start.getTime() + q * quarterMs - 86400000)
    return {
      title: `Quarter ${q}`,
      short_name: `Q${q}`,
      start_date: qStart.toISOString().split("T")[0],
      end_date: qEnd.toISOString().split("T")[0],
    }
  })
}

export default function SetupPage() {
  const t = useTranslations("common")
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [currentStep, setCurrentStep] = useState<Step>("welcome")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)

  // Campus form
  const [campusName, setCampusName] = useState("")
  const [campusAddress, setCampusAddress] = useState("")
  const [campusEmail, setCampusEmail] = useState("")
  const [campusPhone, setCampusPhone] = useState("")
  const [createdCampusId, setCreatedCampusId] = useState<string | null>(null)

  // Academic year form
  const [yearName, setYearName] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Quarters
  const [quarters, setQuarters] = useState<QuarterDraft[]>([])

  useEffect(() => {
    const checkStatus = async () => {
      if (authLoading) return
      try {
        const status = await getSetupStatus()
        if (status.isComplete) {
          router.replace("/admin/dashboard")
          return
        }
        if (status.hasCampuses && !status.hasAcademicYear) {
          setCurrentStep("academic-year")
        }
      } catch (error) {
        console.error("Error checking setup status:", error)
      } finally {
        setCheckingStatus(false)
      }
    }
    checkStatus()
  }, [authLoading, router])

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const suggestedName = now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`
    setYearName(suggestedName)
    const startYear = now.getMonth() >= 8 ? year : year - 1
    const s = `${startYear}-09-01`
    const e = `${startYear + 1}-06-30`
    setStartDate(s)
    setEndDate(e)
    setQuarters(splitIntoQuarters(s, e))
  }, [])

  const handleCreateCampus = async () => {
    if (!campusName.trim()) {
      toast.error("Please enter a campus name")
      return
    }
    setIsSubmitting(true)
    try {
      const campus = await createCampus({
        name: campusName,
        address: campusAddress || undefined,
        contact_email: campusEmail || undefined,
        phone: campusPhone || undefined,
      })
      setCreatedCampusId(campus.id)
      toast.success("Campus created successfully!")
      setCurrentStep("academic-year")
    } catch (error) {
      console.error("Error creating campus:", error)
      toast.error("Failed to create campus. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateAcademicYear = async () => {
    if (!yearName.trim() || !startDate || !endDate) {
      toast.error("Please fill in all required fields")
      return
    }
    setIsSubmitting(true)
    try {
      await createAcademicYear({ name: yearName, start_date: startDate, end_date: endDate, is_current: true })
      setQuarters(splitIntoQuarters(startDate, endDate))
      toast.success("Academic year created successfully!")
      setCurrentStep("quarters")
    } catch (error) {
      console.error("Error creating academic year:", error)
      toast.error("Failed to create academic year. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateQuarters = async () => {
    setIsSubmitting(true)
    try {
      const campusId = createdCampusId || null

      // 1. Full Year — spans entire academic year
      const fy = await createMarkingPeriod({
        mp_type: "FY",
        title: yearName || "Full Year",
        short_name: "FY",
        sort_order: 1,
        does_grades: true,
        does_comments: true,
        start_date: quarters[0].start_date,
        end_date: quarters[3].end_date,
        campus_id: campusId,
      })

      // 2. Two Semesters — S1 covers Q1+Q2, S2 covers Q3+Q4
      const [sem1, sem2] = await Promise.all([
        createMarkingPeriod({
          mp_type: "SEM",
          parent_id: fy.id,
          title: "Semester 1",
          short_name: "S1",
          sort_order: 1,
          does_grades: true,
          does_comments: true,
          start_date: quarters[0].start_date,
          end_date: quarters[1].end_date,
          campus_id: campusId,
        }),
        createMarkingPeriod({
          mp_type: "SEM",
          parent_id: fy.id,
          title: "Semester 2",
          short_name: "S2",
          sort_order: 2,
          does_grades: true,
          does_comments: true,
          start_date: quarters[2].start_date,
          end_date: quarters[3].end_date,
          campus_id: campusId,
        }),
      ])

      // 3. Four Quarters — Q1+Q2 under S1, Q3+Q4 under S2
      await Promise.all([
        createMarkingPeriod({ mp_type: "QTR", parent_id: sem1.id, title: quarters[0].title, short_name: quarters[0].short_name, sort_order: 1, does_grades: true, does_comments: true, start_date: quarters[0].start_date, end_date: quarters[0].end_date, campus_id: campusId }),
        createMarkingPeriod({ mp_type: "QTR", parent_id: sem1.id, title: quarters[1].title, short_name: quarters[1].short_name, sort_order: 2, does_grades: true, does_comments: true, start_date: quarters[1].start_date, end_date: quarters[1].end_date, campus_id: campusId }),
        createMarkingPeriod({ mp_type: "QTR", parent_id: sem2.id, title: quarters[2].title, short_name: quarters[2].short_name, sort_order: 3, does_grades: true, does_comments: true, start_date: quarters[2].start_date, end_date: quarters[2].end_date, campus_id: campusId }),
        createMarkingPeriod({ mp_type: "QTR", parent_id: sem2.id, title: quarters[3].title, short_name: quarters[3].short_name, sort_order: 4, does_grades: true, does_comments: true, start_date: quarters[3].start_date, end_date: quarters[3].end_date, campus_id: campusId }),
      ])

      toast.success("Quarters created successfully!")
      setCurrentStep("complete")
    } catch (error) {
      console.error("Error creating quarters:", error)
      toast.error("Failed to create quarters. You can set them up later in Settings → Marking Periods.")
      setCurrentStep("complete")
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateQuarter = (index: number, field: keyof QuarterDraft, value: string) => {
    setQuarters((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)))
  }

  const handleComplete = () => {
    router.push("/admin/dashboard")
  }

  if (authLoading || checkingStatus) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-[#022172]" />
          <p className="text-gray-600 dark:text-gray-400">{t("loading")}</p>
        </div>
      </div>
    )
  }

  const steps = [
    { id: "welcome", label: "Welcome", icon: School },
    { id: "campus", label: "Campus", icon: Building2 },
    { id: "academic-year", label: "Academic Year", icon: Calendar },
    { id: "quarters", label: "Quarters", icon: Clock },
    { id: "complete", label: "Complete", icon: CheckCircle2 },
  ]

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isActive = step.id === currentStep
          const isComplete = index < currentStepIndex
          return (
            <div key={step.id} className="flex items-center">
              <div className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                ${isActive ? "bg-[#022172] text-white" : ""}
                ${isComplete ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : ""}
                ${!isActive && !isComplete ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500" : ""}
              `}>
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-1" />
              )}
            </div>
          )
        })}
      </div>

      {/* Welcome */}
      {currentStep === "welcome" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-linear-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center">
              <School className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Welcome to iStudent.ly!</CardTitle>
            <CardDescription className="text-base mt-2">
              Let&apos;s set up your school in just a few steps. You&apos;ll create a campus,
              academic year, and grading quarters to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3 mb-6">
              {[
                { icon: Building2, title: "Step 1: Create a Campus", desc: "A campus is a physical location of your school. You can add more later." },
                { icon: Calendar, title: "Step 2: Set Up Academic Year", desc: "Define your current academic year with start and end dates." },
                { icon: Clock, title: "Step 3: Create Quarters", desc: "Set up grading quarters so teachers can record marks each period." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <Icon className="h-5 w-5 text-[#022172] dark:text-[#57A3CC] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => setCurrentStep("campus")} className="w-full bg-[#022172] hover:bg-[#022172]/90">
              Get Started
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Campus */}
      {currentStep === "campus" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#022172] dark:text-[#57A3CC]" />
              Create Your First Campus
            </CardTitle>
            <CardDescription>
              Enter the details for your school&apos;s main campus. You can add more campuses later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campusName">Campus Name *</Label>
              <Input id="campusName" placeholder="e.g., Main Campus, Downtown Branch" value={campusName} onChange={(e) => setCampusName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campusAddress">Address</Label>
              <Textarea id="campusAddress" placeholder="Enter the campus address" value={campusAddress} onChange={(e) => setCampusAddress(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campusEmail">Contact Email</Label>
                <Input id="campusEmail" type="email" placeholder="campus@school.com" value={campusEmail} onChange={(e) => setCampusEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campusPhone">Phone Number</Label>
                <Input id="campusPhone" type="tel" placeholder="+1 234 567 8900" value={campusPhone} onChange={(e) => setCampusPhone(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep("welcome")} disabled={isSubmitting}>Back</Button>
              <Button onClick={handleCreateCampus} disabled={isSubmitting || !campusName.trim()} className="flex-1 bg-[#022172] hover:bg-[#022172]/90">
                {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <>Create Campus<ChevronRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Academic Year */}
      {currentStep === "academic-year" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#022172] dark:text-[#57A3CC]" />
              Set Up Academic Year
            </CardTitle>
            <CardDescription>
              Define your current academic year. This will be used for enrollments and scheduling.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yearName">Academic Year Name *</Label>
              <Input id="yearName" placeholder="e.g., 2024-2025" value={yearName} onChange={(e) => setYearName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (e.target.value && endDate) setQuarters(splitIntoQuarters(e.target.value, endDate)) }} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); if (startDate && e.target.value) setQuarters(splitIntoQuarters(startDate, e.target.value)) }} />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep("campus")} disabled={isSubmitting}>Back</Button>
              <Button onClick={handleCreateAcademicYear} disabled={isSubmitting || !yearName.trim() || !startDate || !endDate} className="flex-1 bg-[#022172] hover:bg-[#022172]/90">
                {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <>Create Academic Year<ChevronRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quarters */}
      {currentStep === "quarters" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#022172] dark:text-[#57A3CC]" />
              Set Up Grading Quarters
            </CardTitle>
            <CardDescription>
              We&apos;ve pre-calculated 4 quarters from your academic year. Adjust the dates if needed,
              then click &quot;Create Quarters&quot; — or skip and set them up later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quarters.map((q, i) => (
              <div key={i} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600 dark:text-gray-300">Quarter Name</Label>
                    <Input value={q.title} onChange={(e) => updateQuarter(i, "title", e.target.value)} placeholder={`Quarter ${i + 1}`} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600 dark:text-gray-300">Short Name</Label>
                    <Input value={q.short_name} onChange={(e) => updateQuarter(i, "short_name", e.target.value)} placeholder={`Q${i + 1}`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600 dark:text-gray-300">Start Date</Label>
                    <Input type="date" value={q.start_date} onChange={(e) => updateQuarter(i, "start_date", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600 dark:text-gray-300">End Date</Label>
                    <Input type="date" value={q.end_date} onChange={(e) => updateQuarter(i, "end_date", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setCurrentStep("complete")} disabled={isSubmitting} className="gap-2 text-gray-600 dark:text-gray-300">
                <SkipForward className="h-4 w-4" />
                Skip for Now
              </Button>
              <Button onClick={handleCreateQuarters} disabled={isSubmitting} className="flex-1 bg-[#022172] hover:bg-[#022172]/90">
                {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <>Create Quarters<ChevronRight className="h-4 w-4 ml-2" /></>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete */}
      {currentStep === "complete" && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl text-green-700 dark:text-green-400">Setup Complete!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your school is now ready to use. You can start adding students, teachers, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">What&apos;s Next?</h3>
              <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
                <li>• Add teachers and staff to your school</li>
                <li>• Create grade levels and sections</li>
                <li>• Enroll students</li>
                <li>• Set up your timetable</li>
              </ul>
            </div>
            <Button onClick={handleComplete} className="w-full bg-[#022172] hover:bg-[#022172]/90">
              Go to Dashboard
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
