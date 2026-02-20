"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthContext"
import { toast } from "sonner"
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronRight, Pencil } from "lucide-react"
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getElements,
  createElement,
  updateElement,
  deleteElement,
  type BillingElementCategory,
  type BillingElement,
} from "@/lib/api/billing-elements"
import {
  getGradeLevels,
  getSections,
  getSubjects,
  type GradeLevel,
  type Section,
  type Subject,
} from "@/lib/api/academics"

export default function BillingElementsPage() {
  const { profile } = useAuth()

  // Categories
  const [categories, setCategories] = useState<BillingElementCategory[]>([])
  const [newCatTitle, setNewCatTitle] = useState("")
  const [newCatOrder, setNewCatOrder] = useState(0)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editCatTitle, setEditCatTitle] = useState("")
  const [editCatOrder, setEditCatOrder] = useState(0)

  // Elements per category
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [elements, setElements] = useState<BillingElement[]>([])
  const [loadingElements, setLoadingElements] = useState(false)

  // New element form
  const [newElement, setNewElement] = useState({
    title: "",
    amount: 0,
    grade_level_id: "",
    course_period_section_id: "",
    course_period_subject_id: "",
    comment: "",
    sort_order: 0,
  })

  // Editing element
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [editElement, setEditElement] = useState<{
    title: string; amount: number; grade_level_id: string;
    course_period_section_id: string; course_period_subject_id: string;
    comment: string; sort_order: number;
  }>({ title: "", amount: 0, grade_level_id: "", course_period_section_id: "", course_period_subject_id: "", comment: "", sort_order: 0 })

  // Academics data for dropdowns
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load categories")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchGrades = useCallback(async () => {
    try {
      const res = await getGradeLevels()
      if (res.success && res.data) setGrades(res.data)
    } catch {}
  }, [])

  useEffect(() => {
    if (profile?.school_id) {
      fetchCategories()
      fetchGrades()
    }
  }, [profile?.school_id, fetchCategories, fetchGrades])

  const fetchElements = useCallback(async (categoryId: string) => {
    setLoadingElements(true)
    try {
      const data = await getElements(categoryId)
      setElements(data)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load elements")
    } finally {
      setLoadingElements(false)
    }
  }, [])

  const toggleCategory = (catId: string) => {
    if (expandedCat === catId) {
      setExpandedCat(null)
      setElements([])
    } else {
      setExpandedCat(catId)
      fetchElements(catId)
    }
    setEditingElementId(null)
  }

  // Load sections when grade changes (for new element)
  const handleGradeChange = async (gradeId: string, isEdit = false) => {
    if (isEdit) {
      setEditElement({ ...editElement, grade_level_id: gradeId, course_period_section_id: "", course_period_subject_id: "" })
    } else {
      setNewElement({ ...newElement, grade_level_id: gradeId, course_period_section_id: "", course_period_subject_id: "" })
    }
    setSections([])
    setSubjects([])
    if (gradeId) {
      try {
        const secRes = await getSections(gradeId)
        if (secRes.success && secRes.data) setSections(secRes.data)
        const subRes = await getSubjects(gradeId)
        if (subRes.success && subRes.data) setSubjects(subRes.data)
      } catch {}
    }
  }

  // ---- CATEGORY CRUD ----
  const handleCreateCategory = async () => {
    if (!newCatTitle.trim()) {
      toast.error("Title is required")
      return
    }
    setSaving(true)
    try {
      await createCategory({ title: newCatTitle.trim(), sort_order: newCatOrder })
      setNewCatTitle("")
      setNewCatOrder(0)
      toast.success("Category created")
      fetchCategories()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateCategory = async (id: string) => {
    if (!editCatTitle.trim()) return
    setSaving(true)
    try {
      await updateCategory(id, { title: editCatTitle.trim(), sort_order: editCatOrder })
      setEditingCatId(null)
      toast.success("Category updated")
      fetchCategories()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return
    try {
      await deleteCategory(id)
      toast.success("Category deleted")
      if (expandedCat === id) {
        setExpandedCat(null)
        setElements([])
      }
      fetchCategories()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    }
  }

  // ---- ELEMENT CRUD ----
  const handleCreateElement = async () => {
    if (!expandedCat || !newElement.title.trim()) {
      toast.error("Title is required")
      return
    }
    setSaving(true)
    try {
      await createElement({
        category_id: expandedCat,
        title: newElement.title.trim(),
        amount: newElement.amount || 0,
        grade_level_id: newElement.grade_level_id || null,
        course_period_section_id: newElement.course_period_section_id || null,
        course_period_subject_id: newElement.course_period_subject_id || null,
        comment: newElement.comment || null,
        sort_order: newElement.sort_order || 0,
      })
      setNewElement({ title: "", amount: 0, grade_level_id: "", course_period_section_id: "", course_period_subject_id: "", comment: "", sort_order: 0 })
      toast.success("Element created")
      fetchElements(expandedCat)
      fetchCategories() // update count
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    } finally {
      setSaving(false)
    }
  }

  const startEditElement = (el: BillingElement) => {
    setEditingElementId(el.id)
    setEditElement({
      title: el.title,
      amount: el.amount,
      grade_level_id: el.grade_level_id || "",
      course_period_section_id: el.course_period_section_id || "",
      course_period_subject_id: el.course_period_subject_id || "",
      comment: el.comment || "",
      sort_order: el.sort_order,
    })
    // Load sections/subjects for the element's grade
    if (el.grade_level_id) {
      handleGradeChange(el.grade_level_id, true)
    }
  }

  const handleUpdateElement = async (id: string) => {
    setSaving(true)
    try {
      await updateElement(id, {
        title: editElement.title,
        amount: editElement.amount,
        grade_level_id: editElement.grade_level_id || null,
        course_period_section_id: editElement.course_period_section_id || null,
        course_period_subject_id: editElement.course_period_subject_id || null,
        comment: editElement.comment || null,
        sort_order: editElement.sort_order,
      })
      setEditingElementId(null)
      toast.success("Element updated")
      if (expandedCat) fetchElements(expandedCat)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteElement = async (id: string) => {
    if (!confirm("Delete this element?")) return
    try {
      await deleteElement(id)
      toast.success("Element deleted")
      if (expandedCat) {
        fetchElements(expandedCat)
        fetchCategories()
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Operation failed")
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
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
          Elements
        </h1>
        <p className="text-muted-foreground">
          Define billing element categories and elements (books, lab fees, trips, etc.)
        </p>
      </div>

      {/* New Category */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#022172]">New Category</h2>
          <Button
            size="sm"
            className="bg-[#008B8B] hover:bg-[#007070] text-white"
            onClick={handleCreateCategory}
            disabled={saving || !newCatTitle.trim()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "SAVE"}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-red-600">Title</label>
            <Input
              value={newCatTitle}
              onChange={(e) => setNewCatTitle(e.target.value)}
              placeholder="Category title"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Sort Order</label>
            <Input
              type="number"
              value={newCatOrder}
              onChange={(e) => setNewCatOrder(parseInt(e.target.value) || 0)}
              className="mt-1 w-24"
            />
          </div>
        </div>
      </div>

      {/* Categories List */}
      {categories.length === 0 ? (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-gray-500">No categories were found.</p>
          <button
            className="mt-2 text-green-600 hover:text-green-700"
            onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Category title"]')?.focus()}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white dark:bg-gray-900 rounded-lg border overflow-hidden">
              {/* Category Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleCategory(cat.id)}
              >
                {expandedCat === cat.id ? (
                  <ChevronDown className="h-4 w-4 text-[#022172]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#022172]" />
                )}

                {editingCatId === cat.id ? (
                  <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editCatTitle}
                      onChange={(e) => setEditCatTitle(e.target.value)}
                      className="h-8 w-48"
                    />
                    <Input
                      type="number"
                      value={editCatOrder}
                      onChange={(e) => setEditCatOrder(parseInt(e.target.value) || 0)}
                      className="h-8 w-20"
                    />
                    <Button size="sm" variant="ghost" onClick={() => handleUpdateCategory(cat.id)}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingCatId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold text-[#022172] flex-1">
                      {cat.title}
                    </span>
                    <span className="text-sm text-gray-500 mr-2">
                      Order: {cat.sort_order}
                    </span>
                    <span className="text-sm text-gray-500 mr-2">
                      {cat.elements_count || 0} element{(cat.elements_count || 0) !== 1 ? 's' : ''}
                    </span>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); setEditingCatId(cat.id); setEditCatTitle(cat.title); setEditCatOrder(cat.sort_order) }}
                    >
                      <Pencil className="h-3.5 w-3.5 text-gray-500" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id) }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </>
                )}
              </div>

              {/* Elements List (expanded) */}
              {expandedCat === cat.id && (
                <div className="p-4 border-t">
                  {loadingElements ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <>
                      {/* Elements Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Title</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Amount</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Grade</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Section</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Subject</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Order</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-[#022172] uppercase">Comment</th>
                              <th className="px-3 py-2 w-20"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {elements.map((el) => (
                              <tr key={el.id} className="border-b hover:bg-gray-50">
                                {editingElementId === el.id ? (
                                  <>
                                    <td className="px-3 py-2">
                                      <Input
                                        value={editElement.title}
                                        onChange={(e) => setEditElement({ ...editElement, title: e.target.value })}
                                        className="h-8"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editElement.amount}
                                        onChange={(e) => setEditElement({ ...editElement, amount: parseFloat(e.target.value) || 0 })}
                                        className="h-8 w-24"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <select
                                        value={editElement.grade_level_id}
                                        onChange={(e) => handleGradeChange(e.target.value, true)}
                                        className="h-8 border rounded px-2 text-sm w-28"
                                      >
                                        <option value="">N/A</option>
                                        {grades.map((g) => (
                                          <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-3 py-2">
                                      <select
                                        value={editElement.course_period_section_id}
                                        onChange={(e) => setEditElement({ ...editElement, course_period_section_id: e.target.value })}
                                        className="h-8 border rounded px-2 text-sm w-28"
                                        disabled={!editElement.grade_level_id}
                                      >
                                        <option value="">N/A</option>
                                        {sections.map((s) => (
                                          <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-3 py-2">
                                      <select
                                        value={editElement.course_period_subject_id}
                                        onChange={(e) => setEditElement({ ...editElement, course_period_subject_id: e.target.value })}
                                        className="h-8 border rounded px-2 text-sm w-28"
                                        disabled={!editElement.grade_level_id}
                                      >
                                        <option value="">N/A</option>
                                        {subjects.map((s) => (
                                          <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-3 py-2">
                                      <Input
                                        type="number"
                                        value={editElement.sort_order}
                                        onChange={(e) => setEditElement({ ...editElement, sort_order: parseInt(e.target.value) || 0 })}
                                        className="h-8 w-16"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <Input
                                        value={editElement.comment}
                                        onChange={(e) => setEditElement({ ...editElement, comment: e.target.value })}
                                        className="h-8"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleUpdateElement(el.id)}>
                                          <Save className="h-3.5 w-3.5 text-green-600" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingElementId(null)}>
                                          ✕
                                        </Button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 font-medium text-[#008B8B]">{el.title}</td>
                                    <td className="px-3 py-2">{el.amount.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-gray-500">{el.grade_name || "—"}</td>
                                    <td className="px-3 py-2 text-gray-500">{el.section_name || "—"}</td>
                                    <td className="px-3 py-2 text-gray-500">{el.subject_name || "—"}</td>
                                    <td className="px-3 py-2 text-gray-500">{el.sort_order}</td>
                                    <td className="px-3 py-2 text-gray-400 text-xs">{el.comment || ""}</td>
                                    <td className="px-3 py-2">
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEditElement(el)}>
                                          <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteElement(el.id)}>
                                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        </Button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* New Element Form */}
                      <div className="mt-4 pt-4 border-t">
                        <h3 className="text-sm font-semibold text-[#022172] mb-3 flex items-center gap-1">
                          <Plus className="h-4 w-4 text-green-600" /> NEW ELEMENT
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs font-medium text-red-600">Title</label>
                            <Input
                              value={newElement.title}
                              onChange={(e) => setNewElement({ ...newElement, title: e.target.value })}
                              placeholder="Element title"
                              className="mt-1 h-8"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-red-600">Amount</label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newElement.amount || ""}
                              onChange={(e) => setNewElement({ ...newElement, amount: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="mt-1 h-8 w-28"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Grade</label>
                            <select
                              value={newElement.grade_level_id}
                              onChange={(e) => handleGradeChange(e.target.value)}
                              className="mt-1 h-8 w-full border rounded px-2 text-sm"
                            >
                              <option value="">N/A</option>
                              {grades.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Section (Course Period)</label>
                            <select
                              value={newElement.course_period_section_id}
                              onChange={(e) => setNewElement({ ...newElement, course_period_section_id: e.target.value })}
                              className="mt-1 h-8 w-full border rounded px-2 text-sm"
                              disabled={!newElement.grade_level_id}
                            >
                              <option value="">N/A</option>
                              {sections.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Subject (Course Period)</label>
                            <select
                              value={newElement.course_period_subject_id}
                              onChange={(e) => setNewElement({ ...newElement, course_period_subject_id: e.target.value })}
                              className="mt-1 h-8 w-full border rounded px-2 text-sm"
                              disabled={!newElement.grade_level_id}
                            >
                              <option value="">N/A</option>
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Sort Order</label>
                            <Input
                              type="number"
                              value={newElement.sort_order}
                              onChange={(e) => setNewElement({ ...newElement, sort_order: parseInt(e.target.value) || 0 })}
                              className="mt-1 h-8 w-20"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Comment</label>
                            <Input
                              value={newElement.comment}
                              onChange={(e) => setNewElement({ ...newElement, comment: e.target.value })}
                              className="mt-1 h-8"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            className="bg-[#008B8B] hover:bg-[#007070] text-white"
                            onClick={handleCreateElement}
                            disabled={saving || !newElement.title.trim()}
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                            Add Element
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
