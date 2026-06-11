'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  CreditCard, Printer, Download, Trash2,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Type, ImageIcon, Palette, Ruler,
  Users, GraduationCap, BookOpen, UserCheck, UserCircle, Settings,
  FileText, Layers,
} from 'lucide-react'
import { getStudents } from '@/lib/api/students'
import { getAllTeachers } from '@/lib/api/teachers'
import { getAllStaff } from '@/lib/api/staff'

// ─── Constants ────────────────────────────────────────────────────────────────

const PX_PER_INCH = 96
const CANVAS_SCALE = 2.8 // display scale factor for the designer canvas

type Unit = 'in' | 'cm' | 'mm' | 'px'
type UserType = 'student' | 'teacher' | 'staff' | 'librarian' | 'parent' | 'admin'
type FieldType = 'text' | 'image' | 'qrcode' | 'shape'

const UNIT_TO_PX: Record<Unit, number> = {
  in: PX_PER_INCH,
  cm: PX_PER_INCH / 2.54,
  mm: PX_PER_INCH / 25.4,
  px: 1,
}

const CARD_PRESETS: { label: string; width: number; height: number; unit: Unit }[] = [
  { label: 'CR80 – Standard ID (3.375" × 2.125")', width: 3.375, height: 2.125, unit: 'in' },
  { label: 'CR79 (3.303" × 2.051")', width: 3.303, height: 2.051, unit: 'in' },
  { label: 'Business Card (3.5" × 2")', width: 3.5, height: 2, unit: 'in' },
  { label: 'A4 Portrait (8.27" × 11.69")', width: 8.27, height: 11.69, unit: 'in' },
  { label: 'A5 Portrait (5.83" × 8.27")', width: 5.83, height: 8.27, unit: 'in' },
  { label: 'Custom', width: 0, height: 0, unit: 'in' },
]

// ─── Token Definitions ────────────────────────────────────────────────────────

const TOKENS: Record<UserType, Record<string, { label: string; category: string; isImage?: boolean }>> = {
  student: {
    '{{photo_url}}': { label: 'Photo', category: 'Basic', isImage: true },
    '{{school_logo}}': { label: 'School Logo', category: 'Basic', isImage: true },
    '{{full_name}}': { label: 'Full Name', category: 'Basic' },
    '{{first_name}}': { label: 'First Name', category: 'Basic' },
    '{{last_name}}': { label: 'Last Name', category: 'Basic' },
    '{{student_number}}': { label: 'Student Number', category: 'Academic' },
    '{{student_id}}': { label: 'Student ID', category: 'Academic' },
    '{{grade_level}}': { label: 'Grade Level', category: 'Academic' },
    '{{section}}': { label: 'Section', category: 'Academic' },
    '{{academic_year}}': { label: 'Academic Year', category: 'Academic' },
    '{{date_of_birth}}': { label: 'Date of Birth', category: 'Personal' },
    '{{gender}}': { label: 'Gender', category: 'Personal' },
    '{{blood_group}}': { label: 'Blood Group', category: 'Personal' },
    '{{phone}}': { label: 'Phone', category: 'Personal' },
    '{{email}}': { label: 'Email', category: 'Personal' },
    '{{address}}': { label: 'Address', category: 'Personal' },
    '{{father_name}}': { label: "Father's Name", category: 'Parent' },
    '{{mother_name}}': { label: "Mother's Name", category: 'Parent' },
    '{{parent_phone}}': { label: 'Parent Phone', category: 'Parent' },
    '{{emergency_contact}}': { label: 'Emergency Contact', category: 'Emergency' },
    '{{emergency_phone}}': { label: 'Emergency Phone', category: 'Emergency' },
    '{{campus_name}}': { label: 'Campus Name', category: 'School' },
    '{{school_name}}': { label: 'School Name', category: 'School' },
    '{{school_address}}': { label: 'School Address', category: 'School' },
    '{{valid_until}}': { label: 'Valid Until', category: 'Validity' },
    '{{issue_date}}': { label: 'Issue Date', category: 'Validity' },
    '{{current_date}}': { label: 'Today Date', category: 'Validity' },
  },
  teacher: {
    '{{photo_url}}': { label: 'Photo', category: 'Basic', isImage: true },
    '{{school_logo}}': { label: 'School Logo', category: 'Basic', isImage: true },
    '{{full_name}}': { label: 'Full Name', category: 'Basic' },
    '{{first_name}}': { label: 'First Name', category: 'Basic' },
    '{{last_name}}': { label: 'Last Name', category: 'Basic' },
    '{{email}}': { label: 'Email', category: 'Basic' },
    '{{phone}}': { label: 'Phone', category: 'Basic' },
    '{{employee_id}}': { label: 'Employee ID', category: 'Employment' },
    '{{designation}}': { label: 'Designation', category: 'Employment' },
    '{{department}}': { label: 'Department', category: 'Employment' },
    '{{subjects}}': { label: 'Subjects', category: 'Employment' },
    '{{joining_date}}': { label: 'Joining Date', category: 'Employment' },
    '{{qualification}}': { label: 'Qualification', category: 'Employment' },
    '{{specialization}}': { label: 'Specialization', category: 'Employment' },
    '{{blood_group}}': { label: 'Blood Group', category: 'Personal' },
    '{{date_of_birth}}': { label: 'Date of Birth', category: 'Personal' },
    '{{gender}}': { label: 'Gender', category: 'Personal' },
    '{{address}}': { label: 'Address', category: 'Personal' },
    '{{emergency_contact}}': { label: 'Emergency Contact', category: 'Emergency' },
    '{{campus_name}}': { label: 'Campus Name', category: 'School' },
    '{{school_name}}': { label: 'School Name', category: 'School' },
    '{{valid_until}}': { label: 'Valid Until', category: 'Validity' },
    '{{issue_date}}': { label: 'Issue Date', category: 'Validity' },
  },
  staff: {
    '{{photo_url}}': { label: 'Photo', category: 'Basic', isImage: true },
    '{{school_logo}}': { label: 'School Logo', category: 'Basic', isImage: true },
    '{{full_name}}': { label: 'Full Name', category: 'Basic' },
    '{{first_name}}': { label: 'First Name', category: 'Basic' },
    '{{last_name}}': { label: 'Last Name', category: 'Basic' },
    '{{email}}': { label: 'Email', category: 'Basic' },
    '{{phone}}': { label: 'Phone', category: 'Basic' },
    '{{employee_id}}': { label: 'Employee ID', category: 'Employment' },
    '{{role}}': { label: 'Role / Position', category: 'Employment' },
    '{{department}}': { label: 'Department', category: 'Employment' },
    '{{joining_date}}': { label: 'Joining Date', category: 'Employment' },
    '{{qualification}}': { label: 'Qualification', category: 'Employment' },
    '{{blood_group}}': { label: 'Blood Group', category: 'Personal' },
    '{{date_of_birth}}': { label: 'Date of Birth', category: 'Personal' },
    '{{gender}}': { label: 'Gender', category: 'Personal' },
    '{{address}}': { label: 'Address', category: 'Personal' },
    '{{emergency_contact}}': { label: 'Emergency Contact', category: 'Emergency' },
    '{{campus_name}}': { label: 'Campus Name', category: 'School' },
    '{{school_name}}': { label: 'School Name', category: 'School' },
    '{{valid_until}}': { label: 'Valid Until', category: 'Validity' },
    '{{issue_date}}': { label: 'Issue Date', category: 'Validity' },
  },
  librarian: {
    '{{photo_url}}': { label: 'Photo', category: 'Basic', isImage: true },
    '{{school_logo}}': { label: 'School Logo', category: 'Basic', isImage: true },
    '{{full_name}}': { label: 'Full Name', category: 'Basic' },
    '{{first_name}}': { label: 'First Name', category: 'Basic' },
    '{{last_name}}': { label: 'Last Name', category: 'Basic' },
    '{{email}}': { label: 'Email', category: 'Basic' },
    '{{phone}}': { label: 'Phone', category: 'Basic' },
    '{{employee_id}}': { label: 'Employee ID', category: 'Employment' },
    '{{department}}': { label: 'Department', category: 'Employment' },
    '{{joining_date}}': { label: 'Joining Date', category: 'Employment' },
    '{{blood_group}}': { label: 'Blood Group', category: 'Personal' },
    '{{gender}}': { label: 'Gender', category: 'Personal' },
    '{{address}}': { label: 'Address', category: 'Personal' },
    '{{campus_name}}': { label: 'Campus Name', category: 'School' },
    '{{school_name}}': { label: 'School Name', category: 'School' },
    '{{valid_until}}': { label: 'Valid Until', category: 'Validity' },
    '{{issue_date}}': { label: 'Issue Date', category: 'Validity' },
  },
  parent: {
    '{{photo_url}}': { label: 'Photo', category: 'Basic', isImage: true },
    '{{school_logo}}': { label: 'School Logo', category: 'Basic', isImage: true },
    '{{full_name}}': { label: 'Full Name', category: 'Basic' },
    '{{first_name}}': { label: 'First Name', category: 'Basic' },
    '{{last_name}}': { label: 'Last Name', category: 'Basic' },
    '{{email}}': { label: 'Email', category: 'Basic' },
    '{{phone}}': { label: 'Phone', category: 'Basic' },
    '{{cnic}}': { label: 'CNIC / National ID', category: 'Personal' },
    '{{occupation}}': { label: 'Occupation', category: 'Personal' },
    '{{workplace}}': { label: 'Workplace', category: 'Personal' },
    '{{address}}': { label: 'Address', category: 'Personal' },
    '{{gender}}': { label: 'Gender', category: 'Personal' },
    '{{children_names}}': { label: "Children's Names", category: 'Children' },
    '{{children_grades}}': { label: "Children's Grades", category: 'Children' },
    '{{emergency_contact}}': { label: 'Emergency Contact', category: 'Emergency' },
    '{{school_name}}': { label: 'School Name', category: 'School' },
    '{{valid_until}}': { label: 'Valid Until', category: 'Validity' },
    '{{issue_date}}': { label: 'Issue Date', category: 'Validity' },
  },
  admin: {
    '{{photo_url}}': { label: 'Photo', category: 'Basic', isImage: true },
    '{{school_logo}}': { label: 'School Logo', category: 'Basic', isImage: true },
    '{{full_name}}': { label: 'Full Name', category: 'Basic' },
    '{{first_name}}': { label: 'First Name', category: 'Basic' },
    '{{last_name}}': { label: 'Last Name', category: 'Basic' },
    '{{email}}': { label: 'Email', category: 'Basic' },
    '{{phone}}': { label: 'Phone', category: 'Basic' },
    '{{employee_id}}': { label: 'Employee ID', category: 'Employment' },
    '{{role}}': { label: 'Role / Title', category: 'Employment' },
    '{{department}}': { label: 'Department', category: 'Employment' },
    '{{joining_date}}': { label: 'Joining Date', category: 'Employment' },
    '{{blood_group}}': { label: 'Blood Group', category: 'Personal' },
    '{{gender}}': { label: 'Gender', category: 'Personal' },
    '{{address}}': { label: 'Address', category: 'Personal' },
    '{{emergency_contact}}': { label: 'Emergency Contact', category: 'Emergency' },
    '{{school_name}}': { label: 'School Name', category: 'School' },
    '{{school_address}}': { label: 'School Address', category: 'School' },
    '{{valid_until}}': { label: 'Valid Until', category: 'Validity' },
    '{{issue_date}}': { label: 'Issue Date', category: 'Validity' },
  },
}

const USER_TYPE_META: Record<UserType, { label: string; icon: React.ReactNode; color: string }> = {
  student: { label: 'Student', icon: <GraduationCap className="h-4 w-4" />, color: 'bg-blue-500' },
  teacher: { label: 'Teacher', icon: <UserCheck className="h-4 w-4" />, color: 'bg-green-500' },
  staff: { label: 'Staff', icon: <Users className="h-4 w-4" />, color: 'bg-orange-500' },
  librarian: { label: 'Librarian', icon: <BookOpen className="h-4 w-4" />, color: 'bg-purple-500' },
  parent: { label: 'Parent', icon: <UserCircle className="h-4 w-4" />, color: 'bg-pink-500' },
  admin: { label: 'Admin', icon: <Settings className="h-4 w-4" />, color: 'bg-red-500' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DesignField {
  id: string
  token: string
  label: string
  type: FieldType
  x: number  // in card px (at 96dpi)
  y: number
  width: number
  height: number
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  color: string
  align: 'left' | 'center' | 'right'
  borderRadius: number
  bgColor: string
  opacity: number
}

interface CardDimensions {
  width: number   // in selected unit
  height: number
  unit: Unit
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInches(value: number, unit: Unit) {
  return (value * UNIT_TO_PX[unit]) / PX_PER_INCH
}

function fromInches(inches: number, unit: Unit) {
  return (inches * PX_PER_INCH) / UNIT_TO_PX[unit]
}

function cardPx(value: number, unit: Unit) {
  return value * UNIT_TO_PX[unit]
}

function uniqueId() {
  return Math.random().toString(36).slice(2, 9)
}

function groupTokens(tokens: Record<string, { label: string; category: string; isImage?: boolean }>) {
  const groups: Record<string, { token: string; label: string; isImage?: boolean }[]> = {}
  for (const [token, meta] of Object.entries(tokens)) {
    if (!groups[meta.category]) groups[meta.category] = []
    groups[meta.category].push({ token, label: meta.label, isImage: meta.isImage })
  }
  return groups
}

// ─── Default card ─────────────────────────────────────────────────────────────

function defaultFields(): DesignField[] {
  return [
    {
      id: uniqueId(), token: '{{photo_url}}', label: 'Photo', type: 'image',
      x: 12, y: 20, width: 60, height: 80,
      fontSize: 12, fontWeight: 'normal', fontStyle: 'normal',
      color: '#000000', align: 'center', borderRadius: 4, bgColor: '#e5e7eb', opacity: 1,
    },
    {
      id: uniqueId(), token: '{{school_name}}', label: 'School Name', type: 'text',
      x: 82, y: 14, width: 200, height: 22,
      fontSize: 11, fontWeight: 'bold', fontStyle: 'normal',
      color: '#1e3a8a', align: 'left', borderRadius: 0, bgColor: 'transparent', opacity: 1,
    },
    {
      id: uniqueId(), token: '{{full_name}}', label: 'Full Name', type: 'text',
      x: 82, y: 42, width: 200, height: 20,
      fontSize: 13, fontWeight: 'bold', fontStyle: 'normal',
      color: '#111827', align: 'left', borderRadius: 0, bgColor: 'transparent', opacity: 1,
    },
    {
      id: uniqueId(), token: '{{student_number}}', label: 'Student Number', type: 'text',
      x: 82, y: 66, width: 200, height: 18,
      fontSize: 10, fontWeight: 'normal', fontStyle: 'normal',
      color: '#374151', align: 'left', borderRadius: 0, bgColor: 'transparent', opacity: 1,
    },
    {
      id: uniqueId(), token: '{{grade_level}}', label: 'Grade Level', type: 'text',
      x: 82, y: 88, width: 120, height: 16,
      fontSize: 10, fontWeight: 'normal', fontStyle: 'normal',
      color: '#374151', align: 'left', borderRadius: 0, bgColor: 'transparent', opacity: 1,
    },
    {
      id: uniqueId(), token: '{{valid_until}}', label: 'Valid Until', type: 'text',
      x: 12, y: 114, width: 270, height: 16,
      fontSize: 9, fontWeight: 'normal', fontStyle: 'normal',
      color: '#6b7280', align: 'center', borderRadius: 0, bgColor: 'transparent', opacity: 1,
    },
  ]
}

// ─── Field canvas element ─────────────────────────────────────────────────────

function CanvasField({
  field, scale, selected, onSelect, onDragEnd,
}: {
  field: DesignField
  scale: number
  selected: boolean
  onSelect: () => void
  onDragEnd: (dx: number, dy: number) => void
}) {
  const dragRef = useRef<{ startX: number; startY: number } | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
    dragRef.current = { startX: e.clientX, startY: e.clientY }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = (ev.clientX - dragRef.current.startX) / scale
      const dy = (ev.clientY - dragRef.current.startY) / scale
      // live preview via CSS transform
      const el = document.getElementById(`field-${field.id}`)
      if (el) el.style.transform = `translate(${dx}px,${dy}px)`
    }

    const onUp = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = (ev.clientX - dragRef.current.startX) / scale
      const dy = (ev.clientY - dragRef.current.startY) / scale
      onDragEnd(dx, dy)
      const el = document.getElementById(`field-${field.id}`)
      if (el) el.style.transform = ''
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const isImage = field.type === 'image'

  return (
    <div
      id={`field-${field.id}`}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: field.x * scale,
        top: field.y * scale,
        width: field.width * scale,
        height: field.height * scale,
        cursor: 'move',
        userSelect: 'none',
        outline: selected ? '2px solid #3b82f6' : '1px dashed transparent',
        outlineOffset: 1,
        borderRadius: field.borderRadius,
        backgroundColor: field.bgColor === 'transparent' ? undefined : field.bgColor,
        opacity: field.opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          field.align === 'center' ? 'center' : field.align === 'right' ? 'flex-end' : 'flex-start',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {selected && (
        <div className="absolute -top-4 left-0 text-[9px] text-blue-500 whitespace-nowrap font-medium pointer-events-none">
          {field.label}
        </div>
      )}
      {isImage ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded text-gray-400"
          style={{ fontSize: field.fontSize * scale * 0.6 }}>
          <ImageIcon style={{ width: field.height * scale * 0.4, height: field.height * scale * 0.4 }} />
        </div>
      ) : (
        <span
          style={{
            fontSize: field.fontSize * scale,
            fontWeight: field.fontWeight,
            fontStyle: field.fontStyle,
            color: field.color,
            textAlign: field.align,
            width: '100%',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {field.label}
        </span>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IdCardDesignerPage() {
  // ── Designer state ──
  const [userType, setUserType] = useState<UserType>('student')
  const [fields, setFields] = useState<DesignField[]>(defaultFields)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImage, setBgImage] = useState<string>('')
  const [borderColor, setBorderColor] = useState('#3b82f6')
  const [borderWidth, setBorderWidth] = useState(2)
  const [borderRadius, setBorderRadius] = useState(8)

  // ── Dimensions state ──
  const [unit, setUnit] = useState<Unit>('in')
  const [dims, setDims] = useState<CardDimensions>({ width: 3.375, height: 2.125, unit: 'in' })

  // ── Print state ──
  const [tab, setTab] = useState<'designer' | 'print'>('designer')
  const [printUsers, setPrintUsers] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const canvasRef = useRef<HTMLDivElement>(null)
  const printAreaRef = useRef<HTMLDivElement>(null)

  // computed card pixel dimensions
  const cardWidthPx = cardPx(dims.width, dims.unit)
  const cardHeightPx = cardPx(dims.height, dims.unit)
  const scale = CANVAS_SCALE

  const selectedField = fields.find(f => f.id === selectedId) ?? null

  // ── User type change → reset fields to sensible defaults ──
  const handleUserTypeChange = (type: UserType) => {
    setUserType(type)
    setSelectedId(null)
    // Keep existing layout, just clear fields that don't make sense
    setFields(defaultFields())
  }

  // ── Dimension preset ──
  const applyPreset = (preset: typeof CARD_PRESETS[0]) => {
    if (preset.width === 0) return
    const inInches = { width: preset.width, height: preset.height }
    setDims({ width: fromInches(inInches.width, unit), height: fromInches(inInches.height, unit), unit })
  }

  // ── Add field from panel ──
  const addField = (token: string) => {
    const meta = TOKENS[userType][token]
    const isImage = meta?.isImage ?? false
    const newField: DesignField = {
      id: uniqueId(),
      token,
      label: meta?.label ?? token,
      type: isImage ? 'image' : 'text',
      x: 20,
      y: 20,
      width: isImage ? 60 : 160,
      height: isImage ? 80 : 20,
      fontSize: isImage ? 12 : 11,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#111827',
      align: 'left',
      borderRadius: isImage ? 4 : 0,
      bgColor: 'transparent',
      opacity: 1,
    }
    setFields(prev => [...prev, newField])
    setSelectedId(newField.id)
    toast.success(`Added: ${meta?.label ?? token}`)
  }

  // ── Field drag ──
  const handleDragEnd = useCallback((id: string, dx: number, dy: number) => {
    setFields(prev => prev.map(f =>
      f.id === id
        ? {
          ...f,
          x: Math.max(0, Math.min(f.x + dx, cardWidthPx - f.width)),
          y: Math.max(0, Math.min(f.y + dy, cardHeightPx - f.height)),
        }
        : f
    ))
  }, [cardWidthPx, cardHeightPx])

  // ── Update selected field property ──
  const updateField = (key: keyof DesignField, value: any) => {
    if (!selectedId) return
    setFields(prev => prev.map(f => f.id === selectedId ? { ...f, [key]: value } : f))
  }

  // ── Delete selected ──
  const deleteField = () => {
    if (!selectedId) return
    setFields(prev => prev.filter(f => f.id !== selectedId))
    setSelectedId(null)
  }

  // ── Load users for print ──
  useEffect(() => {
    if (tab !== 'print') return
    setLoadingUsers(true)
    const load = async () => {
      try {
        let data: any[] = []
        if (userType === 'student') {
          const res = await getStudents({ limit: 500 }) as any
          data = Array.isArray(res) ? res : res?.students ?? res?.data ?? []
        } else if (userType === 'teacher') {
          const res = await getAllTeachers({ limit: 500 }) as any
          data = Array.isArray(res) ? res : res?.data ?? res?.teachers ?? []
        } else if (userType === 'staff' || userType === 'librarian' || userType === 'admin') {
          const role = userType === 'librarian' ? 'librarian' : userType === 'admin' ? 'all' : 'staff'
          const res = await getAllStaff(1, 500, undefined, role as any) as any
          data = Array.isArray(res) ? res : res?.data ?? res?.staff ?? []
        }
        setPrintUsers(Array.isArray(data) ? data : [])
      } catch {
        toast.error('Failed to load users')
      } finally {
        setLoadingUsers(false)
      }
    }
    load()
  }, [tab, userType])

  const filteredUsers = printUsers.filter(u => {
    const name = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase()
    return name.includes(searchQuery.toLowerCase())
  })

  // ── Export to PDF ──
  const exportPDF = async () => {
    if (!canvasRef.current) return
    toast.info('Generating PDF…')
    try {
      const canvas = await html2canvas(canvasRef.current, { scale: 3, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const widthIn = toInches(cardWidthPx, 'in')
      const heightIn = toInches(cardHeightPx, 'in')
      const pdf = new jsPDF({
        orientation: widthIn > heightIn ? 'landscape' : 'portrait',
        unit: 'in',
        format: [widthIn, heightIn],
      })
      pdf.addImage(imgData, 'PNG', 0, 0, widthIn, heightIn)
      pdf.save('id-card.pdf')
      toast.success('PDF exported!')
    } catch {
      toast.error('PDF export failed')
    }
  }

  const handlePrint = () => window.print()

  const groups = groupTokens(TOKENS[userType])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2 gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">ID Card Designer</h1>
          <Badge variant="secondary" className="text-xs">
            {cardPx(dims.width, dims.unit).toFixed(0)}×{cardPx(dims.height, dims.unit).toFixed(0)} px
            &nbsp;·&nbsp;{dims.width.toFixed(2)}{dims.unit} × {dims.height.toFixed(2)}{dims.unit}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* User type selector */}
          <Select value={userType} onValueChange={v => handleUserTypeChange(v as UserType)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(USER_TYPE_META) as UserType[]).map(t => (
                <SelectItem key={t} value={t}>
                  <div className="flex items-center gap-2">
                    {USER_TYPE_META[t].icon}
                    {USER_TYPE_META[t].label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex border rounded overflow-hidden">
            <Button
              size="sm" variant={tab === 'designer' ? 'default' : 'ghost'}
              className="rounded-none h-8 px-3 text-xs"
              onClick={() => setTab('designer')}
            >
              <Layers className="h-3.5 w-3.5 mr-1" /> Designer
            </Button>
            <Button
              size="sm" variant={tab === 'print' ? 'default' : 'ghost'}
              className="rounded-none h-8 px-3 text-xs"
              onClick={() => setTab('print')}
            >
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
          </div>

          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportPDF}>
            <Download className="h-3.5 w-3.5" /> Export PDF
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* ── Designer Tab ── */}
      {tab === 'designer' && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Fields Panel ── */}
          <div className="w-52 border-r bg-background flex flex-col print:hidden">
            <div className="px-3 py-2 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {USER_TYPE_META[userType].label} Fields
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Click to add to card</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-3">
                {Object.entries(groups).map(([category, tokens]) => (
                  <div key={category}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
                      {category}
                    </p>
                    <div className="space-y-0.5">
                      {tokens.map(({ token, label, isImage }) => (
                        <button
                          key={token}
                          onClick={() => addField(token)}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary flex items-center gap-1.5 transition-colors"
                        >
                          {isImage ? <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" /> : <Type className="h-3 w-3 shrink-0 text-muted-foreground" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* ── Center: Canvas ── */}
          <div className="flex-1 flex flex-col items-center justify-center bg-muted/50 overflow-auto p-8 print:p-0">
            <div
              onClick={() => setSelectedId(null)}
              style={{
                position: 'relative',
                width: cardWidthPx * scale,
                height: cardHeightPx * scale,
                backgroundColor: bgColor,
                backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: `${borderWidth}px solid ${borderColor}`,
                borderRadius: borderRadius,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                cursor: 'default',
                overflow: 'hidden',
              }}
              ref={canvasRef}
            >
              {fields.map(field => (
                <CanvasField
                  key={field.id}
                  field={field}
                  scale={scale}
                  selected={selectedId === field.id}
                  onSelect={() => setSelectedId(field.id)}
                  onDragEnd={(dx, dy) => handleDragEnd(field.id, dx, dy)}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Click a field to select · Drag to reposition · Use right panel to style
            </p>
          </div>

          {/* ── Right: Properties Panel ── */}
          <div className="w-64 border-l bg-background flex flex-col print:hidden overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">

                {/* Card Dimensions */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Ruler className="h-3 w-3" /> Card Dimensions
                  </p>

                  {/* Unit selector */}
                  <div className="flex gap-1 mb-2">
                    {(['in', 'cm', 'mm', 'px'] as Unit[]).map(u => (
                      <button
                        key={u}
                        onClick={() => {
                          const wIn = toInches(dims.width, dims.unit)
                          const hIn = toInches(dims.height, dims.unit)
                          setUnit(u)
                          setDims({ width: +fromInches(wIn, u).toFixed(3), height: +fromInches(hIn, u).toFixed(3), unit: u })
                        }}
                        className={`flex-1 text-[10px] py-1 rounded border transition-colors ${unit === u ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>

                  {/* Preset */}
                  <Select onValueChange={v => {
                    const preset = CARD_PRESETS.find(p => p.label === v)
                    if (preset) applyPreset(preset)
                  }}>
                    <SelectTrigger className="h-7 text-xs mb-2">
                      <SelectValue placeholder="Preset size…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_PRESETS.map(p => (
                        <SelectItem key={p.label} value={p.label} className="text-xs">{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Width ({unit})</Label>
                      <Input
                        type="number" step="0.01" className="h-7 text-xs mt-0.5"
                        value={dims.width}
                        onChange={e => setDims(d => ({ ...d, width: +e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Height ({unit})</Label>
                      <Input
                        type="number" step="0.01" className="h-7 text-xs mt-0.5"
                        value={dims.height}
                        onChange={e => setDims(d => ({ ...d, height: +e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Card Design */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Palette className="h-3 w-3" /> Card Design
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] w-20 shrink-0">Background</Label>
                      <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                        className="h-7 w-10 rounded border cursor-pointer p-0.5" />
                      <Input value={bgColor} onChange={e => setBgColor(e.target.value)}
                        className="h-7 text-xs flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] w-20 shrink-0">Border Color</Label>
                      <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)}
                        className="h-7 w-10 rounded border cursor-pointer p-0.5" />
                      <Input value={borderColor} onChange={e => setBorderColor(e.target.value)}
                        className="h-7 text-xs flex-1" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] w-20 shrink-0">Border W (px)</Label>
                      <Input type="number" min={0} max={20} value={borderWidth}
                        onChange={e => setBorderWidth(+e.target.value)}
                        className="h-7 text-xs" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] w-20 shrink-0">Radius (px)</Label>
                      <Input type="number" min={0} max={60} value={borderRadius}
                        onChange={e => setBorderRadius(+e.target.value)}
                        className="h-7 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Background Image URL</Label>
                      <Input value={bgImage} onChange={e => setBgImage(e.target.value)}
                        placeholder="https://..." className="h-7 text-xs mt-0.5" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Selected Field Properties */}
                {selectedField ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Settings className="h-3 w-3" /> Field: {selectedField.label}
                      </p>
                      <button onClick={deleteField} className="text-destructive hover:text-destructive/80 p-0.5 rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {/* Position */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <Label className="text-[10px]">X (px)</Label>
                          <Input type="number" className="h-7 text-xs mt-0.5"
                            value={Math.round(selectedField.x)}
                            onChange={e => updateField('x', +e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-[10px]">Y (px)</Label>
                          <Input type="number" className="h-7 text-xs mt-0.5"
                            value={Math.round(selectedField.y)}
                            onChange={e => updateField('y', +e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-[10px]">Width (px)</Label>
                          <Input type="number" className="h-7 text-xs mt-0.5"
                            value={Math.round(selectedField.width)}
                            onChange={e => updateField('width', +e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-[10px]">Height (px)</Label>
                          <Input type="number" className="h-7 text-xs mt-0.5"
                            value={Math.round(selectedField.height)}
                            onChange={e => updateField('height', +e.target.value)} />
                        </div>
                      </div>

                      {selectedField.type === 'text' && (
                        <>
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] w-16 shrink-0">Font size</Label>
                            <Input type="number" min={6} max={72} className="h-7 text-xs"
                              value={selectedField.fontSize}
                              onChange={e => updateField('fontSize', +e.target.value)} />
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] w-16 shrink-0">Style</Label>
                            <button
                              onClick={() => updateField('fontWeight', selectedField.fontWeight === 'bold' ? 'normal' : 'bold')}
                              className={`p-1.5 rounded border text-xs ${selectedField.fontWeight === 'bold' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            ><Bold className="h-3 w-3" /></button>
                            <button
                              onClick={() => updateField('fontStyle', selectedField.fontStyle === 'italic' ? 'normal' : 'italic')}
                              className={`p-1.5 rounded border text-xs ${selectedField.fontStyle === 'italic' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            ><Italic className="h-3 w-3" /></button>
                          </div>
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] w-16 shrink-0">Align</Label>
                            {(['left', 'center', 'right'] as const).map(a => (
                              <button key={a}
                                onClick={() => updateField('align', a)}
                                className={`p-1.5 rounded border ${selectedField.align === a ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                              >
                                {a === 'left' ? <AlignLeft className="h-3 w-3" /> : a === 'center' ? <AlignCenter className="h-3 w-3" /> : <AlignRight className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-[10px] w-16 shrink-0">Color</Label>
                            <input type="color" value={selectedField.color}
                              onChange={e => updateField('color', e.target.value)}
                              className="h-7 w-10 rounded border cursor-pointer p-0.5" />
                            <Input value={selectedField.color}
                              onChange={e => updateField('color', e.target.value)}
                              className="h-7 text-xs flex-1" />
                          </div>
                        </>
                      )}

                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] w-16 shrink-0">Bg Color</Label>
                        <input type="color" value={selectedField.bgColor === 'transparent' ? '#ffffff' : selectedField.bgColor}
                          onChange={e => updateField('bgColor', e.target.value)}
                          className="h-7 w-10 rounded border cursor-pointer p-0.5" />
                        <Input value={selectedField.bgColor}
                          onChange={e => updateField('bgColor', e.target.value)}
                          className="h-7 text-xs flex-1" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] w-16 shrink-0">Radius (px)</Label>
                        <Input type="number" min={0} max={50} className="h-7 text-xs"
                          value={selectedField.borderRadius}
                          onChange={e => updateField('borderRadius', +e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] w-16 shrink-0">Opacity</Label>
                        <input type="range" min={0} max={1} step={0.05}
                          value={selectedField.opacity}
                          onChange={e => updateField('opacity', +e.target.value)}
                          className="flex-1" />
                        <span className="text-[10px] w-8 text-right">{Math.round(selectedField.opacity * 100)}%</span>
                      </div>
                      <div>
                        <Label className="text-[10px]">Custom Label</Label>
                        <Input className="h-7 text-xs mt-0.5"
                          value={selectedField.label}
                          onChange={e => updateField('label', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-4">
                    Select a field on the canvas to edit its properties
                  </p>
                )}

                <Separator />

                {/* Field list */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Fields ({fields.length})
                  </p>
                  <div className="space-y-0.5">
                    {fields.map(f => (
                      <button key={f.id}
                        onClick={() => setSelectedId(f.id)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${selectedId === f.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                      >
                        {f.type === 'image' ? <ImageIcon className="h-3 w-3 shrink-0" /> : <Type className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{f.label}</span>
                        <span className="ml-auto text-[9px] text-muted-foreground font-mono truncate">{f.token.replace(/[{}]/g, '')}</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* ── Print Tab ── */}
      {tab === 'print' && (
        <div className="flex flex-1 overflow-hidden print:block">
          {/* Left: user list */}
          <div className="w-72 border-r bg-background flex flex-col print:hidden">
            <div className="p-3 border-b space-y-2">
              <p className="text-xs font-semibold">
                Select {USER_TYPE_META[userType].label}s to print
              </p>
              <Input
                placeholder="Search by name…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                  onClick={() => setSelectedUsers(new Set(filteredUsers.map((u: any) => u.id)))}>
                  Select All
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                  onClick={() => setSelectedUsers(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Loading…</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">No users found</div>
              ) : (
                <div className="divide-y">
                  {filteredUsers.map((u: any) => {
                    const name = `${u.first_name ?? u.profile?.first_name ?? ''} ${u.last_name ?? u.profile?.last_name ?? ''}`.trim()
                    const id = u.id
                    return (
                      <button
                        key={id}
                        onClick={() => setSelectedUsers(prev => {
                          const next = new Set(prev)
                          next.has(id) ? next.delete(id) : next.add(id)
                          return next
                        })}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted transition-colors ${selectedUsers.has(id) ? 'bg-primary/5' : ''}`}
                      >
                        <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${selectedUsers.has(id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                          {selectedUsers.has(id) && <span className="text-white text-[8px]">✓</span>}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{name || '—'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {u.student_number ?? u.employee_number ?? u.email ?? ''}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
            <div className="p-3 border-t">
              <Button className="w-full h-8 text-xs gap-1" onClick={handlePrint}
                disabled={selectedUsers.size === 0}>
                <Printer className="h-3.5 w-3.5" />
                Print {selectedUsers.size > 0 ? `(${selectedUsers.size})` : ''} Cards
              </Button>
            </div>
          </div>

          {/* Right: print preview */}
          <div className="flex-1 bg-muted/40 overflow-auto p-6 print:p-0" ref={printAreaRef}>
            {selectedUsers.size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <CreditCard className="h-12 w-12 opacity-20" />
                <p className="text-sm">Select users from the left to preview cards</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-6 justify-center print:gap-4">
                {filteredUsers.filter((u: any) => selectedUsers.has(u.id)).map((u: any) => {
                  const name = `${u.first_name ?? u.profile?.first_name ?? ''} ${u.last_name ?? u.profile?.last_name ?? ''}`.trim()
                  return (
                    <div
                      key={u.id}
                      style={{
                        position: 'relative',
                        width: cardWidthPx * 2,
                        height: cardHeightPx * 2,
                        backgroundColor: bgColor,
                        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                        backgroundSize: 'cover',
                        border: `${borderWidth}px solid ${borderColor}`,
                        borderRadius: borderRadius,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      {fields.map(field => {
                        const isImage = field.type === 'image'
                        const printScale = 2
                        return (
                          <div key={field.id} style={{
                            position: 'absolute',
                            left: field.x * printScale,
                            top: field.y * printScale,
                            width: field.width * printScale,
                            height: field.height * printScale,
                            fontSize: field.fontSize * printScale,
                            fontWeight: field.fontWeight,
                            fontStyle: field.fontStyle,
                            color: field.color,
                            textAlign: field.align,
                            backgroundColor: field.bgColor === 'transparent' ? undefined : field.bgColor,
                            borderRadius: field.borderRadius,
                            opacity: field.opacity,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: field.align === 'center' ? 'center' : field.align === 'right' ? 'flex-end' : 'flex-start',
                            overflow: 'hidden',
                            lineHeight: 1.2,
                          }}>
                            {isImage ? (
                              u.avatar_url || u.profile?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.avatar_url ?? u.profile?.avatar_url} alt={name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: field.borderRadius }} />
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 rounded">
                                  <UserCircle style={{ width: field.height * printScale * 0.6, height: field.height * printScale * 0.6 }} />
                                </div>
                              )
                            ) : (
                              <span style={{ width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {field.token === '{{full_name}}' ? name
                                  : field.token === '{{first_name}}' ? (u.first_name ?? u.profile?.first_name ?? '')
                                  : field.token === '{{last_name}}' ? (u.last_name ?? u.profile?.last_name ?? '')
                                  : field.token === '{{email}}' ? (u.email ?? u.profile?.email ?? '')
                                  : field.token === '{{phone}}' ? (u.phone ?? u.profile?.phone ?? '')
                                  : field.token === '{{student_number}}' ? (u.student_number ?? '')
                                  : field.token === '{{employee_id}}' || field.token === '{{employee_number}}' ? (u.employee_number ?? '')
                                  : field.token === '{{grade_level}}' ? (u.grade_level?.name ?? '')
                                  : field.token === '{{section}}' ? (u.section?.name ?? '')
                                  : field.token === '{{designation}}' ? (u.title ?? u.designation ?? '')
                                  : field.token === '{{department}}' ? (u.department ?? '')
                                  : field.token === '{{school_name}}' ? 'School Name'
                                  : field.label}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body > *:not(.print-area) { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          @page { margin: 0.5in; }
        }
      `}</style>
    </div>
  )
}
