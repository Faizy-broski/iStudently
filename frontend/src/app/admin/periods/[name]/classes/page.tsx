"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { getAuthToken } from "@/lib/api/schools"
import { toast } from "sonner"
import { 
  ArrowLeft, 
  Search, 
  Loader2, 
  Calendar, 
  X
} from "lucide-react"
import Link from "next/link"

interface PeriodClass {
  id: string
  day_of_week: number
  day_name: string
  room_number: string | null
  section_id: string
  section_name: string
  grade_name: string
  subject_id: string
  subject_name: string
  subject_code: string
  teacher_id: string
  teacher_name: string
  period_title: string
  period_short_name: string
}

interface Period {
  id: string
  title: string
  short_name: string
  sort_order: number
  length_minutes: number
}

export default function PeriodClassesPage() {
  const params = useParams()
  const router = useRouter()
  const periodName = decodeURIComponent(params.name as string)
  
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [period, setPeriod] = useState<Period | null>(null)
  const [classes, setClasses] = useState<PeriodClass[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchData = useCallback(async () => {
    if (!profile?.school_id || !periodName) {
      setLoading(false)
      return
    }

    const token = await getAuthToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      // Build URL with campus filter
      const periodUrl = new URL(`${process.env.NEXT_PUBLIC_API_URL}/periods/by-name/${encodeURIComponent(periodName)}`)
      if (selectedCampus?.id) {
        periodUrl.searchParams.append('campus_id', selectedCampus.id)
      }

      // Fetch period details by name
      const periodRes = await fetch(periodUrl.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const periodData = await periodRes.json()
      
      if (periodData.success && periodData.data) {
        setPeriod(periodData.data)
      }

      // Fetch classes for this period by name
      const classesUrl = new URL(`${process.env.NEXT_PUBLIC_API_URL}/periods/by-name/${encodeURIComponent(periodName)}/classes`)
      if (selectedCampus?.id) {
        classesUrl.searchParams.append('campus_id', selectedCampus.id)
      }

      const classesRes = await fetch(classesUrl.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const classesData = await classesRes.json()
      
      if (classesData.success && classesData.data) {
        setClasses(classesData.data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load period classes")
    } finally {
      setLoading(false)
    }
  }, [profile?.school_id, periodName, selectedCampus?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter classes based on search
  const filteredClasses = classes.filter(cls => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      cls.section_name?.toLowerCase().includes(query) ||
      cls.grade_name?.toLowerCase().includes(query) ||
      cls.subject_name?.toLowerCase().includes(query) ||
      cls.teacher_name?.toLowerCase().includes(query) ||
      cls.day_name?.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/periods')}
            className="gap-2 hover:text-[#022172]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Periods
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[#022172]">
              {period?.title || periodName} Classes
            </h1>
            <p className="text-muted-foreground">
              {period?.short_name} • {period?.length_minutes} minutes
              {selectedCampus ? ` • ${selectedCampus.name}` : ''}
            </p>
          </div>
        </div>
        <Badge className="text-lg px-4 py-2 bg-[#57A3CC] hover:bg-[#57A3CC]">
          {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'}
        </Badge>
      </div>

      {/* Search */}
      <Card className="border-[#57A3CC]/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-center text-[#022172]">SEARCH</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="relative w-full max-w-md">
              <Input
                placeholder="Search by class, teacher, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 border-[#57A3CC] focus-visible:ring-[#022172]"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#022172]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#57A3CC]" />
              )}
            </div>
          </div>
          <div className="flex justify-center">
            <Button 
              className="bg-[#022172] hover:bg-[#022172]/90"
              onClick={() => {/* Search is automatic */}}
            >
              SEARCH
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {filteredClasses.length === 0 ? (
        <Card className="border-[#57A3CC]/30">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-[#57A3CC]/30" />
            <h3 className="text-lg font-medium text-muted-foreground">
              {searchQuery ? 'No classes match your search' : 'No classes scheduled for this period'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery 
                ? 'Try a different search term' 
                : 'Go to the timetable builder to assign classes to this period'}
            </p>
            {!searchQuery && (
              <Link href="/admin/timetable">
                <Button className="mt-4 bg-[#022172] hover:bg-[#022172]/90">
                  Go to Timetable
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <p className="text-sm text-muted-foreground">
            {filteredClasses.length} course period{filteredClasses.length !== 1 ? 's' : ''} found.
          </p>

          {/* Classes Table */}
          <Card className="border-[#57A3CC]/30">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gradient-to-r from-[#57A3CC]/10 to-[#022172]/10">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                      Course Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                      Day
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#022172] uppercase tracking-wider">
                      Room
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.map((cls) => (
                    <tr key={cls.id} className="border-b hover:bg-[#57A3CC]/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <Link 
                              href={`/admin/timetable`}
                              className="text-[#022172] hover:text-[#57A3CC] hover:underline font-medium"
                            >
                              {period?.title} - {cls.subject_name} - {cls.teacher_name}
                            </Link>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs border-[#57A3CC] text-[#022172]">
                                {cls.grade_name} - {cls.section_name}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-[#57A3CC] hover:bg-[#57A3CC]">
                          {cls.day_name}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {cls.room_number || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
