"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import {
  Loader2,
  Search,
  Download,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
} from "lucide-react"
import {
  getStudentsForAssign,
  getStudentElements,
  assignElement,
  updateStudentElement,
  deleteStudentElement,
  getElements,
  type StudentForAssign,
  type StudentBillingElement,
  type BillingElement,
} from "@/lib/api/billing-elements"
import { getGradeLevels, getSections, type GradeLevel, type Section } from "@/lib/api/academics"

export default function StudentElementsPage() {
  const { profile } = useAuth()

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "detail">("list")
  const [selectedStudent, setSelectedStudent] = useState<StudentForAssign | null>(null)

  // Filters
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [selectedGrade, setSelectedGrade] = useState("")
  const [selectedSection, setSelectedSection] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [expanded, setExpanded] = useState(false)

  // Student list
  const [students, setStudents] = useState<StudentForAssign[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Student detail
  const [studentElements, setStudentElements] = useState<StudentBillingElement[]>([])
  const [allElements, setAllElements] = useState<BillingElement[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)

  // New element row
  const [newRow, setNewRow] = useState({
    billing_element_id: "",
    element_title: "",
    amount: 0,
    due_date: "",
    comment: "",
  })

  const [loading, setLoading] = useState(true)

  const fetchInitialData = useCallback(async () => {
    try {
      const gradesRes = await getGradeLevels()
      if (gradesRes.success && gradesRes.data) setGrades(gradesRes.data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    if (profile?.school_id) fetchInitialData()
  }, [profile?.school_id, fetchInitialData])

  const fetchStudents = useCallback(async (gradeId?: string, sectionId?: string) => {
    setLoadingStudents(true)
    try {
      const data = await getStudentsForAssign(gradeId, sectionId)
      setStudents(data)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load students")
    } finally {
      setLoadingStudents(false)
    }
  }, [])

  useEffect(() => {
    if (profile?.school_id) fetchStudents()
  }, [profile?.school_id, fetchStudents])

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
    fetchStudents(gradeId, "")
  }

  const handleSectionChange = (sectionId: string) => {
    setSelectedSection(sectionId)
    fetchStudents(selectedGrade, sectionId)
  }

  const filtered = students.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.admission_number || "").toLowerCase().includes(q)
  })

  // Open student detail
  const openStudent = async (student: StudentForAssign) => {
    setSelectedStudent(student)
    setViewMode("detail")
    setLoadingDetail(true)
    try {
      const [elementsData, sbeData] = await Promise.all([
        getElements(),
        getStudentElements({ student_id: student.id }),
      ])
      setAllElements(elementsData)
      setStudentElements(sbeData)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load student elements")
    } finally {
      setLoadingDetail(false)
    }
  }

  const goBack = () => {
    setViewMode("list")
    setSelectedStudent(null)
    setStudentElements([])
    setNewRow({ billing_element_id: "", element_title: "", amount: 0, due_date: "", comment: "" })
  }

  // When element dropdown changes in new row
  const handleNewElementChange = (elementId: string) => {
    setNewRow((prev) => {
      if (elementId) {
        const el = allElements.find((e) => e.id === elementId)
        return { ...prev, billing_element_id: elementId, element_title: el?.title || "", amount: el?.amount || 0 }
      }
      return { ...prev, billing_element_id: "", element_title: "", amount: 0 }
    })
  }

  const handleAddElement = async () => {
    if (!selectedStudent || !newRow.element_title.trim()) {
      toast.error("Element title is required")
      return
    }
    setSaving(true)
    try {
      await assignElement({
        student_id: selectedStudent.id,
        billing_element_id: newRow.billing_element_id || null,
        element_title: newRow.element_title.trim(),
        amount: newRow.amount,
        due_date: newRow.due_date || null,
        comment: newRow.comment.trim() || null,
      })
      toast.success("Element added")
      // Refresh
      const data = await getStudentElements({ student_id: selectedStudent.id })
      setStudentElements(data)
      setNewRow({ billing_element_id: "", element_title: "", amount: 0, due_date: "", comment: "" })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveElement = async (sbe: StudentBillingElement) => {
    setSaving(true)
    try {
      await updateStudentElement(sbe.id, {
        element_title: sbe.element_title,
        amount: sbe.amount,
        due_date: sbe.due_date,
        comment: sbe.comment,
      })
      toast.success("Saved")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteElement = async (id: string) => {
    if (!confirm("Remove this element from the student?")) return
    try {
      await deleteStudentElement(id)
      toast.success("Removed")
      if (selectedStudent) {
        const data = await getStudentElements({ student_id: selectedStudent.id })
        setStudentElements(data)
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    }
  }

  const updateSBE = (id: string, field: string, value: string | number | null) => {
    setStudentElements((prev) =>
      prev.map((sbe) => (sbe.id === id ? { ...sbe, [field]: value } : sbe))
    )
  }

  const totalFromElements = studentElements.reduce((sum, sbe) => sum + (sbe.amount || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ---- DETAIL VIEW ----
  if (viewMode === "detail" && selectedStudent) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172]">
                Student Elements
              </h1>
            </div>
            <p className="text-muted-foreground ml-20">
              {selectedStudent.name} — {selectedStudent.grade_level} {selectedStudent.section_name}
            </p>
          </div>
        </div>

        {loadingDetail ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg border">
            {studentElements.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-500 border-b font-medium">No fees were found.</p>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Element and Fee</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Assigned</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Due</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Comment</th>
                  <th className="w-16 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {studentElements.map((sbe) => (
                  <tr key={sbe.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleDeleteElement(sbe.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={sbe.billing_element_id || ""}
                          onChange={(e) => {
                            const elId = e.target.value
                            const el = allElements.find((x) => x.id === elId)
                            updateSBE(sbe.id, "billing_element_id", elId || null)
                            if (el) {
                              updateSBE(sbe.id, "element_title", el.title)
                            }
                          }}
                          className="h-7 border rounded px-1 text-sm w-24"
                        >
                          <option value="">N/A</option>
                          {allElements.map((el) => (
                            <option key={el.id} value={el.id}>{el.title}</option>
                          ))}
                        </select>
                        <Input
                          value={sbe.element_title}
                          onChange={(e) => updateSBE(sbe.id, "element_title", e.target.value)}
                          className="h-7 w-32 text-xs"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={sbe.amount}
                        onChange={(e) => updateSBE(sbe.id, "amount", parseFloat(e.target.value) || 0)}
                        className="h-7 w-24 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {sbe.assigned_date ? new Date(sbe.assigned_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="date"
                        value={sbe.due_date || ""}
                        onChange={(e) => updateSBE(sbe.id, "due_date", e.target.value || null)}
                        className="h-7 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        sbe.status === "paid" ? "bg-green-100 text-green-700" :
                        sbe.status === "partial" ? "bg-yellow-100 text-yellow-700" :
                        sbe.status === "overdue" ? "bg-red-100 text-red-700" :
                        sbe.status === "waived" ? "bg-gray-100 text-gray-500" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {sbe.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={sbe.comment || ""}
                        onChange={(e) => updateSBE(sbe.id, "comment", e.target.value)}
                        className="h-7 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleSaveElement(sbe)}>
                        <Save className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    </td>
                  </tr>
                ))}

                {/* New element row */}
                <tr className="border-b bg-gray-50">
                  <td className="px-3 py-2">
                    <Plus className="h-4 w-4 text-green-600" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={newRow.billing_element_id}
                        onChange={(e) => handleNewElementChange(e.target.value)}
                        className="h-7 border rounded px-1 text-sm w-24"
                      >
                        <option value="">N/A</option>
                        {allElements.map((el) => (
                          <option key={el.id} value={el.id}>{el.title}</option>
                        ))}
                      </select>
                      <Input
                        value={newRow.element_title}
                        onChange={(e) => setNewRow({ ...newRow, element_title: e.target.value })}
                        placeholder="Title"
                        className="h-7 w-32 text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={newRow.amount || ""}
                      onChange={(e) => setNewRow({ ...newRow, amount: parseFloat(e.target.value) || 0 })}
                      className="h-7 w-24 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={newRow.due_date}
                      onChange={(e) => setNewRow({ ...newRow, due_date: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">
                    <Input
                      value={newRow.comment}
                      onChange={(e) => setNewRow({ ...newRow, comment: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tbody>
            </table>

            {/* Save / Add button */}
            <div className="flex justify-center py-3">
              <Button
                size="sm"
                className="bg-[#008B8B] hover:bg-[#007070] text-white px-6"
                onClick={handleAddElement}
                disabled={saving || !newRow.element_title.trim()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                SAVE
              </Button>
            </div>

            {/* Total */}
            <div className="px-4 py-3 border-t bg-gray-50 text-sm font-medium text-[#008B8B]">
              Total from Elements: {totalFromElements.toFixed(2)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---- LIST VIEW ----
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          Student Elements
        </h1>
        <p className="text-muted-foreground">
          View and manage billing elements assigned to individual students
        </p>
      </div>

      {/* Filters + View toggles */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          className="text-sm text-[#008B8B] hover:underline"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Compact View" : "Expanded View"}
        </button>
        <span className="text-gray-300">|</span>
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

      {/* Student Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {filtered.length} student{filtered.length !== 1 ? "s" : ""} found.
            </span>
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
                <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Student</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Admission No.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Grade Level</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => openStudent(s)}
                >
                  <td className="px-3 py-2">
                    <span className="text-[#008B8B] hover:underline font-medium cursor-pointer">
                      {s.name}
                    </span>
                  </td>
                  <td className="px-3 py-2">{s.admission_number || "—"}</td>
                  <td className="px-3 py-2">{s.grade_level}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-gray-400">
                    No students found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
