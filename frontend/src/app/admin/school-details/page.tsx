"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCampus } from "@/context/CampusContext"
import { useAuth } from "@/context/AuthContext"
import { getAuthToken } from "@/lib/api/schools"
import { getFieldDefinitions, type CustomFieldDefinition } from "@/lib/api/custom-fields"
import { getCategoryOrders, saveCategoryOrders, type CustomFieldCategoryOrder } from "@/lib/api/custom-field-category-orders"
import { SchoolCustomFieldsButton } from "@/components/superadmin/SchoolCustomFieldsButton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  GraduationCap,
  Loader2,
  Edit,
  Save,
  X,
  ThumbsUp,
  Target,
  Compass,
  SlidersHorizontal,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Layers,
  Award,
} from "lucide-react"

import { arrayMove } from '@dnd-kit/sortable'

interface CampusStats {
  total_students: number
  boys_count: number
  girls_count: number
  total_teachers: number
  male_teachers: number
  female_teachers: number
  total_staff: number
  male_staff: number
  female_staff: number
  total_parents: number
  total_grade_levels: number
  total_sections: number
  present_today: number
  attendance_percentage_today: number
}

interface CampusFormData {
  name: string
  address: string
  city: string
  state: string
  zip_code: string
  phone: string
  contact_email: string
  principal_name: string
  short_name: string
  school_number: string
  vision: string
  mission: string
}

export interface TabItem {
  id: string
  name: string
  isStandard?: boolean
  fields: CustomFieldDefinition[]
}

const DEFAULT_STANDARD_TABS = [
  { id: "school_details", nameKey: "school_details", fallback: "School Details" },
  { id: "school_vision", nameKey: "school_vision", fallback: "School Vision" },
  { id: "school_mission", nameKey: "school_mission", fallback: "School Mission" },
]

export default function SchoolDetailsPage() {
  const t = useTranslations("school.details")
  const campusContext = useCampus()
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<CampusStats | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState<CampusFormData>({
    name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    phone: "",
    contact_email: "",
    principal_name: "",
    short_name: "",
    school_number: "",
    vision: "",
    mission: "",
  })

  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({})
  const [categoryOrders, setCategoryOrders] = useState<CustomFieldCategoryOrder[]>([])
  const [activeTab, setActiveTab] = useState<string>("school_details")

  // Tab Reordering Dialog state
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false)
  const [reorderTabsList, setReorderTabsList] = useState<{ id: string; name: string }[]>([])
  const [isSavingTabOrder, setIsSavingTabOrder] = useState(false)

  const selectedCampus = campusContext?.selectedCampus

  // Load custom field definitions and saved category orders
  const refreshCustomFieldData = useCallback(() => {
    if (!selectedCampus?.id) {
      setCustomFields([])
      setCategoryOrders([])
      return
    }

    Promise.all([
      getFieldDefinitions('school', selectedCampus.id),
      getCategoryOrders('school', selectedCampus.id),
    ]).then(([fieldsRes, ordersRes]) => {
      if (fieldsRes.success) setCustomFields(fieldsRes.data ?? [])
      if (ordersRes.success) setCategoryOrders(ordersRes.data ?? [])
    }).catch(err => {
      console.error("Error fetching custom field data:", err)
    })
  }, [selectedCampus?.id])

  useEffect(() => {
    refreshCustomFieldData()
  }, [refreshCustomFieldData])

  // Update form data when selected campus changes
  useEffect(() => {
    if (selectedCampus) {
      const customVals = selectedCampus.custom_fields || {}
      setFormData({
        name: selectedCampus.name || "",
        address: selectedCampus.address || "",
        city: selectedCampus.city || "",
        state: selectedCampus.state || "",
        zip_code: selectedCampus.zip_code || "",
        phone: selectedCampus.phone || "",
        contact_email: selectedCampus.contact_email || "",
        principal_name: selectedCampus.principal_name || "",
        short_name: selectedCampus.short_name || "",
        school_number: selectedCampus.school_number || "",
        vision: customVals.vision_statement ?? customVals.school_vision ?? t("vision_default"),
        mission: customVals.mission_statement ?? customVals.school_mission ?? t("mission_default"),
      })
      setCustomFieldValues(customVals)
    }
  }, [selectedCampus, t])

  // Fetch campus stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedCampus?.id) {
        setLoading(false)
        return
      }

      const token = await getAuthToken()
      if (!token) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const statsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/setup/campuses/${selectedCampus.id}/stats`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        )
        const statsData = await statsRes.json()
        if (statsData.success) {
          setStats(statsData.data)
        }
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [selectedCampus?.id])

  // Build combined and ordered tabs list
  const combinedTabs: TabItem[] = useMemo(() => {
    const map = new Map<string, TabItem>()

    // Add standard default tabs first
    DEFAULT_STANDARD_TABS.forEach((st) => {
      const name = t(st.nameKey, { fallback: st.fallback })
      map.set(st.id, { id: st.id, name, isStandard: true, fields: [] })
    })

    // Group custom fields into tabs
    customFields.forEach((f) => {
      if (!map.has(f.category_id)) {
        map.set(f.category_id, {
          id: f.category_id,
          name: f.category_name || f.category_id,
          isStandard: false,
          fields: [],
        })
      }
      map.get(f.category_id)!.fields.push(f)
    })

    const tabsList = Array.from(map.values())

    // Order tabs according to saved categoryOrders or default order
    if (categoryOrders.length > 0) {
      const orderMap = new Map<string, number>()
      categoryOrders.forEach((co) => orderMap.set(co.category_id, co.category_order))

      tabsList.sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? 999
        const orderB = orderMap.get(b.id) ?? 999
        return orderA - orderB
      })
    }

    return tabsList
  }, [customFields, categoryOrders, t])

  // Ensure active tab is valid
  useEffect(() => {
    if (combinedTabs.length > 0 && !combinedTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(combinedTabs[0].id)
    }
  }, [combinedTabs, activeTab])

  const handleSave = async () => {
    if (!selectedCampus?.id) return

    const token = await getAuthToken()
    if (!token) return

    setIsSaving(true)
    try {
      const updatedCustomFields = {
        ...customFieldValues,
        vision_statement: formData.vision,
        school_vision: formData.vision,
        mission_statement: formData.mission,
        school_mission: formData.mission,
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/setup/campuses/${selectedCampus.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zip_code,
            phone: formData.phone,
            contact_email: formData.contact_email,
            principal_name: formData.principal_name,
            short_name: formData.short_name,
            school_number: formData.school_number,
            custom_fields: updatedCustomFields,
          }),
        }
      )
      const data = await res.json()

      if (res.ok) {
        toast.success(t("update_success"))
        setIsEditing(false)
        campusContext?.refreshCampuses()
      } else {
        toast.error(data.error || t("update_error"))
      }
    } catch (error) {
      console.error("Error updating campus:", error)
      toast.error(t("update_error"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (selectedCampus) {
      const customVals = selectedCampus.custom_fields || {}
      setFormData({
        name: selectedCampus.name || "",
        address: selectedCampus.address || "",
        city: selectedCampus.city || "",
        state: selectedCampus.state || "",
        zip_code: selectedCampus.zip_code || "",
        phone: selectedCampus.phone || "",
        contact_email: selectedCampus.contact_email || "",
        principal_name: selectedCampus.principal_name || "",
        short_name: selectedCampus.short_name || "",
        school_number: selectedCampus.school_number || "",
        vision: customVals.vision_statement ?? customVals.school_vision ?? t("vision_default"),
        mission: customVals.mission_statement ?? customVals.school_mission ?? t("mission_default"),
      })
      setCustomFieldValues(customVals)
    }
    setIsEditing(false)
    toast.info("Edit cancelled")
  }

  function setCustomFieldValue(fieldId: string, value: any) {
    setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  // Handle Tab Reordering Dialog
  const handleOpenReorderDialog = () => {
    setReorderTabsList(combinedTabs.map((t) => ({ id: t.id, name: t.name })))
    setReorderDialogOpen(true)
  }

  const handleSaveTabOrder = async () => {
    if (!selectedCampus?.id) return
    setIsSavingTabOrder(true)
    try {
      const formattedOrders: CustomFieldCategoryOrder[] = reorderTabsList.map((t, idx) => ({
        category_id: t.id,
        category_order: idx + 1,
      }))

      const res = await saveCategoryOrders('school', formattedOrders, selectedCampus.id)
      if (res.success) {
        toast.success(t("tab_order_updated"))
        setCategoryOrders(formattedOrders)
        setReorderDialogOpen(false)
      } else {
        toast.error(res.message || t("tab_order_error"))
      }
    } catch (err) {
      console.error("Error saving tab order:", err)
      toast.error(t("tab_order_error"))
    } finally {
      setIsSavingTabOrder(false)
    }
  }

  function moveTabPosition(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= reorderTabsList.length) return
    setReorderTabsList((items) => arrayMove(items, index, newIndex))
  }

  // Render input controls for custom fields
  function renderCustomFieldInput(field: CustomFieldDefinition) {
    const value = customFieldValues[field.id] ?? ''
    switch (field.type) {
      case 'long-text':
        return (
          <Textarea
            value={value}
            onChange={(e) => setCustomFieldValue(field.id, e.target.value)}
            rows={3}
          />
        )
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setCustomFieldValue(field.id, e.target.value)}
          />
        )
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setCustomFieldValue(field.id, e.target.value)}
          />
        )
      case 'checkbox':
        return (
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              checked={value === true || value === 'Y'}
              onCheckedChange={(c) => setCustomFieldValue(field.id, !!c)}
            />
            <span className="text-sm font-medium">{field.label}</span>
          </div>
        )
      case 'select':
        return (
          <Select value={value || undefined} onValueChange={(v) => setCustomFieldValue(field.id, v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'multi-select': {
        const selected: string[] = Array.isArray(value) ? value : []
        return (
          <div className="flex flex-wrap gap-3 pt-1">
            {(field.options ?? []).map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(c) => {
                    setCustomFieldValue(field.id, c ? [...selected, opt] : selected.filter((v) => v !== opt))
                  }}
                />
                {opt}
              </label>
            ))}
          </div>
        )
      }
      case 'text':
      default:
        return (
          <Input
            value={value}
            onChange={(e) => setCustomFieldValue(field.id, e.target.value)}
          />
        )
    }
  }

  // Get icon for tab triggers
  function getTabIcon(tabId: string) {
    switch (tabId) {
      case 'school_details':
        return <Building2 className="h-4 w-4" />
      case 'school_vision':
        return <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      case 'school_mission':
        return <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      default:
        return <Layers className="h-4 w-4 text-indigo-500" />
    }
  }

  const selectedCampusName = selectedCampus?.name || "All Campuses"

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
              {t("title")}
            </h1>
            {selectedCampus && (
              <Badge className={`px-2.5 py-1 text-xs font-semibold ${selectedCampus.status === 'active'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                {selectedCampus.status === 'active' ? t("active") : t("inactive")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedCampus ? t("manage_details", { name: selectedCampusName }) : t("select_campus")}
          </p>
        </div>

        {selectedCampus && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
            {!isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenReorderDialog}
                  className="gap-2 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <SlidersHorizontal className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  <span>{t("reorder_tabs")}</span>
                </Button>

                <div className="shrink-0">
                  <SchoolCustomFieldsButton
                    schoolId={selectedCampus.id}
                    schoolName={selectedCampus.name}
                    isSuperAdmin={isSuperAdmin}
                    onFieldsChanged={refreshCustomFieldData}
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="bg-[#022172] hover:bg-[#022172]/90 text-white gap-2 shadow-xs"
                >
                  <Edit className="h-4 w-4" />
                  {t("edit_campus")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t("save_changes")}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {!selectedCampus ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Building2 className="h-14 w-14 mx-auto text-muted-foreground/60 mb-4" />
            <h3 className="text-xl font-semibold mb-2">{t("no_campus_selected")}</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t("no_campus_desc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Main Card with Top Tabs Navigation */}
          <Card className="shadow-xs border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-900/60 pb-4 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2.5 text-[#022172] dark:text-white">
                    <Building2 className="h-5 w-5 text-[#022172] dark:text-blue-400" />
                    {selectedCampus.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {isEditing ? t("edit_desc") : t("details_for", { name: selectedCampus.name })}
                  </CardDescription>
                </div>

                {isEditing && (
                  <Badge variant="outline" className="w-fit bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                    <Edit className="h-3 w-3 mr-1 animate-pulse" />
                    Editing Mode Active
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-6">
              {/* TOP TABS NAVIGATION STRIP */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-3 mb-6 border-b border-slate-200 dark:border-slate-800">
                  <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 flex flex-nowrap shrink-0 h-auto">
                    {combinedTabs.map((tab) => (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-[#022172] dark:data-[state=active]:text-white data-[state=active]:shadow-xs rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 shrink-0"
                      >
                        {getTabIcon(tab.id)}
                        <span>{tab.name}</span>
                        {tab.fields.length > 0 && (
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 rounded-full">
                            {tab.fields.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* TAB 1: SCHOOL DETAILS */}
                <TabsContent value="school_details" className="space-y-6 mt-0">
                  {isEditing ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="font-semibold">{t("campus_name")} *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder={t("campus_name")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="short_name" className="font-semibold">{t("short_name")}</Label>
                        <Input
                          id="short_name"
                          value={formData.short_name}
                          onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                          placeholder="e.g. SMS, Main Campus"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="school_number" className="font-semibold">{t("campus_number")}</Label>
                        <Input
                          id="school_number"
                          value={formData.school_number}
                          onChange={(e) => setFormData({ ...formData, school_number: e.target.value })}
                          placeholder="Official school code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="font-semibold">{t("phone")}</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder={t("phone")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="font-semibold">{t("email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                          placeholder="campus@school.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="principal" className="font-semibold">{t("principal")}</Label>
                        <Input
                          id="principal"
                          value={formData.principal_name}
                          onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
                          placeholder={t("principal")}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address" className="font-semibold">{t("address")}</Label>
                        <Textarea
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder={t("address")}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city" className="font-semibold">{t("city")}</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder={t("city")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state" className="font-semibold">{t("state")}</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          placeholder={t("state")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zip_code" className="font-semibold">{t("zip_code")}</Label>
                        <Input
                          id="zip_code"
                          value={formData.zip_code}
                          onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                          placeholder={t("zip_code")}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          <Building2 className="h-5 w-5 text-[#022172] dark:text-blue-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("campus_name")}</p>
                            <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedCampus.name}</p>
                            {selectedCampus.short_name && (
                              <p className="text-xs text-muted-foreground mt-0.5">{t("short_name")}: {selectedCampus.short_name}</p>
                            )}
                          </div>
                        </div>

                        {selectedCampus.school_number && (
                          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                            <Award className="h-5 w-5 text-[#022172] dark:text-blue-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("campus_number")}</p>
                              <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedCampus.school_number}</p>
                            </div>
                          </div>
                        )}

                        {selectedCampus.principal_name && (
                          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                            <Users className="h-5 w-5 text-[#022172] dark:text-blue-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("principal")}</p>
                              <p className="text-base font-semibold text-slate-900 dark:text-white mt-1">{selectedCampus.principal_name}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          <MapPin className="h-5 w-5 text-[#022172] dark:text-blue-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("address")}</p>
                            {selectedCampus.address ? (
                              <div className="mt-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">{selectedCampus.address}</p>
                                {(selectedCampus.city || selectedCampus.state || selectedCampus.zip_code) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {[selectedCampus.city, selectedCampus.state, selectedCampus.zip_code].filter(Boolean).join(", ")}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic mt-1">{t("not_provided")}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          <Phone className="h-5 w-5 text-[#022172] dark:text-blue-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("phone")}</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                              {selectedCampus.phone || <span className="italic text-muted-foreground">{t("not_provided")}</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          <Mail className="h-5 w-5 text-[#022172] dark:text-blue-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("email")}</p>
                            <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
                              {selectedCampus.contact_email || <span className="italic text-muted-foreground">{t("not_provided")}</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custom fields belonging to school_details */}
                  {combinedTabs.find(t => t.id === 'school_details')?.fields.length! > 0 && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                      <h4 className="font-bold text-sm uppercase text-slate-500 tracking-wider">Additional Details Fields</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {combinedTabs.find(t => t.id === 'school_details')?.fields.map((field) => (
                          <div key={field.id} className="space-y-1.5">
                            <Label className="font-semibold">
                              {field.label} {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            {isEditing ? (
                              renderCustomFieldInput(field)
                            ) : (
                              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700 text-sm">
                                {customFieldValues[field.id] ? String(customFieldValues[field.id]) : <span className="italic text-muted-foreground">{t("not_provided")}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* TAB 2: SCHOOL VISION */}
                <TabsContent value="school_vision" className="space-y-6 mt-0">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-teal-950/20 p-6 md:p-8 border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                          {t("school_vision")}
                        </h3>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          {t("vision_statement")}
                        </p>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-2">
                        <Label htmlFor="vision" className="font-semibold text-slate-800 dark:text-slate-200">
                          {t("vision_statement")}
                        </Label>
                        <Textarea
                          id="vision"
                          value={formData.vision}
                          onChange={(e) => setFormData({ ...formData, vision: e.target.value })}
                          placeholder={t("vision_placeholder")}
                          rows={5}
                          className="bg-white dark:bg-slate-900 text-base leading-relaxed"
                        />
                      </div>
                    ) : (
                      <div className="pt-2">
                        <blockquote className="text-base md:text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed dir-rtl text-right sm:text-left sm:dir-ltr">
                          "{formData.vision || t("vision_default")}"
                        </blockquote>
                      </div>
                    )}
                  </div>

                  {/* Custom fields belonging to school_vision */}
                  {combinedTabs.find(t => t.id === 'school_vision')?.fields.length! > 0 && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                      <h4 className="font-bold text-sm uppercase text-slate-500 tracking-wider">Vision Information Fields</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {combinedTabs.find(t => t.id === 'school_vision')?.fields.map((field) => (
                          <div key={field.id} className="space-y-1.5">
                            <Label className="font-semibold">
                              {field.label} {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            {isEditing ? (
                              renderCustomFieldInput(field)
                            ) : (
                              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700 text-sm">
                                {customFieldValues[field.id] ? String(customFieldValues[field.id]) : <span className="italic text-muted-foreground">{t("not_provided")}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* TAB 3: SCHOOL MISSION */}
                <TabsContent value="school_mission" className="space-y-6 mt-0">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/50 dark:from-blue-950/20 dark:via-slate-900 dark:to-indigo-950/20 p-6 md:p-8 border border-blue-200/80 dark:border-blue-900/50 shadow-xs">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-[#022172] text-white flex items-center justify-center shadow-xs shrink-0">
                        <Compass className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                          {t("school_mission")}
                        </h3>
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          {t("mission_statement")}
                        </p>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-2">
                        <Label htmlFor="mission" className="font-semibold text-slate-800 dark:text-slate-200">
                          {t("mission_statement")}
                        </Label>
                        <Textarea
                          id="mission"
                          value={formData.mission}
                          onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                          placeholder={t("mission_placeholder")}
                          rows={5}
                          className="bg-white dark:bg-slate-900 text-base leading-relaxed"
                        />
                      </div>
                    ) : (
                      <div className="pt-2">
                        <blockquote className="text-base md:text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed dir-rtl text-right sm:text-left sm:dir-ltr">
                          "{formData.mission || t("mission_default")}"
                        </blockquote>
                      </div>
                    )}
                  </div>

                  {/* Custom fields belonging to school_mission */}
                  {combinedTabs.find(t => t.id === 'school_mission')?.fields.length! > 0 && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                      <h4 className="font-bold text-sm uppercase text-slate-500 tracking-wider">Mission Information Fields</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {combinedTabs.find(t => t.id === 'school_mission')?.fields.map((field) => (
                          <div key={field.id} className="space-y-1.5">
                            <Label className="font-semibold">
                              {field.label} {field.required && <span className="text-destructive">*</span>}
                            </Label>
                            {isEditing ? (
                              renderCustomFieldInput(field)
                            ) : (
                              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700 text-sm">
                                {customFieldValues[field.id] ? String(customFieldValues[field.id]) : <span className="italic text-muted-foreground">{t("not_provided")}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* DYNAMIC CUSTOM TABS */}
                {combinedTabs
                  .filter((tab) => !tab.isStandard)
                  .map((tab) => (
                    <TabsContent key={tab.id} value={tab.id} className="space-y-6 mt-0">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Layers className="h-5 w-5 text-indigo-500" />
                            {tab.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Custom information fields for {tab.name}
                          </p>
                        </div>
                      </div>

                      {tab.fields.length === 0 ? (
                        <div className="p-8 text-center border border-dashed rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                          <Layers className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">No fields defined under {tab.name} yet.</p>
                          <p className="text-xs text-slate-500 mt-1 mb-4">Click "Custom Fields" at the top to add fields to this tab.</p>
                        </div>
                      ) : (
                        <div className="grid gap-5 md:grid-cols-2">
                          {tab.fields.map((field) => {
                            const val = customFieldValues[field.id]
                            const displayVal = (() => {
                              if (val === undefined || val === null || val === '') return t("not_provided")
                              if (Array.isArray(val)) return val.join(', ')
                              if (val === true) return 'Yes'
                              if (val === false) return 'No'
                              return String(val)
                            })()

                            return (
                              <div key={field.id} className="space-y-1.5">
                                <Label className="font-semibold text-slate-800 dark:text-slate-200">
                                  {field.label} {field.required && <span className="text-destructive">*</span>}
                                </Label>
                                {isEditing ? (
                                  renderCustomFieldInput(field)
                                ) : (
                                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 text-sm font-medium text-slate-900 dark:text-white">
                                    {displayVal}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </TabsContent>
                  ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Campus Statistics Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Total Students */}
              <div className="flex rounded-xl overflow-hidden shadow-xs border border-green-700/20">
                <div className="bg-[#2E7D32] flex items-center justify-center w-20 shrink-0">
                  <GraduationCap className="h-9 w-9 text-white" />
                </div>
                <div className="bg-[#388E3C] flex-1 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">{t("students")}</p>
                  <p className="text-3xl font-bold my-1">{stats?.total_students ?? 0}</p>
                  <div className="border-t border-white/30 pt-2 mt-1">
                    <p className="text-xs opacity-90">
                      {t("boys")}: {stats?.boys_count ?? 0}&nbsp;&nbsp;{t("girls")}: {stats?.girls_count ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Parents */}
              <div className="flex rounded-xl overflow-hidden shadow-xs border border-red-700/20">
                <div className="bg-[#B71C1C] flex items-center justify-center w-20 shrink-0">
                  <Users className="h-9 w-9 text-white" />
                </div>
                <div className="bg-[#C62828] flex-1 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">{t("parents")}</p>
                  <p className="text-3xl font-bold my-1">{stats?.total_parents ?? 0}</p>
                  <div className="border-t border-white/30 pt-2 mt-1">
                    <p className="text-xs opacity-90">{t("total_registered_parents")}</p>
                  </div>
                </div>
              </div>

              {/* Teachers */}
              <div className="flex rounded-xl overflow-hidden shadow-xs border border-orange-700/20">
                <div className="bg-[#E65100] flex items-center justify-center w-20 shrink-0">
                  <Users className="h-9 w-9 text-white" />
                </div>
                <div className="bg-[#F57C00] flex-1 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">{t("teachers", { fallback: "Teachers" })}</p>
                  <p className="text-3xl font-bold my-1">{stats?.total_teachers ?? 0}</p>
                  <div className="border-t border-white/30 pt-2 mt-1">
                    <p className="text-xs opacity-90">
                      {t("male")}: {stats?.male_teachers ?? 0}&nbsp;&nbsp;{t("female")}: {stats?.female_teachers ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Staff */}
              <div className="flex rounded-xl overflow-hidden shadow-xs border border-cyan-700/20">
                <div className="bg-[#00838F] flex items-center justify-center w-20 shrink-0">
                  <Users className="h-9 w-9 text-white" />
                </div>
                <div className="bg-[#00ACC1] flex-1 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">{t("staff")}</p>
                  <p className="text-3xl font-bold my-1">{stats?.total_staff ?? 0}</p>
                  <div className="border-t border-white/30 pt-2 mt-1">
                    <p className="text-xs opacity-90">
                      {t("male")}: {stats?.male_staff ?? 0}&nbsp;&nbsp;{t("female")}: {stats?.female_staff ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Present Today */}
              <div className="flex rounded-xl overflow-hidden shadow-xs border border-blue-700/20">
                <div className="bg-[#1565C0] flex items-center justify-center w-20 shrink-0">
                  <ThumbsUp className="h-9 w-9 text-white" />
                </div>
                <div className="bg-[#1976D2] flex-1 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">{t("present_students_today")}</p>
                  <p className="text-3xl font-bold my-1">{stats?.present_today ?? 0}</p>
                  <div className="border-t border-white/30 pt-2 mt-1">
                    <p className="text-xs opacity-90">
                      {t("attendance_percentage")}: {stats ? parseFloat(stats.attendance_percentage_today.toFixed(1)) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Reordering Modal */}
      <Dialog open={reorderDialogOpen} onOpenChange={setReorderDialogOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-[#022172]" />
              {t("reorder_tabs")}
            </DialogTitle>
            <DialogDescription>
              {t("tab_reorder_desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {reorderTabsList.map((tabItem, idx) => (
              <div
                key={tabItem.id}
                className="flex items-center justify-between p-3 border rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tabItem.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={idx === 0}
                    onClick={() => moveTabPosition(idx, 'up')}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={idx === reorderTabsList.length - 1}
                    onClick={() => moveTabPosition(idx, 'down')}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReorderDialogOpen(false)}
              disabled={isSavingTabOrder}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSaveTabOrder}
              disabled={isSavingTabOrder}
              className="bg-[#022172] hover:bg-[#022172]/90 text-white"
            >
              {isSavingTabOrder && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("save_tab_order")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
