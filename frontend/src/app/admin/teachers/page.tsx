"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TagsInput } from "@/components/ui/tags-input"
import { MultiSelect } from "@/components/ui/multi-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { UserPlus, Search, Edit, Trash2, Users, GraduationCap, Loader2, RefreshCw, ChevronLeft, ChevronRight, Lock, DollarSign } from "lucide-react"
import { EditCredentialsModal } from "@/components/admin/EditCredentialsModal"
import { AddTeacherForm } from "@/components/admin/AddTeacherForm"
import * as teachersApi from "@/lib/api/teachers"
import { useTeachers } from "@/hooks/useTeachers"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields"
import { useCampus } from "@/context/CampusContext"

// Standard Field Definitions with Sort Orders for Teachers
const STANDARD_FIELDS = [
  // PERSONAL INFO (Category: personal)
  { id: 'first_name', label: 'First Name', type: 'text', category: 'personal', sort_order: 1, required: true, width: 'half' },
  { id: 'last_name', label: 'Last Name', type: 'text', category: 'personal', sort_order: 2, required: true, width: 'half' },
  { id: 'email', label: 'Email', type: 'email', category: 'personal', sort_order: 3, required: true, width: 'half' },
  { id: 'phone', label: 'Phone', type: 'text', category: 'personal', sort_order: 4, required: false, width: 'half' },

  // PROFESSIONAL (Category: professional)
  { id: 'employment_type', label: 'Employment Type', type: 'select', category: 'professional', sort_order: 1, required: true, width: 'half', options: ['full_time', 'part_time', 'contract'] },
  { id: 'date_of_joining', label: 'Date of Joining', type: 'date', category: 'professional', sort_order: 2, required: false, width: 'half' },
  { id: 'title', label: 'Title', type: 'text', category: 'professional', sort_order: 3, required: false, width: 'half', placeholder: 'e.g., Senior Teacher' },
  { id: 'department', label: 'Department', type: 'text', category: 'professional', sort_order: 4, required: false, width: 'half', placeholder: 'e.g., Science' },
  { id: 'qualifications', label: 'Qualifications', type: 'text', category: 'professional', sort_order: 5, required: false, width: 'full', placeholder: 'e.g., M.Sc. Mathematics' },
  { id: 'specialization', label: 'Specialization', type: 'text', category: 'professional', sort_order: 6, required: false, width: 'full', placeholder: 'e.g., Applied Mathematics, Algebra' },
  { id: 'base_salary', label: 'Base Salary (Monthly)', type: 'number', category: 'professional', sort_order: 7, required: true, width: 'full', help: 'Required for payroll generation' },

  // SYSTEM (Category: system) - Only for new teachers
  { id: 'employee_number', label: 'Employee Number', type: 'text', category: 'system', sort_order: 1, required: false, width: 'half', help: 'Auto-generated if empty' },
  { id: 'username', label: 'Username', type: 'text', category: 'system', sort_order: 2, required: false, width: 'half', help: 'Auto-generated from name' },
  { id: 'password', label: 'Password', type: 'text', category: 'system', sort_order: 3, required: false, width: 'full', help: 'Auto-generated secure password' },
];

export default function TeachersPage() {
  const router = useRouter()
  const campusContext = useCampus()
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const itemsPerPage = 10

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Use SWR hook for optimized data fetching with pagination
  const {
    teachers,
    total,
    totalPages,
    loading: dataLoading,
    error: dataError,
    createTeacher,
    updateTeacher,
    deleteTeacher,
    refreshTeachers,
    isValidating
  } = useTeachers(currentPage, itemsPerPage, debouncedSearch)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<teachersApi.Staff | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [loadingCustomFields, setLoadingCustomFields] = useState(true)

  // Form state
  const [formData, setFormData] = useState<teachersApi.CreateStaffDTO>({
    employee_number: "",
    title: "",
    department: "",
    qualifications: "",
    specialization: "",
    date_of_joining: "",
    employment_type: "full_time",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    base_salary: undefined,
    custom_fields: {}
  })
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    employeeNumber: string
    username: string
    password: string
  } | null>(null)
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false)

  // Show error if any
  useEffect(() => {
    if (dataError) {
      toast.error(dataError)
    }
  }, [dataError])

  // Load custom fields
  useEffect(() => {
    const loadCustomFields = async () => {
      try {
        const response = await getFieldDefinitions('teacher')
        if (response.success && response.data) {
          setCustomFields(response.data)
        }
      } catch (err) {
        console.error("Error loading custom fields", err)
      } finally {
        setLoadingCustomFields(false)
      }
    }
    loadCustomFields()
  }, [])

  // Filter by active/inactive status (client-side for now)
  const filteredTeachers = useMemo(() => {
    if (showInactive) return teachers
    return teachers.filter(t => t.is_active !== false)
  }, [teachers, showInactive])

  // Auto-generate employee number when creating new teacher
  useEffect(() => {
    if (!editingTeacher && !formData.employee_number) {
      const timestamp = Date.now().toString().slice(-6)
      const randomDigits = Math.floor(100 + Math.random() * 900)
      const employeeNumber = `EMP${timestamp}${randomDigits}`
      setFormData(prev => ({ ...prev, employee_number: employeeNumber }))
    }
  }, [editingTeacher, formData.employee_number])

  // Set username to email when email changes (username = email)
  useEffect(() => {
    if (formData.email && !editingTeacher) {
      setFormData(prev => ({ ...prev, username: formData.email }))
    }
  }, [formData.email, editingTeacher])

  // Auto-generate password on mount for new teacher
  useEffect(() => {
    if (!editingTeacher && !formData.password) {
      const newPassword = generatePassword()
      setFormData(prev => ({ ...prev, password: newPassword }))
    }
  }, [editingTeacher])

  const generatePassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const special = '!@#$%^&*'
    const allChars = uppercase + lowercase + numbers + special

    let password = ''
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += special[Math.floor(Math.random() * special.length)]

    for (let i = password.length; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }

    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)

      // Validate required standard fields
      const errors: string[] = [];
      STANDARD_FIELDS.forEach(field => {
        if (field.required) {
          const value = formData[field.id as keyof typeof formData];
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            errors.push(`${field.label} is required`);
          }
        }
      });

      // Validate required custom fields
      customFields.forEach(field => {
        if (field.required) {
          const value = formData.custom_fields?.[field.field_key];
          if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '')) {
            errors.push(`${field.label} is required`);
          }
        }
      });

      if (errors.length > 0) {
        toast.error(errors.join(', '));
        setSubmitting(false);
        return;
      }

      if (editingTeacher) {
        const response = await updateTeacher(editingTeacher.id, formData)
        if (response.success) {
          toast.success("Teacher updated successfully")
          setIsDialogOpen(false)
          resetForm()
        } else {
          toast.error(response.error || "Failed to update teacher")
        }
      } else {
        // Log the data being sent
        const dataToSend = {
          ...formData,
          campus_id: campusContext?.selectedCampus?.id
        }
        console.log('📤 Creating teacher with data:', dataToSend)
        console.log('💰 Base salary value:', dataToSend.base_salary, 'Type:', typeof dataToSend.base_salary)
        
        const response = await createTeacher(dataToSend)
        console.log('📥 Create teacher response:', response)
        
        if (response.success) {
          toast.success("Teacher created successfully")

          // Show credentials if they were generated (username is email)
          if (formData.employee_number && formData.email && formData.password) {
            setGeneratedCredentials({
              employeeNumber: formData.employee_number,
              username: formData.email, // Username is now email
              password: formData.password
            })
            setShowCredentialsDialog(true)
          }

          setIsDialogOpen(false)
          resetForm()
        } else {
          toast.error(response.error || "Failed to create teacher")
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save teacher")
    } finally {
      setSubmitting(false)
    }
  }

  // State for Edit Credentials Modal
  const [showEditCredentialsModal, setShowEditCredentialsModal] = useState(false)
  const [credentialsEntity, setCredentialsEntity] = useState<{ id: string, name: string } | null>(null)

  const handleEditCredentials = (teacher: teachersApi.Staff) => {
    setCredentialsEntity({
      id: teacher.id,
      name: `${teacher.profile?.first_name || ""} ${teacher.profile?.last_name || ""}`
    })
    setShowEditCredentialsModal(true)
  }

  const handleEdit = async (teacher: teachersApi.Staff) => {
    console.log('🎯 handleEdit - Fetching fresh teacher data with base_salary for:', teacher.id)
    
    // Fetch fresh teacher data including base_salary
    const freshTeacher = await teachersApi.getTeacherById(teacher.id)
    
    if (!freshTeacher) {
      toast.error('Failed to load teacher details')
      return
    }
    
    console.log('🎯 handleEdit - Fresh teacher data loaded:', freshTeacher)
    console.log('🎯 handleEdit - base_salary from fresh data:', (freshTeacher as any).base_salary)
    
    setEditingTeacher(freshTeacher)
    setFormData({
      employee_number: freshTeacher.employee_number,
      title: freshTeacher.title || "",
      department: freshTeacher.department || "",
      qualifications: freshTeacher.qualifications || "",
      specialization: freshTeacher.specialization || "",
      employment_type: freshTeacher.employment_type,
      first_name: freshTeacher.profile?.first_name || "",
      last_name: freshTeacher.profile?.last_name || "",
      email: freshTeacher.profile?.email || "",
      phone: freshTeacher.profile?.phone || "",
      custom_fields: freshTeacher.custom_fields || {}
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this teacher?")) return

    try {
      const response = await deleteTeacher(id)
      if (response.success) {
        toast.success("Teacher deactivated successfully")
      } else {
        toast.error(response.error || "Failed to deactivate teacher")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to deactivate teacher")
    }
  }

  const resetForm = () => {
    setFormData({
      employee_number: "",
      title: "",
      department: "",
      qualifications: "",
      specialization: "",
      date_of_joining: "",
      employment_type: "full_time",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      username: "",
      password: ""
    })
    setEditingTeacher(null)
  }

  // Loading state
  const loading = dataLoading || submitting

  // Helper for employment badge colors
  const getEmploymentBadge = (type: teachersApi.EmploymentType) => {
    const variants: Record<teachersApi.EmploymentType, string> = {
      full_time: "default",
      part_time: "secondary",
      contract: "outline"
    }
    return variants[type] || "default"
  }

  // Merge & Sort Fields Logic (inline custom fields)
  const getMergedFields = (categories: string[]) => {
    // Filter standard fields by category and exclude system fields when editing
    const relevantStandard = STANDARD_FIELDS.filter(f => {
      if (!categories.includes(f.category)) return false
      // Hide system/credentials fields when editing
      if (editingTeacher && f.category === 'system') return false
      return true
    })

    // Filter and map custom fields
    const relevantCustom = customFields
      .filter(f => categories.includes(f.category_id))
      .map(f => {
        const finalSortOrder = f.sort_order !== undefined && f.sort_order !== null ? f.sort_order : 1000
        console.log(`Teacher Custom field "${f.label}" - Original sort_order: ${f.sort_order}, Final: ${finalSortOrder}`)
        return {
          ...f,
          isCustom: true,
          id: f.field_key,
          category: f.category_id,
          width: (f.type === 'long-text' || f.type === 'textarea') ? 'full' : 'half' as 'full' | 'half',
          sort_order: finalSortOrder
        }
      })

    // Merge and sort
    const merged = [...relevantStandard, ...relevantCustom]
    
    console.log('Teacher merged before sort:', merged.map(f => ({ label: f.label, sort_order: f.sort_order, isCustom: !!f.isCustom })))
    
    const sorted = merged.sort((a, b) => {
      const aOrder = a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 1000
      const bOrder = b.sort_order !== undefined && b.sort_order !== null ? b.sort_order : 1000
      return aOrder - bOrder
    })
    
    console.log('Teacher merged after sort:', sorted.map(f => ({ label: f.label, sort_order: f.sort_order, isCustom: !!f.isCustom })))
    
    return sorted
  }

  // Render a single field (standard or custom)
  const renderField = (field: any) => {
    const isCustom = !!field.isCustom
    // Initialize multi-select fields as arrays
    const defaultValue = field.type === 'multi-select' ? [] : ''
    const value = isCustom
      ? (formData.custom_fields?.[field.field_key] ?? defaultValue)
      : (formData[field.id as keyof typeof formData] ?? defaultValue)
    
    const handleChange = (val: any) => {
      if (isCustom) {
        setFormData(prev => ({
          ...prev,
          custom_fields: { ...prev.custom_fields, [field.field_key]: val }
        }))
      } else {
        setFormData(prev => ({ ...prev, [field.id]: val }))
      }
    }

    const widthClass = field.width === 'full' ? 'col-span-2' : 'col-span-1'

    // Handle special field types for standard fields
    if (!isCustom) {
      // Employment type select
      if (field.id === 'employment_type') {
        return (
          <div key={field.id} className={widthClass}>
            <Label>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
            <Select value={value as string} onValueChange={handleChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full Time</SelectItem>
                <SelectItem value="part_time">Part Time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )
      }

      // Base salary with dollar icon
      if (field.id === 'base_salary') {
        return (
          <div key={field.id} className={widthClass}>
            <Label>{field.label} {field.required && <span className="text-red-500">*</span>}</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                value={value as number || ""}
                onChange={(e) => handleChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 50000"
                className="pl-10"
                min="0"
                step="100"
              />
            </div>
            {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
          </div>
        )
      }

      // Username with regenerate button
      if (field.id === 'username' && !editingTeacher) {
        return (
          <div key={field.id} className={widthClass}>
            <Label>{field.label}</Label>
            <div className="flex gap-2">
              <Input
                value={value as string}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Auto-generated from name"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (!formData.first_name || !formData.last_name) {
                    toast.error('Please enter first and last name first')
                    return
                  }
                  const firstNamePart = formData.first_name.toLowerCase().replace(/\\s+/g, '')
                  const lastNamePart = formData.last_name.toLowerCase().replace(/\\s+/g, '')
                  const randomDigits = Math.floor(1000 + Math.random() * 9000)
                  const username = `${firstNamePart}.${lastNamePart}${randomDigits}`.substring(0, 30)
                  handleChange(username)
                }}
                title="Regenerate Username"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
          </div>
        )
      }

      // Password with regenerate button
      if (field.id === 'password' && !editingTeacher) {
        return (
          <div key={field.id} className={widthClass}>
            <Label>{field.label}</Label>
            <div className="flex gap-2">
              <Input
                value={value as string}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Auto-generated secure password"
                type="text"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleChange(generatePassword())}
                title="Regenerate Password"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
          </div>
        )
      }
    }

    // Standard rendering for most field types
    return (
      <div key={field.id} className={widthClass}>
        <Label>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </Label>
        {field.type === 'text' || field.type === 'email' || field.type === 'number' ? (
          <Input
            type={field.type}
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        ) : field.type === 'textarea' || field.type === 'long-text' ? (
          <Textarea
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        ) : field.type === 'date' ? (
          <Input
            type="date"
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
          />
        ) : field.type === 'select' ? (
          <Select value={value as string} onValueChange={handleChange}>
            <SelectTrigger><SelectValue placeholder={`Select ${field.label}`} /></SelectTrigger>
            <SelectContent>
              {field.options && field.options.length > 0 ? (
                field.options.map((opt: string) => (
                  <SelectItem key={opt} value={opt}>
                    {opt.replace('_', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-options" disabled>
                  No options available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : field.type === 'checkbox' ? (
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox checked={!!value} onCheckedChange={handleChange} id={field.id} />
            <label htmlFor={field.id} className="text-sm cursor-pointer">{field.label}</label>
          </div>
        ) : field.type === 'file' ? (
          <div className="space-y-2">
            <Input
              type="file"
              id={field.id}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleChange(file.name);
                }
              }}
            />
            {value && (
              <p className="text-xs text-muted-foreground">Current: {value}</p>
            )}
          </div>
        ) : field.type === 'multi-select' ? (
          <MultiSelect
            options={field.options || []}
            value={Array.isArray(value) ? value : (value ? [value] : [])}
            onChange={handleChange}
            placeholder={`Select ${field.label.toLowerCase()}`}
          />
        ) : null}
        {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue">Teachers</h1>
          <p className="text-muted-foreground">Manage teaching staff and faculty</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refreshTeachers()}
            disabled={isValidating}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            style={{ background: 'var(--gradient-blue)' }}
            className="text-white hover:opacity-90 transition-opacity"
            onClick={() => router.push('/admin/teachers/add')}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Teacher
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  Edit Teacher
                </DialogTitle>
              </DialogHeader>
              <AddTeacherForm 
                onSuccess={() => {
                  setIsDialogOpen(false)
                  resetForm()
                  refreshTeachers()
                }}
                editingTeacher={editingTeacher}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Teachers</p>
                <h3 className="text-2xl font-bold">{total}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-blue flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Teachers</p>
                <h3 className="text-2xl font-bold">{filteredTeachers.filter(t => t.is_active !== false).length}</h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-teal flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Full Time</p>
                <h3 className="text-2xl font-bold">
                  {filteredTeachers.filter(t => t.employment_type === "full_time").length}
                </h3>
              </div>
              <div className="h-12 w-12 rounded-full bg-gradient-orange flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name, employee number, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300"
              />
              Show inactive
            </label>
          </div>
        </CardHeader>
      </Card>

      {/* Teachers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-[#57A3CC]/10 to-[#022172]/10">
                    <TableHead>Employee #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No teachers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTeachers.map((teacher) => {
                      const fullName =
                        `${teacher.profile?.first_name || ""} ${teacher.profile?.last_name || ""}`.trim() ||
                        "N/A"
                      return (
                        <TableRow key={teacher.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{teacher.employee_number}</TableCell>
                          <TableCell>{fullName}</TableCell>
                          <TableCell>{teacher.department || "—"}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {teacher.specialization || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEmploymentBadge(teacher.employment_type) as any}>
                              {teacher.employment_type?.replace("_", " ") || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={teacher.is_active ? "default" : "secondary"}>
                              {teacher.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{teacher.profile?.email || "—"}</div>
                            <div className="text-muted-foreground">{teacher.profile?.phone || "—"}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(teacher)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCredentials(teacher)}
                                title="Update Credentials"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(teacher.id)}
                                title="Deactivate Teacher"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, total)} of {total} teachers
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || dataLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
              </PaginationItem>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber
                if (totalPages <= 5) {
                  pageNumber = i + 1
                } else if (currentPage <= 3) {
                  pageNumber = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i
                } else {
                  pageNumber = currentPage - 2 + i
                }

                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                      className="cursor-pointer"
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}

              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || dataLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600">✓ Teacher Created Successfully!</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800 mb-3">
                ⚠️ Important: Please save these credentials. They won't be shown again!
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Employee Number</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={generatedCredentials?.employeeNumber || ''}
                      readOnly
                      className="font-mono bg-white"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials?.employeeNumber || '')
                        toast.success('Copied!')
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email / Username</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={generatedCredentials?.username || ''}
                      readOnly
                      className="font-mono bg-white"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials?.username || '')
                        toast.success('Copied!')
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Password</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={generatedCredentials?.password || ''}
                      readOnly
                      className="font-mono bg-white"
                      type="text"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCredentials?.password || '')
                        toast.success('Copied!')
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setShowCredentialsDialog(false)
                  setGeneratedCredentials(null)
                }}
                style={{ background: 'var(--gradient-blue)' }}
                className="text-white hover:opacity-90 transition-opacity"
              >
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Credentials Modal */}
      {credentialsEntity && (
        <EditCredentialsModal
          isOpen={showEditCredentialsModal}
          onClose={() => setShowEditCredentialsModal(false)}
          entityId={credentialsEntity.id}
          entityName={credentialsEntity.name}
          entityType="teacher"
          schoolId=""
          onSuccess={() => refreshTeachers()}
        />
      )}
    </div>
  )
}
