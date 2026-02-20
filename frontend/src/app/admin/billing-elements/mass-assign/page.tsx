"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import { Loader2, Search, Download } from "lucide-react"
import {
  getElements,
  getStudentsForAssign,
  massAssignElement,
  type BillingElement,
  type StudentForAssign,
} from "@/lib/api/billing-elements"
import { getGradeLevels, getSections, type GradeLevel, type Section } from "@/lib/api/academics"

export default function MassAssignElementsPage() {
  const { profile } = useAuth()

  // Element & Fee form
  const [allElements, setAllElements] = useState<BillingElement[]>([])
  const [selectedElementId, setSelectedElementId] = useState("")
  const [formTitle, setFormTitle] = useState("")
  const [formAmount, setFormAmount] = useState<number>(0)
  const [formDueDate, setFormDueDate] = useState("")
  const [formComment, setFormComment] = useState("")

  // Filters
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedGrade, setSelectedGrade] = useState("")
  const [selectedSection, setSelectedSection] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Students
  const [students, setStudents] = useState<StudentForAssign[]>([])
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [loadingStudents, setLoadingStudents] = useState(false)

  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)

  const fetchInitialData = useCallback(async () => {
    try {
      const [elementsData, gradesRes] = await Promise.all([
        getElements(),
        getGradeLevels()
      ])
      setAllElements(elementsData)
      if (gradesRes.success && gradesRes.data) setGrades(gradesRes.data)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (profile?.school_id) fetchInitialData()
  }, [profile?.school_id, fetchInitialData])

  // When element is selected, populate title and amount
  const handleElementChange = (elementId: string) => {
    setSelectedElementId(elementId)
    if (elementId) {
      const el = allElements.find((e) => e.id === elementId)
      if (el) {
        setFormTitle(el.title)
        setFormAmount(el.amount)
      }
    } else {
      setFormTitle("")
      setFormAmount(0)
    }
  }

  // Load sections when grade changes
  const handleGradeChange = async (gradeId: string) => {
    setSelectedGrade(gradeId)
    setSelectedSection("")
    setSections([])
    if (gradeId) {
      try {
        const res = await getSections(gradeId)
        if (res.success && res.data) setSections(res.data)
      } catch {}
    }
    // Load students
    fetchStudents(gradeId, "")
  }

  const handleSectionChange = (sectionId: string) => {
    setSelectedSection(sectionId)
    fetchStudents(selectedGrade, sectionId)
  }

  const fetchStudents = async (gradeId?: string, sectionId?: string) => {
    setLoadingStudents(true)
    try {
      const data = await getStudentsForAssign(gradeId, sectionId)
      setStudents(data)
      setSelectedStudents(new Set())
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load students")
    } finally {
      setLoadingStudents(false)
    }
  }

  useEffect(() => {
    if (profile?.school_id) {
      fetchStudents()
    }
  }, [profile?.school_id])

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudents)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStudents(next)
  }

  const toggleAll = () => {
    if (selectedStudents.size === filtered.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(filtered.map((s) => s.id)))
    }
  }

  const filtered = students.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.admission_number || "").toLowerCase().includes(q)
  })

  const handleAssign = async () => {
    if (selectedStudents.size === 0) {
      toast.error("Select at least one student")
      return
    }
    if (!formTitle.trim()) {
      toast.error("Element title is required")
      return
    }
    setAssigning(true)
    try {
      const result = await massAssignElement({
        student_ids: Array.from(selectedStudents),
        billing_element_id: selectedElementId || null,
        element_title: formTitle.trim(),
        amount: formAmount,
        due_date: formDueDate || null,
        comment: formComment.trim() || null,
      })
      toast.success(`Element and fee added to ${result.count} students`)
      setSelectedStudents(new Set())
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    } finally {
      setAssigning(false)
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
            Mass Assign Elements
          </h1>
          <p className="text-muted-foreground">
            Assign billing elements and fees to multiple students at once
          </p>
        </div>
        <Button
          className="bg-[#008B8B] hover:bg-[#007070] text-white"
          onClick={handleAssign}
          disabled={assigning || selectedStudents.size === 0}
        >
          {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          ADD ELEMENT AND FEE TO SELECTED STUDENTS
        </Button>
      </div>

      {/* Element and Fee Form (centered card like RosarioSIS) */}
      <div className="flex justify-center">
        <div className="bg-white dark:bg-gray-900 border rounded-lg p-6 w-full max-w-md">
          <h2 className="text-center font-semibold text-[#022172] border-b pb-2 mb-4">
            ELEMENT AND FEE
          </h2>
          <div className="space-y-4">
            <div>
              <select
                value={selectedElementId}
                onChange={(e) => handleElementChange(e.target.value)}
                className="w-full h-9 border rounded px-3 text-sm"
              >
                <option value="">N/A</option>
                {allElements.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.category_title ? `${el.category_title} — ` : ""}{el.title}
                  </option>
                ))}
              </select>
              <label className="text-xs font-medium text-red-600">Element</label>
            </div>
            <div>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Fee title"
              />
              <label className="text-xs font-medium text-red-600">Title</label>
            </div>
            <div>
              <Input
                type="number"
                step="0.01"
                value={formAmount || ""}
                onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-32"
              />
              <label className="text-xs font-medium text-red-600">Amount</label>
            </div>
            <div>
              <Input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
              <label className="text-xs font-medium text-gray-600">Due Date</label>
            </div>
            <div>
              <Input
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                placeholder=""
              />
              <label className="text-xs font-medium text-gray-600">Comment</label>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500">Grade</label>
          <select
            value={selectedGrade}
            onChange={(e) => handleGradeChange(e.target.value)}
            className="ml-2 h-8 border rounded px-2 text-sm"
          >
            <option value="">All</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => handleSectionChange(e.target.value)}
            className="ml-2 h-8 border rounded px-2 text-sm"
            disabled={!selectedGrade}
          >
            <option value="">All</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Student List */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {filtered.length} student{filtered.length !== 1 ? "s" : ""} found.
            </span>
            {selectedStudents.size > 0 && (
              <span className="text-sm text-[#008B8B] font-medium">
                ({selectedStudents.size} selected)
              </span>
            )}
            <Download className="h-4 w-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="h-8 w-40"
            />
          </div>
        </div>

        {loadingStudents ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedStudents.size === filtered.length}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Student</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Admission No.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Grade Level</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b hover:bg-gray-50 cursor-pointer ${selectedStudents.has(s.id) ? "bg-blue-50" : ""}`}
                  onClick={() => toggleStudent(s.id)}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedStudents.has(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-[#008B8B]">{s.name}</td>
                  <td className="px-3 py-2">{s.admission_number || "—"}</td>
                  <td className="px-3 py-2">{s.grade_level}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                    No students found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Button */}
      <div className="flex justify-center">
        <Button
          className="bg-[#008B8B] hover:bg-[#007070] text-white"
          onClick={handleAssign}
          disabled={assigning || selectedStudents.size === 0}
        >
          {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          ADD ELEMENT AND FEE TO SELECTED STUDENTS
        </Button>
      </div>
    </div>
  )
}
