"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { 
  AlertCircle, 
  Search, 
  Loader2, 
  Save, 
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  RefreshCw,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import * as timetableApi from "@/lib/api/timetable"
import * as activitiesApi from "@/lib/api/activities"
import { TeacherSchedule } from "@/lib/api/teachers"
import { useSearchParams, useRouter } from "next/navigation"
import useSWR from "swr"

type EligibilityStatus = "PASSING" | "BORDERLINE" | "FAILING" | "INCOMPLETE"

interface StudentEligibilityRow {
  student_id: string
  student_name: string
  student_number: string
  grade_level: string
  eligibility_code: EligibilityStatus
}

interface ClassInfo {
  id: string
  subject_name: string
  section_name: string
  grade_name: string
  period_number: number
  start_time: string
  end_time: string
  room_number?: string
}

export default function EligibilityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const classId = searchParams.get("class")

  const [studentData, setStudentData] = useState<StudentEligibilityRow[]>([])
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [todayDate] = useState(new Date().toISOString().split('T')[0])

  // Fetch today's schedule for class selection
  const { data: schedule, isLoading: scheduleLoading } = useSWR(
    profile?.staff_id ? `teacher-schedule-${profile.staff_id}` : null,
    async () => {
      if (!profile?.staff_id) return []
      return await timetableApi.getTeacherSchedule(profile.staff_id, todayDate)
    },
    { revalidateOnFocus: false }
  )

  const todayClasses = schedule || []

  // Load roster and eligibility data function
  const loadData = useCallback(async () => {
    try {
      if (!classId || !profile?.school_id) return
      setLoadingData(true)
      
      // Load roster by piggy-backing on attendance record endpoint which returns the full roster reliably
      const rosterRecords = await timetableApi.getAttendanceForClass(classId, todayDate)
      
      // Load existing eligibility records for this class and date
      const eligRes = await activitiesApi.getEligibility({
        school_id: profile.school_id,
        course_period_id: classId,
        school_date: todayDate,
        campus_id: profile.campus_id
      })
      const existingElig = eligRes.data || []
      
      // Map roster into eligibility rows
      const combinedData: StudentEligibilityRow[] = rosterRecords.map((r) => {
        const found = existingElig.find((e: any) => e.student_id === r.student_id)
        return {
          student_id: r.student_id,
          student_name: r.student_name || "Unknown Student",
          student_number: r.student_number || "",
          grade_level: "Section", // Assuming default as we don't have direct grade_level per student here easily, although UI shows "Moyenne Section"
          eligibility_code: (found?.eligibility_code as EligibilityStatus) || "PASSING"
        }
      })
      
      setStudentData(combinedData)
      
      // Find class info from schedule
      const selectedClass = schedule?.find((s: TeacherSchedule) => s.id === classId)
      if (selectedClass) {
        setClassInfo({
          id: selectedClass.id,
          subject_name: selectedClass.subject_name || "Unknown Subject",
          section_name: selectedClass.section_name || "Unknown Section",
          grade_name: selectedClass.grade_name || "Unknown Grade",
          period_number: selectedClass.period_number,
          start_time: selectedClass.start_time,
          end_time: selectedClass.end_time,
          room_number: selectedClass.room_number || undefined
        })
      }
      
      setHasChanges(false)
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load eligibility data"
      toast.error(errorMessage)
    } finally {
      setLoadingData(false)
    }
  }, [classId, schedule, todayDate, profile])

  // Fetch data when class is selected
  useEffect(() => {
    if (classId && schedule && profile?.school_id) {
      loadData()
    }
  }, [classId, schedule, loadData, profile])

  // Update eligibility radio
  const setEligibility = useCallback((studentId: string, status: EligibilityStatus) => {
    setStudentData(prev => prev.map(s => 
      s.student_id === studentId 
        ? { ...s, eligibility_code: status }
        : s
    ))
    setHasChanges(true)
  }, [])

  // Save 
  const handleSave = async () => {
    try {
      setSaving(true)
      
      if (!classId || !profile?.school_id) {
        toast.error("Error: No class selected")
        return
      }
      
      // Prepare bulk update data
      await activitiesApi.saveEligibility({
        school_id: profile.school_id,
        campus_id: profile.campus_id,
        course_period_id: classId,
        school_date: todayDate,
        records: studentData.map(r => ({
          student_id: r.student_id,
          eligibility_code: r.eligibility_code
        }))
      })
      
      setHasChanges(false)
      toast.success("Eligibility saved successfully!")
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save eligibility"
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  // Filter and search students
  const filteredStudents = studentData.filter(student => {
    return student.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_number.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Loading state
  if (scheduleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // No class selected - show class picker
  if (!classId) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/teacher/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-brand-blue dark:text-white">Enter Eligibility</h1>
            <p className="text-muted-foreground mt-1">Select a class to manage student activity eligibilities</p>
          </div>
        </div>

        {/* Today's date */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-sm text-blue-700">
                  {todayClasses.length} {todayClasses.length === 1 ? 'class' : 'classes'} scheduled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Class List */}
        {todayClasses.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Classes Today</h3>
            <p className="text-muted-foreground">You don&apos;t have any classes scheduled for today.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {todayClasses.map((cls: TeacherSchedule, index: number) => {
              const now = new Date()
              const currentTime = now.toTimeString().split(' ')[0].substring(0, 5)
              const isInProgress = cls.start_time <= currentTime && currentTime < cls.end_time
              const isCompleted = cls.end_time < currentTime
              
              return (
                <Card 
                  key={cls.id || index}
                  className={`cursor-pointer transition-all hover:shadow-lg border-2 border-gray-200 hover:border-blue-400`}
                  onClick={() => router.push(`/teacher/activities/eligibility?class=${cls.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`h-14 w-14 rounded-lg flex flex-col items-center justify-center bg-blue-600 text-white`}>
                          <span className="text-xs">Period</span>
                          <span className="text-xl font-bold">{cls.period_number}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{cls.subject_name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" /> {cls.section_name}
                            </span>
                            <span className="mx-2">•</span>
                            <span>{cls.grade_name}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600">
                          {cls.start_time?.substring(0, 5)} - {cls.end_time?.substring(0, 5)}
                        </p>
                        {cls.room_number && (
                          <p className="text-xs text-muted-foreground">Room {cls.room_number}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Loading data view
  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Loading roster...</p>
        </div>
      </div>
    )
  }

  // Main Eligibility marking view
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 text-brand-teal">
        <Button variant="ghost" size="icon" onClick={() => router.push('/teacher/activities/eligibility')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-8 w-8 rounded bg-teal-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">🏀</span>
        </div>
        <h1 className="text-3xl font-light">Enter Eligibility</h1>
      </div>

      <div className="flex items-center justify-between bg-gray-50 border p-3 rounded-sm">
        <span className="text-sm font-medium">
          Half Day AM - {classInfo?.subject_name} ({classInfo?.section_name}) - {profile?.first_name} {profile?.last_name}
        </span>
        <Button 
          onClick={handleSave}
          disabled={saving || !hasChanges}
          size="sm"
          className="bg-brand-blue hover:bg-blue-700 font-semibold uppercase px-6 tracking-wide"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Save"}
        </Button>
      </div>

      <div className="text-blue-600 text-sm font-medium cursor-pointer hover:underline pl-1 inline-block">
        Use Gradebook Grades
      </div>

      <div className="flex justify-between items-center bg-gray-50 border-y py-2 px-1 mt-4">
        <p className="text-sm font-semibold">{filteredStudents.length} students were found.</p>
        <div className="flex gap-4 items-center">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Student List */}
      <Card className="rounded-none shadow-sm border-gray-200 mt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-brand-blue font-bold uppercase tracking-wider">STUDENT</th>
                <th className="px-4 py-3 text-brand-blue font-bold uppercase tracking-wider">ROSARIOSIS ID</th>
                <th className="px-4 py-3 text-brand-blue font-bold uppercase tracking-wider">GRADE LEVEL</th>
                <th className="px-4 py-3 text-brand-blue font-bold uppercase tracking-wider text-center">PASSING</th>
                <th className="px-4 py-3 text-brand-blue font-bold uppercase tracking-wider text-center">BORDERLINE</th>
                <th className="px-4 py-3 text-brand-blue font-bold uppercase tracking-wider text-center">FAILING</th>
                <th className="px-4 py-3 text-brand-blue font-bold uppercase tracking-wider text-center">INCOMPLETE</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.student_id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{student.student_name}</td>
                    <td className="px-4 py-3">{student.student_number}</td>
                    <td className="px-4 py-3">{classInfo?.grade_name || "Section"}</td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="radio" 
                        name={`eligibility-${student.student_id}`}
                        checked={student.eligibility_code === 'PASSING'}
                        onChange={() => setEligibility(student.student_id, 'PASSING')}
                        className="h-4 w-4 text-brand-blue border-gray-300 focus:ring-brand-blue cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="radio" 
                        name={`eligibility-${student.student_id}`}
                        checked={student.eligibility_code === 'BORDERLINE'}
                        onChange={() => setEligibility(student.student_id, 'BORDERLINE')}
                        className="h-4 w-4 text-brand-blue border-gray-300 focus:ring-brand-blue cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="radio" 
                        name={`eligibility-${student.student_id}`}
                        checked={student.eligibility_code === 'FAILING'}
                        onChange={() => setEligibility(student.student_id, 'FAILING')}
                        className="h-4 w-4 text-brand-blue border-gray-300 focus:ring-brand-blue cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="radio" 
                        name={`eligibility-${student.student_id}`}
                        checked={student.eligibility_code === 'INCOMPLETE'}
                        onChange={() => setEligibility(student.student_id, 'INCOMPLETE')}
                        className="h-4 w-4 text-brand-blue border-gray-300 focus:ring-brand-blue cursor-pointer"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      <div className="flex justify-center mt-6">
        <Button 
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-brand-blue hover:bg-blue-700 font-semibold uppercase px-8"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Save"}
        </Button>
      </div>

    </div>
  )
}
