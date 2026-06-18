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
  FileText, Layers, QrCode,
} from 'lucide-react'
import QRCode from 'react-qr-code'
import { getStudents } from '@/lib/api/students'
import { getAllTeachers } from '@/lib/api/teachers'
import { getAllStaff } from '@/lib/api/staff'
import { getParents } from '@/lib/api/parents'
import { useCampus } from '@/context/CampusContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const PX_PER_INCH = 96
const CANVAS_SCALE = 2.2 // display scale factor for the designer canvas

type Unit = 'in' | 'cm' | 'mm' | 'px'
type UserType = 'student' | 'teacher' | 'staff' | 'librarian' | 'parent'
type FieldType = 'text' | 'image' | 'qrcode' | 'shape' | 'labeled'

const UNIT_TO_PX: Record<Unit, number> = {
  in: PX_PER_INCH,
  cm: PX_PER_INCH / 2.54,
  mm: PX_PER_INCH / 25.4,
  px: 1,
}

// ─── Gradient & Theme Presets ─────────────────────────────────────────────────

const GRADIENT_PRESETS: { name: string; gradient: string; border: string }[] = [
  { name: 'Ocean Deep',    gradient: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)', border: '#2c5364' },
  { name: 'Royal Violet',  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',              border: '#764ba2' },
  { name: 'Sunset',        gradient: 'linear-gradient(135deg, #f7971e 0%, #f5576c 100%)',              border: '#f5576c' },
  { name: 'Emerald',       gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',              border: '#11998e' },
  { name: 'Midnight',      gradient: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)',              border: '#243b55' },
  { name: 'Sky Blue',      gradient: 'linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)',              border: '#2f80ed' },
  { name: 'Rose Gold',     gradient: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)',              border: '#b91d73' },
  { name: 'Forest',        gradient: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',              border: '#134e5e' },
  { name: 'Crimson',       gradient: 'linear-gradient(135deg, #c0392b 0%, #8e44ad 100%)',              border: '#8e44ad' },
  { name: 'Golden Hour',   gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',              border: '#fda085' },
  { name: 'Deep Space',    gradient: 'linear-gradient(135deg, #16222a 0%, #3a6186 100%)',              border: '#3a6186' },
  { name: 'Minty Fresh',   gradient: 'linear-gradient(135deg, #00b09b 0%, #96c93d 100%)',              border: '#00b09b' },
  { name: 'Peach Coral',   gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',              border: '#ff9a9e' },
  { name: 'Steel',         gradient: 'linear-gradient(135deg, #373b44 0%, #4286f4 100%)',              border: '#4286f4' },
  { name: 'Soft White',    gradient: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',              border: '#dee2e6' },
]

// ─── Card Theme / Decoration System ──────────────────────────────────────────

type BlobShape   = { type: 'blob';    cx: number; cy: number; w: number; h: number; color: string; rx: string; opacity?: number }
type DiamondShape = { type: 'diamond'; cx: number; cy: number; size: number; color: string; opacity?: number }
type StripShape  = { type: 'strip';   edge: 'top' | 'bottom'; height: number; bg: string }
type DecoShape   = BlobShape | DiamondShape | StripShape

interface CardTheme { id: string; name: string; cardBg: string; border: string; shapes: DecoShape[] }

// cx/cy as % of card width & height (can be negative — overflows, clipped by card)
// blob w/h as % of card WIDTH (keeps aspect consistent regardless of card aspect ratio)
// diamond size as % of card width
// strip height as % of card height
const CARD_THEMES: CardTheme[] = [
  { id: 'none', name: 'Plain', cardBg: '#ffffff', border: '#e5e7eb', shapes: [] },
  {
    id: 'school-classic', name: 'School Classic', cardBg: '#ffffff', border: '#10b981',
    shapes: [
      { type: 'blob',    cx: 5,   cy: 4,   w: 40, h: 40, color: '#10b981', rx: '70% 30% 60% 40% / 60% 40% 60% 40%' },
      { type: 'blob',    cx: 8,   cy: 88,  w: 32, h: 32, color: '#10b981', rx: '40% 60% 50% 50% / 50% 50% 50% 50%', opacity: 0.9 },
      { type: 'diamond', cx: 91,  cy: 40,  size: 22, color: '#f97316' },
      { type: 'diamond', cx: 100, cy: 54,  size: 15, color: '#fb923c', opacity: 0.75 },
      { type: 'strip',   edge: 'bottom', height: 13, bg: 'linear-gradient(90deg,#10b981 0%,#f97316 100%)' },
    ],
  },
  {
    id: 'ocean', name: 'Ocean', cardBg: '#ffffff', border: '#0ea5e9',
    shapes: [
      { type: 'blob',    cx: 5,   cy: 4,   w: 42, h: 42, color: '#0284c7', rx: '70% 30% 50% 50% / 60% 40% 60% 40%' },
      { type: 'blob',    cx: 92,  cy: 88,  w: 35, h: 35, color: '#0ea5e9', rx: '40% 60% 60% 40% / 50% 50% 50% 50%', opacity: 0.75 },
      { type: 'diamond', cx: -2,  cy: 42,  size: 20, color: '#38bdf8', opacity: 0.85 },
      { type: 'diamond', cx: 6,   cy: 55,  size: 13, color: '#0ea5e9', opacity: 0.6 },
      { type: 'strip',   edge: 'bottom', height: 13, bg: 'linear-gradient(90deg,#0284c7 0%,#38bdf8 100%)' },
    ],
  },
  {
    id: 'royal', name: 'Royal', cardBg: '#ffffff', border: '#7c3aed',
    shapes: [
      { type: 'blob',    cx: 5,   cy: 4,   w: 42, h: 42, color: '#7c3aed', rx: '60% 40% 40% 60% / 50% 60% 40% 50%' },
      { type: 'blob',    cx: 93,  cy: 85,  w: 36, h: 36, color: '#6d28d9', rx: '50% 50% 30% 70% / 60% 40% 60% 40%', opacity: 0.8 },
      { type: 'diamond', cx: 91,  cy: 40,  size: 22, color: '#f59e0b' },
      { type: 'diamond', cx: 100, cy: 54,  size: 14, color: '#fbbf24', opacity: 0.7 },
      { type: 'strip',   edge: 'bottom', height: 13, bg: 'linear-gradient(90deg,#7c3aed 0%,#c026d3 100%)' },
    ],
  },
  {
    id: 'sunset', name: 'Sunset', cardBg: '#ffffff', border: '#f97316',
    shapes: [
      { type: 'blob',    cx: 5,   cy: 4,   w: 42, h: 42, color: '#f97316', rx: '50% 50% 60% 40% / 60% 40% 60% 40%' },
      { type: 'blob',    cx: -4,  cy: 80,  w: 34, h: 34, color: '#ef4444', rx: '60% 40% 50% 50% / 50% 60% 40% 50%', opacity: 0.8 },
      { type: 'diamond', cx: 90,  cy: 38,  size: 24, color: '#fbbf24' },
      { type: 'diamond', cx: 100, cy: 53,  size: 16, color: '#f97316', opacity: 0.7 },
      { type: 'strip',   edge: 'bottom', height: 13, bg: 'linear-gradient(90deg,#f97316 0%,#ef4444 100%)' },
    ],
  },
  {
    id: 'forest', name: 'Forest', cardBg: '#ffffff', border: '#16a34a',
    shapes: [
      { type: 'blob',    cx: 5,   cy: 4,   w: 40, h: 40, color: '#16a34a', rx: '40% 60% 60% 40% / 60% 40% 60% 40%' },
      { type: 'blob',    cx: 93,  cy: 86,  w: 36, h: 36, color: '#15803d', rx: '60% 40% 40% 60% / 40% 60% 40% 60%', opacity: 0.8 },
      { type: 'diamond', cx: -2,  cy: 42,  size: 20, color: '#84cc16', opacity: 0.9 },
      { type: 'diamond', cx: 6,   cy: 55,  size: 13, color: '#4ade80', opacity: 0.6 },
      { type: 'strip',   edge: 'bottom', height: 13, bg: 'linear-gradient(90deg,#166534 0%,#16a34a 100%)' },
    ],
  },
  {
    id: 'crimson', name: 'Crimson', cardBg: '#ffffff', border: '#dc2626',
    shapes: [
      { type: 'blob',    cx: 5,   cy: 4,   w: 42, h: 42, color: '#dc2626', rx: '60% 40% 50% 50% / 60% 50% 50% 40%' },
      { type: 'blob',    cx: 93,  cy: 84,  w: 36, h: 36, color: '#b91c1c', rx: '50% 50% 40% 60% / 40% 50% 60% 50%', opacity: 0.8 },
      { type: 'diamond', cx: 91,  cy: 38,  size: 22, color: '#fb7185' },
      { type: 'diamond', cx: 100, cy: 52,  size: 15, color: '#f43f5e', opacity: 0.7 },
      { type: 'strip',   edge: 'bottom', height: 13, bg: 'linear-gradient(90deg,#b91c1c 0%,#dc2626 100%)' },
    ],
  },
  {
    id: 'midnight', name: 'Midnight', cardBg: '#1e293b', border: '#3b82f6',
    shapes: [
      { type: 'blob',    cx: 5,   cy: 4,   w: 44, h: 44, color: '#1e40af', rx: '60% 40% 50% 50% / 60% 50% 50% 40%' },
      { type: 'blob',    cx: -4,  cy: 82,  w: 36, h: 36, color: '#1d4ed8', rx: '50% 50% 40% 60% / 40% 50% 60% 50%', opacity: 0.8 },
      { type: 'diamond', cx: 91,  cy: 40,  size: 23, color: '#60a5fa', opacity: 0.9 },
      { type: 'diamond', cx: 100, cy: 54,  size: 15, color: '#93c5fd', opacity: 0.6 },
      { type: 'strip',   edge: 'bottom', height: 13, bg: 'linear-gradient(90deg,#1e40af 0%,#3b82f6 100%)' },
    ],
  },
  {
    id: 'rose-gold', name: 'Rose Gold', cardBg: '#fff5f5', border: '#e879a0',
    shapes: [
      { type: 'blob',    cx: 5,   cy: 4,   w: 40, h: 40, color: '#e879a0', rx: '70% 30% 60% 40% / 60% 40% 60% 40%' },
      { type: 'blob',    cx: 93,  cy: 86,  w: 32, h: 32, color: '#f472b6', rx: '40% 60% 50% 50% / 50% 50% 50% 50%', opacity: 0.8 },
      { type: 'diamond', cx: -2,  cy: 42,  size: 20, color: '#fbbf24', opacity: 0.85 },
      { type: 'diamond', cx: 6,   cy: 55,  size: 13, color: '#f59e0b', opacity: 0.65 },
      { type: 'strip',   edge: 'bottom', height: 13, bg: 'linear-gradient(90deg,#e879a0 0%,#fbbf24 100%)' },
    ],
  },
]

// ─── Theme Decoration Layer ───────────────────────────────────────────────────

function ThemeDecoLayer({ theme, width, height }: { theme: CardTheme; width: number; height: number }) {
  if (!theme || theme.shapes.length === 0) return null
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {theme.shapes.map((shape, i) => {
        if (shape.type === 'blob') {
          const bw = (shape.w / 100) * width
          const bh = (shape.h / 100) * width
          return (
            <div key={i} style={{
              position: 'absolute',
              left: (shape.cx / 100) * width - bw / 2,
              top: (shape.cy / 100) * height - bh / 2,
              width: bw,
              height: bh,
              background: shape.color,
              borderRadius: shape.rx,
              opacity: shape.opacity ?? 1,
            }} />
          )
        }
        if (shape.type === 'diamond') {
          const sz = (shape.size / 100) * width
          return (
            <div key={i} style={{
              position: 'absolute',
              left: (shape.cx / 100) * width - sz / 2,
              top: (shape.cy / 100) * height - sz / 2,
              width: sz,
              height: sz,
              background: shape.color,
              transform: 'rotate(45deg)',
              opacity: shape.opacity ?? 1,
            }} />
          )
        }
        if (shape.type === 'strip') {
          return (
            <div key={i} style={{
              position: 'absolute',
              left: 0, right: 0,
              ...(shape.edge === 'top' ? { top: 0 } : { bottom: 0 }),
              height: (shape.height / 100) * height,
              background: shape.bg,
            }} />
          )
        }
        return null
      })}
    </div>
  )
}

const CARD_PRESETS: { label: string; width: number; height: number; unit: Unit }[] = [
  { label: 'Portrait ID (2.125" × 3.375")', width: 2.125, height: 3.375, unit: 'in' },
  { label: 'CR80 Landscape (3.375" × 2.125")', width: 3.375, height: 2.125, unit: 'in' },
  { label: 'CR79 (3.303" × 2.051")', width: 3.303, height: 2.051, unit: 'in' },
  { label: 'Business Card (3.5" × 2")', width: 3.5, height: 2, unit: 'in' },
  { label: 'A4 Portrait (8.27" × 11.69")', width: 8.27, height: 11.69, unit: 'in' },
  { label: 'A5 Portrait (5.83" × 8.27")', width: 5.83, height: 8.27, unit: 'in' },
  { label: 'Custom', width: 0, height: 0, unit: 'in' },
]

// ─── Token Definitions ────────────────────────────────────────────────────────

const TOKENS: Record<UserType, Record<string, { label: string; category: string; isImage?: boolean; isQR?: boolean; isCustomText?: boolean }>> = {
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
    '{{custom_text}}': { label: 'Free Text Line', category: 'Decoration', isCustomText: true },
    '{{qr_code}}': { label: 'QR Code', category: 'QR Code', isQR: true },
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
    '{{custom_text}}': { label: 'Free Text Line', category: 'Decoration', isCustomText: true },
    '{{qr_code}}': { label: 'QR Code', category: 'QR Code', isQR: true },
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
    '{{custom_text}}': { label: 'Free Text Line', category: 'Decoration', isCustomText: true },
    '{{qr_code}}': { label: 'QR Code', category: 'QR Code', isQR: true },
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
    '{{custom_text}}': { label: 'Free Text Line', category: 'Decoration', isCustomText: true },
    '{{qr_code}}': { label: 'QR Code', category: 'QR Code', isQR: true },
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
    '{{custom_text}}': { label: 'Free Text Line', category: 'Decoration', isCustomText: true },
    '{{qr_code}}': { label: 'QR Code', category: 'QR Code', isQR: true },
  },
}

const USER_TYPE_META: Record<UserType, { label: string; icon: React.ReactNode; color: string }> = {
  student: { label: 'Student', icon: <GraduationCap className="h-4 w-4" />, color: 'bg-blue-500' },
  teacher: { label: 'Teacher', icon: <UserCheck className="h-4 w-4" />, color: 'bg-green-500' },
  staff: { label: 'Staff', icon: <Users className="h-4 w-4" />, color: 'bg-orange-500' },
  librarian: { label: 'Librarian', icon: <BookOpen className="h-4 w-4" />, color: 'bg-purple-500' },
  parent: { label: 'Parent', icon: <UserCircle className="h-4 w-4" />, color: 'bg-pink-500' },
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

function groupTokens(tokens: Record<string, { label: string; category: string; isImage?: boolean; isQR?: boolean; isCustomText?: boolean }>) {
  const groups: Record<string, { token: string; label: string; isImage?: boolean; isQR?: boolean; isCustomText?: boolean }[]> = {}
  for (const [token, meta] of Object.entries(tokens)) {
    if (!groups[meta.category]) groups[meta.category] = []
    groups[meta.category].push({ token, label: meta.label, isImage: meta.isImage, isQR: meta.isQR, isCustomText: meta.isCustomText })
  }
  return groups
}

// ─── Default card ─────────────────────────────────────────────────────────────

// Portrait card: 204×324px (2.125"×3.375" @ 96dpi)
// school-classic footer strip ≈ 42px. Usable height: y=0 to y=280.
// 2-col info grid: lx=8, rx=104, w=92 (4px gap, 8px side margins)
function defaultFields(): DesignField[] {
  const lx = 8, rx = 104, iw = 92
  return [
    // School logo — circular, top-center
    { id: uniqueId(), token: '{{school_logo}}', label: 'School Logo', type: 'image',
      x: 77, y: 14, width: 50, height: 50,
      fontSize: 12, fontWeight: 'normal', fontStyle: 'normal',
      color: '#000000', align: 'center', borderRadius: 25, bgColor: '#e5e7eb', opacity: 1 },
    // School name
    { id: uniqueId(), token: '{{school_name}}', label: 'School Name', type: 'text',
      x: 10, y: 68, width: 184, height: 16,
      fontSize: 11, fontWeight: 'bold', fontStyle: 'normal',
      color: '#1e3a8a', align: 'center', borderRadius: 0, bgColor: 'transparent', opacity: 1 },
    // Student photo
    { id: uniqueId(), token: '{{photo_url}}', label: 'Photo', type: 'image',
      x: 57, y: 88, width: 90, height: 82,
      fontSize: 12, fontWeight: 'normal', fontStyle: 'normal',
      color: '#000000', align: 'center', borderRadius: 6, bgColor: '#e5e7eb', opacity: 1 },
    // Full name
    { id: uniqueId(), token: '{{full_name}}', label: 'Full Name', type: 'text',
      x: 10, y: 174, width: 184, height: 20,
      fontSize: 14, fontWeight: 'bold', fontStyle: 'normal',
      color: '#111827', align: 'center', borderRadius: 0, bgColor: 'transparent', opacity: 1 },
    // Student number — orange
    { id: uniqueId(), token: '{{student_number}}', label: 'Student No.', type: 'text',
      x: 27, y: 197, width: 150, height: 15,
      fontSize: 10, fontWeight: 'bold', fontStyle: 'normal',
      color: '#f97316', align: 'center', borderRadius: 0, bgColor: 'transparent', opacity: 1 },
    // Info row 1
    { id: uniqueId(), token: '{{father_name}}', label: 'PARENT', type: 'labeled',
      x: lx, y: 216, width: iw, height: 30,
      fontSize: 11, fontWeight: 'normal', fontStyle: 'normal',
      color: '#1f2937', align: 'center', borderRadius: 6, bgColor: '#d1fae5', opacity: 1 },
    { id: uniqueId(), token: '{{date_of_birth}}', label: 'DOB', type: 'labeled',
      x: rx, y: 216, width: iw, height: 30,
      fontSize: 11, fontWeight: 'normal', fontStyle: 'normal',
      color: '#1f2937', align: 'center', borderRadius: 6, bgColor: '#d1fae5', opacity: 1 },
    // Info row 2
    { id: uniqueId(), token: '{{issue_date}}', label: 'ISSUE DATE', type: 'labeled',
      x: lx, y: 250, width: iw, height: 30,
      fontSize: 11, fontWeight: 'normal', fontStyle: 'normal',
      color: '#1f2937', align: 'center', borderRadius: 6, bgColor: '#d1fae5', opacity: 1 },
    { id: uniqueId(), token: '{{valid_until}}', label: 'VALID TILL', type: 'labeled',
      x: rx, y: 250, width: iw, height: 30,
      fontSize: 11, fontWeight: 'normal', fontStyle: 'normal',
      color: '#1f2937', align: 'center', borderRadius: 6, bgColor: '#d1fae5', opacity: 1 },
  ]
}

// ─── Field canvas element ─────────────────────────────────────────────────────

function CanvasField({
  field, scale, selected, onSelect, onDragEnd, onDelete, onReplace, availableTokens
}: {
  field: DesignField
  scale: number
  selected: boolean
  onSelect: () => void
  onDragEnd: (dx: number, dy: number) => void
  onDelete: () => void
  onReplace?: (token: string) => void
  availableTokens?: { token: string; label: string }[]
}) {
  const [hovered, setHovered] = useState(false)
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
  const isQRField = field.type === 'qrcode'

  return (
    <div
      id={`field-${field.id}`}
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: field.x * scale,
        top: field.y * scale,
        width: field.width * scale,
        height: field.height * scale,
        cursor: 'move',
        userSelect: 'none',
        zIndex: 1,
        outline: selected ? '2px solid #3b82f6' : hovered ? '1px dashed #94a3b8' : '1px dashed transparent',
        outlineOffset: 1,
        borderRadius: field.borderRadius,
        backgroundColor: field.bgColor === 'transparent' ? undefined : field.bgColor,
        opacity: field.opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          field.align === 'center' ? 'center' : field.align === 'right' ? 'flex-end' : 'flex-start',
        overflow: 'visible',
        boxSizing: 'border-box',
      }}
    >
      {/* Label dropdown on select/hover */}
      {(hovered || selected) && (
        <div 
          className="absolute -top-6 left-0 z-20"
          onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
          onMouseDown={(e) => { e.stopPropagation(); onSelect(); }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          <Select 
            value={field.token} 
            onValueChange={v => onReplace && onReplace(v)}
          >
            <SelectTrigger className="h-6 px-2 text-[10px] font-medium text-blue-600 bg-white border-blue-200 shadow-sm min-w-[80px] w-fit rounded focus:ring-0 focus:ring-offset-0 gap-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-[250px] overflow-y-auto">
              {availableTokens?.map(t => (
                <SelectItem key={t.token} value={t.token} className="text-[10px]">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Delete × button — shown on hover or when selected */}
      {(hovered || selected) && (
        <button
          onMouseDown={e => { e.stopPropagation(); onDelete() }}
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 'bold',
            lineHeight: 1,
            zIndex: 10,
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
          title="Remove field"
        >
          ×
        </button>
      )}
      {isImage ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded text-gray-400"
          style={{ fontSize: field.fontSize * scale * 0.6 }}>
          <ImageIcon style={{ width: field.height * scale * 0.4, height: field.height * scale * 0.4 }} />
        </div>
      ) : isQRField ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: field.borderRadius, padding: 4 }}>
          <QrCode style={{ width: '80%', height: '80%', color: '#374151' }} />
        </div>
      ) : field.type === 'labeled' ? (
        // Two-line label+value box (designer shows placeholder value)
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '2px 4px', boxSizing: 'border-box' }}>
          <div style={{ fontSize: field.fontSize * scale * 0.62, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {field.label}
          </div>
          <div style={{ fontSize: field.fontSize * scale * 0.85, fontWeight: field.fontWeight, color: field.color, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
            {field.token.replace(/[{}]/g, '')}
          </div>
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
  const [bgGradient, setBgGradient] = useState<string>('')
  const [bgImage, setBgImage] = useState<string>('')
  const [borderColor, setBorderColor] = useState('#10b981')
  const [cardThemeId, setCardThemeId] = useState<string>('school-classic')
  const [borderWidth, setBorderWidth] = useState(2)
  const [borderRadius, setBorderRadius] = useState(8)

  // ── Dimensions state ──
  const [unit, setUnit] = useState<Unit>('in')
  const [dims, setDims] = useState<CardDimensions>({ width: 2.125, height: 3.375, unit: 'in' })

  // ── Print state ──
  const [tab, setTab] = useState<'designer' | 'print'>('designer')
  const [printUsers, setPrintUsers] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // ── Mobile panel state (Fields | Canvas | Style) ──
  const [mobilePanel, setMobilePanel] = useState<'fields' | 'canvas' | 'style'>('canvas')
  const [printListOpen, setPrintListOpen] = useState(true)

  // ── Templates ──
  const [templateName, setTemplateName] = useState('')
  const [savedTemplates, setSavedTemplates] = useState<{ name: string; userType: UserType; fields: DesignField[]; bgColor: string; bgGradient: string; borderColor: string; cardThemeId: string; borderWidth: number; borderRadius: number; dims: CardDimensions }[]>(() => {
    try { return JSON.parse(localStorage.getItem('id_card_templates') ?? '[]') } catch { return [] }
  })

  // ── Canvas auto-scale based on container width ──
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(0)
  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setContainerW(entries[0]?.contentRect.width ?? 0))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id
  const schoolName = campusCtx?.selectedCampus?.name ?? ''
  const schoolLogo = campusCtx?.selectedCampus?.logo_url ?? ''

  const todayStr  = new Date().toLocaleDateString('en-GB').replace(/\//g, '-')
  const validTillStr = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                        .toLocaleDateString('en-GB').replace(/\//g, '-')

  // Resolve a token to its real value from a user object
  const resolveToken = (token: string, u: any): string => {
    const p = (key: string) =>
      u[key] ?? u.profile?.[key] ?? u.medical_info?.[key] ?? ''
    switch (token) {
      case '{{school_name}}':       return schoolName
      case '{{full_name}}':         return `${p('first_name')} ${p('last_name')}`.trim()
      case '{{first_name}}':        return p('first_name')
      case '{{last_name}}':         return p('last_name')
      case '{{email}}':             return p('email')
      case '{{phone}}':             return p('phone')
      case '{{student_number}}':    return u.student_number ?? ''
      case '{{student_id}}':        return u.student_number ?? ''
      case '{{employee_id}}':
      case '{{employee_number}}':   return u.employee_number ?? ''
      case '{{grade_level}}':       return u.grade_level?.name ?? u.grade_level ?? ''
      case '{{section}}':           return u.section?.name ?? u.section ?? ''
      case '{{academic_year}}':     return u.academic_year?.name ?? u.academic_year ?? ''
      case '{{father_name}}':       return p('father_name')
      case '{{grandfather_name}}':  return p('grandfather_name')
      case '{{mother_name}}':       return p('mother_name')
      case '{{date_of_birth}}':     return p('date_of_birth') || p('dob')
      case '{{blood_group}}':       return p('blood_group')
      case '{{gender}}':            return p('gender')
      case '{{address}}':           return p('address')
      case '{{cnic}}':              return p('cnic')
      case '{{designation}}':       return u.title ?? u.designation ?? p('designation')
      case '{{department}}':        return u.department ?? p('department')
      case '{{occupation}}':        return p('occupation')
      case '{{workplace}}':         return p('workplace')
      case '{{issue_date}}':        return todayStr
      case '{{valid_until}}':       return validTillStr
      case '{{emergency_contact}}': return p('emergency_contact')
      case '{{parent_phone}}':      return p('parent_phone')
      case '{{children_names}}':    return p('children_names')
      case '{{children_grades}}':   return p('children_grades')
      case '{{qr_code}}':           return u.student_number ?? u.employee_number ?? u.id ?? ''
      default:                      return ''
    }
  }

  // Resolve image token to a URL
  const resolveImage = (token: string, u: any): string | null => {
    if (token === '{{school_logo}}') return schoolLogo || null
    return u.avatar_url
      ?? u.profile_photo_url
      ?? u.profile?.avatar_url
      ?? u.profile?.profile_photo_url
      ?? u.medical_info?.avatar_url
      ?? u.medical_info?.profile_photo_url
      ?? null
  }

  const canvasRef = useRef<HTMLDivElement>(null)
  const printAreaRef = useRef<HTMLDivElement>(null)

  // computed card pixel dimensions
  const cardWidthPx = cardPx(dims.width, dims.unit)
  const cardHeightPx = cardPx(dims.height, dims.unit)
  const scale = CANVAS_SCALE

  // Shrink canvas to fit container width on small screens (leave 32px padding each side)
  const displayScale = containerW > 0 && cardWidthPx * scale > containerW - 32
    ? (containerW - 32) / cardWidthPx
    : scale

  const selectedField = fields.find(f => f.id === selectedId) ?? null

  // ── User type change → reset fields to sensible defaults ──
  const handleUserTypeChange = (type: UserType) => {
    setUserType(type)
    setSelectedId(null)
    // Keep existing layout, just clear fields that don't make sense
    setFields(defaultFields())
  }

  const activeTheme = CARD_THEMES.find(t => t.id === cardThemeId) ?? CARD_THEMES[0]

  const applyCardTheme = (theme: CardTheme) => {
    setCardThemeId(theme.id)
    setBgColor(theme.cardBg)
    setBorderColor(theme.border)
    setBgGradient('')
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
    const isQR = meta?.isQR ?? false
    const isCustomText = meta?.isCustomText ?? false
    // Info-box style for tokens that carry data values (not name/logo/school text)
    const plainCategories = ['Basic', 'School', 'Decoration']
    const isLabeled = !isImage && !isQR && !isCustomText && !plainCategories.includes(meta?.category ?? '')

    const fw = isImage ? 60 : isQR ? 56 : 92
    const fh = isImage ? 70 : isQR ? 56 : isLabeled ? 30 : 22

    let bestX = Math.round((cardWidthPx - fw) / 2)
    let bestY = fields.reduce((m, f) => Math.max(m, f.y + f.height), 0)
    bestY = Math.max(10, Math.min(bestY + 6, cardHeightPx - fh - 8))

    // QR code: always place at card center — skip column-pairing logic
    if (isQR) {
      bestX = Math.round((cardWidthPx - fw) / 2)
      bestY = Math.round((cardHeightPx - fh) / 2)
    }

    if (!isQR) {
      // Smart placement: for half-width labeled fields, try to fill an empty column slot
      const halfW = cardWidthPx / 2
      const colL = 8
      const colR = Math.round(halfW + 2)
      const isHalfWidth = fw <= halfW - 4

      if (isHalfWidth) {
        const rows: { y: number; fields: DesignField[] }[] = []
        for (const f of fields) {
          const row = rows.find(r => Math.abs(r.y - f.y) <= 8)
          if (row) row.fields.push(f)
          else rows.push({ y: f.y, fields: [f] })
        }
        const candidateRow = [...rows].reverse().find(row => {
          const halfFields = row.fields.filter(f => f.width <= halfW - 4)
          if (halfFields.length !== 1) return false
          const f = halfFields[0]
          const onLeft  = f.x < halfW
          const oppX = onLeft ? colR : colL
          return !row.fields.some(f2 => Math.abs(f2.x - oppX) < 20 && f2.id !== f.id)
        })

        if (candidateRow) {
          const occupiedField = candidateRow.fields.find(f => f.width <= halfW - 4)!
          const onLeft = occupiedField.x < halfW
          bestX = onLeft ? colR : colL
          bestY = candidateRow.y
        } else {
          bestX = colL
        }
      }
    }

    const newField: DesignField = {
      id: uniqueId(),
      token,
      label: isCustomText ? 'Your Text Here' : (meta?.label ?? token),
      type: isImage ? 'image' : isQR ? 'qrcode' : isLabeled ? 'labeled' : 'text',
      x: bestX,
      y: bestY,
      width: fw,
      height: fh,
      fontSize: isImage ? 12 : 11,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#1f2937',
      align: 'center',
      borderRadius: isImage ? 4 : isQR ? 4 : isLabeled ? 6 : 0,
      bgColor: isLabeled ? '#d1fae5' : 'transparent',
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

  const updateFieldBatch = (patch: Partial<DesignField>) => {
    if (!selectedId) return
    setFields(prev => prev.map(f => f.id === selectedId ? { ...f, ...patch } : f))
  }

  // ── Delete selected ──
  const deleteField = () => {
    if (!selectedId) return
    setFields(prev => prev.filter(f => f.id !== selectedId))
    setSelectedId(null)
  }

  // ── Template save / load ──
  const saveTemplate = () => {
    const name = templateName.trim()
    if (!name) { toast.error('Enter a template name first'); return }
    const tpl = { name, userType, fields, bgColor, bgGradient, borderColor, cardThemeId, borderWidth, borderRadius, dims }
    setSavedTemplates(prev => {
      const updated = prev.filter(t => t.name !== name).concat(tpl)
      localStorage.setItem('id_card_templates', JSON.stringify(updated))
      return updated
    })
    toast.success(`Template "${name}" saved`)
  }

  const loadTemplate = (name: string) => {
    const tpl = savedTemplates.find(t => t.name === name)
    if (!tpl) return
    setUserType(tpl.userType)
    setFields(tpl.fields)
    setBgColor(tpl.bgColor)
    setBgGradient(tpl.bgGradient)
    setBorderColor(tpl.borderColor)
    setCardThemeId(tpl.cardThemeId)
    setBorderWidth(tpl.borderWidth)
    setBorderRadius(tpl.borderRadius)
    setDims(tpl.dims)
    setSelectedId(null)
    toast.success(`Template "${name}" loaded`)
  }

  const deleteTemplate = (name: string) => {
    setSavedTemplates(prev => {
      const updated = prev.filter(t => t.name !== name)
      localStorage.setItem('id_card_templates', JSON.stringify(updated))
      return updated
    })
    toast.success(`Template "${name}" deleted`)
  }

  // ── Load users for print ──
  // Handles three response shapes coming from different API helpers:
  //   getAllTeachers  → simpleFetch → returns result.data = { data: Staff[], total, ... }
  //   getAllStaff     → apiRequest  → returns { success, data: { data: Staff[], total, ... } }
  //   getStudents     → apiRequest  → returns { success, data: Student[], students: [] }
  const extractUsers = (res: any): any[] => {
    if (Array.isArray(res)) return res                       // plain array
    if (Array.isArray(res?.data?.data)) return res.data.data // apiRequest shape (staff/students wrapped)
    if (Array.isArray(res?.data)) return res.data            // simpleFetch shape (teachers)
    if (Array.isArray(res?.students)) return res.students    // legacy student shape
    if (Array.isArray(res?.teachers)) return res.teachers    // legacy teacher shape
    if (Array.isArray(res?.staff)) return res.staff          // legacy staff shape
    console.warn('[ID Card] Unrecognised response shape — keys:', res ? Object.keys(res) : res)
    return []
  }

  useEffect(() => {
    if (tab !== 'print') return
    setLoadingUsers(true)
    setPrintUsers([])

    const load = async () => {
      console.debug('[ID Card] Fetching — type:', userType, '| campusId:', campusId ?? '(none)')
      try {
        let res: any

        if (userType === 'student') {
          const params: any = { limit: 500 }
          if (campusId) params.campus_id = campusId
          console.debug('[ID Card] getStudents params:', params)
          res = await getStudents(params)

        } else if (userType === 'teacher') {
          const params: any = { limit: 500 }
          if (campusId) params.campus_id = campusId
          console.debug('[ID Card] getAllTeachers params:', params)
          res = await getAllTeachers(params)

        } else if (userType === 'staff' || userType === 'librarian') {
          const role = userType === 'librarian' ? 'librarian' : 'staff'
          console.debug('[ID Card] getAllStaff params — role:', role, '| campusId:', campusId ?? '(none)')
          res = await getAllStaff(1, 500, undefined, role as any, campusId)

        } else if (userType === 'parent') {
          console.debug('[ID Card] getParents params: limit 500')
          res = await getParents({ limit: 500 })
        }

        console.debug('[ID Card] Raw response:', res)
        const users = extractUsers(res)
        console.debug('[ID Card] Extracted', users.length, 'users | first:', users[0] ?? null)
        setPrintUsers(users)
      } catch (err) {
        console.error('[ID Card] Failed to load users:', err)
        toast.error('Failed to load users')
      } finally {
        setLoadingUsers(false)
      }
    }
    load()
  }, [tab, userType, campusId])

  // Normalise: students have first_name at root; teachers/staff have it inside profile
  const resolveUserName = (u: any) =>
    `${u.first_name ?? u.profile?.first_name ?? ''} ${u.last_name ?? u.profile?.last_name ?? ''}`.trim()

  const filteredUsers = printUsers.filter(u => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    const name = resolveUserName(u).toLowerCase()
    const number = (u.student_number ?? u.employee_number ?? '').toLowerCase()
    return name.includes(q) || number.includes(q)
  })

  // ── Export to PDF — capture each rendered card in the print tab ──
  const exportPDF = async () => {
    if (selectedUsers.size === 0) {
      toast.warning('Go to the Print tab, select users, then export.')
      setTab('print')
      return
    }
    if (tab !== 'print') {
      setTab('print')
      toast.info('Switched to Print tab — click Export PDF again once cards appear.')
      return
    }

    const cardEls = printAreaRef.current?.querySelectorAll<HTMLElement>('[data-print-card]')
    if (!cardEls || cardEls.length === 0) {
      toast.error('No card previews found. Try re-selecting users.')
      return
    }

    toast.info(`Generating PDF for ${cardEls.length} card(s)…`)
    try {
      const wIn = cardWidthPx / PX_PER_INCH
      const hIn = cardHeightPx / PX_PER_INCH
      const pdf = new jsPDF({
        orientation: wIn > hIn ? 'landscape' : 'portrait',
        unit: 'in',
        format: [wIn, hIn],
      })

      // html2canvas can't parse modern CSS color functions (oklch/lab) used by Tailwind.
      // The card divs use only inline styles, so stripping external sheets is safe.
      const stripTailwindColors = (clonedDoc: Document) => {
        let fontFaces = '';
        try {
          for (let i = 0; i < document.styleSheets.length; i++) {
            const sheet = document.styleSheets[i];
            try {
              for (let j = 0; j < sheet.cssRules.length; j++) {
                if (sheet.cssRules[j].type === CSSRule.FONT_FACE_RULE) {
                  fontFaces += sheet.cssRules[j].cssText + '\n';
                }
              }
            } catch (e) { /* ignore cors */ }
          }
        } catch (e) {}

        const computedFont = window.getComputedStyle(document.body).fontFamily;

        clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.remove())
        clonedDoc.querySelectorAll('style').forEach(el => {
          if (el.textContent?.includes('oklch') || el.textContent?.includes('lab(')) el.remove()
        })

        const style = clonedDoc.createElement('style')
        style.textContent = fontFaces + `\n* { font-family: ${computedFont} !important; }`
        clonedDoc.head.appendChild(style)
      }

      for (let i = 0; i < cardEls.length; i++) {
        const c = await html2canvas(cardEls[i], {
          scale: 3, useCORS: true, allowTaint: true, logging: false,
          width: cardEls[i].offsetWidth, height: cardEls[i].offsetHeight,
          onclone: (clonedDoc) => stripTailwindColors(clonedDoc),
        })
        if (i > 0) pdf.addPage([wIn, hIn])
        pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, wIn, hIn)
      }

      pdf.save('id-cards.pdf')
      toast.success(`PDF exported — ${cardEls.length} card(s)!`)
    } catch (err) {
      console.error(err)
      toast.error('PDF export failed')
    }
  }

  // ── Print — opens browser print dialog targeting only the card area ──
  const handlePrint = () => {
    if (selectedUsers.size === 0) {
      toast.warning('Select at least one user from the Print tab first.')
      setTab('print')
      return
    }
    if (tab !== 'print') {
      setTab('print')
      toast.info('Switched to Print tab — click Print again once cards appear.')
      return
    }
    window.print()
  }

  const groups = groupTokens(TOKENS[userType])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b bg-background px-3 py-2 gap-2 print:hidden flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <CreditCard className="h-4 w-4 text-primary shrink-0" />
          <h1 className="text-sm font-semibold whitespace-nowrap">ID Card Designer</h1>
          <Badge variant="secondary" className="text-[10px] hidden sm:flex shrink-0">
            {cardPx(dims.width, dims.unit).toFixed(0)}×{cardPx(dims.height, dims.unit).toFixed(0)} px
            &nbsp;·&nbsp;{dims.width.toFixed(2)}{dims.unit} × {dims.height.toFixed(2)}{dims.unit}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* User type selector */}
          <Select value={userType} onValueChange={v => handleUserTypeChange(v as UserType)}>
            <SelectTrigger className="w-28 sm:w-36 h-8 text-xs">
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
            <Button size="sm" variant={tab === 'designer' ? 'default' : 'ghost'}
              className="rounded-none h-8 px-2 sm:px-3 text-xs"
              onClick={() => setTab('designer')}>
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Designer</span>
            </Button>
            <Button size="sm" variant={tab === 'print' ? 'default' : 'ghost'}
              className="rounded-none h-8 px-2 sm:px-3 text-xs"
              onClick={() => setTab('print')}>
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline ml-1">Print</span>
            </Button>
          </div>

          <Button size="sm" variant="outline" className="h-8 px-2 sm:px-3 text-xs gap-1" onClick={exportPDF}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
          <Button size="sm" className="h-8 px-2 sm:px-3 text-xs gap-1" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

      {/* ── Designer Tab ── */}
      {tab === 'designer' && (
        <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Left: Fields Panel ── */}
          <div className={`${mobilePanel === 'fields' ? 'flex' : 'hidden'} lg:flex w-full lg:w-52 border-r bg-background flex-col print:hidden`}>
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
                      {tokens.map(({ token, label, isImage, isQR, isCustomText }) => (
                        <button
                          key={token}
                          onClick={() => addField(token)}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary flex items-center gap-1.5 transition-colors"
                        >
                          {isImage ? <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" /> : isQR ? <QrCode className="h-3 w-3 shrink-0 text-muted-foreground" /> : isCustomText ? <FileText className="h-3 w-3 shrink-0 text-muted-foreground" /> : <Type className="h-3 w-3 shrink-0 text-muted-foreground" />}
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
          <div ref={canvasContainerRef} className={`${mobilePanel === 'canvas' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col items-center justify-center bg-muted/50 overflow-auto p-4 lg:p-8 print:p-0`}>
            <div
              onClick={() => setSelectedId(null)}
              style={{
                position: 'relative',
                width: cardWidthPx * displayScale,
                height: cardHeightPx * displayScale,
                background: bgGradient
                  ? bgGradient
                  : bgImage
                    ? `url(${bgImage}) center / cover no-repeat`
                    : bgColor,
                border: `${borderWidth}px solid ${borderColor}`,
                borderRadius: borderRadius,
                boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                cursor: 'default',
                overflow: 'visible',
              }}
              ref={canvasRef}
            >
              {/* Clip layer keeps theme decorations inside card boundary */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: borderRadius, overflow: 'hidden', pointerEvents: 'none' }}>
                <ThemeDecoLayer theme={activeTheme} width={cardWidthPx * displayScale} height={cardHeightPx * displayScale} />
              </div>
              {fields.map(field => {
                const available = Object.entries(TOKENS[userType])
                  .filter(([_, meta]) => {
                    if (field.type === 'image') return meta.isImage ?? false
                    if (field.type === 'qrcode') return meta.isQR ?? false
                    return !(meta.isImage ?? false) && !(meta.isQR ?? false)
                  })
                  .map(([token, meta]) => ({ token, label: meta.label }))

                return (
                  <CanvasField
                    key={field.id}
                    field={field}
                    scale={displayScale}
                    selected={selectedId === field.id}
                    onSelect={() => setSelectedId(field.id)}
                    onDragEnd={(dx, dy) => handleDragEnd(field.id, dx, dy)}
                    onDelete={() => {
                      setFields(prev => prev.filter(f => f.id !== field.id))
                      setSelectedId(null)
                    }}
                    onReplace={(token) => {
                      const meta = TOKENS[userType][token]
                      if (meta) {
                        const newLabel = meta.isCustomText ? 'Your Text Here' : meta.label
                        setFields(prev => prev.map(f => f.id === field.id ? { ...f, token, label: newLabel } : f))
                      }
                    }}
                    availableTokens={available}
                  />
                )
              })}

            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Click a field to select · Drag to reposition · Use right panel to style
            </p>
          </div>

          {/* ── Right: Properties Panel ── */}
          <div className={`${mobilePanel === 'style' ? 'flex' : 'hidden'} lg:flex w-full lg:w-64 border-l bg-background flex-col print:hidden overflow-hidden`}>
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

                {/* Card Templates */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Palette className="h-3 w-3" /> Card Template
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {CARD_THEMES.map(theme => (
                      <button
                        key={theme.id}
                        title={theme.name}
                        onClick={() => applyCardTheme(theme)}
                        className={`relative overflow-hidden rounded-lg border-2 transition-all hover:scale-105 flex flex-col items-center gap-1 pb-1 ${
                          cardThemeId === theme.id
                            ? 'border-primary ring-1 ring-primary'
                            : 'border-muted hover:border-muted-foreground/50'
                        }`}
                      >
                        {/* Mini card preview */}
                        <div
                          className="relative overflow-hidden w-full"
                          style={{ aspectRatio: '85/54', background: theme.cardBg }}
                        >
                          <ThemeDecoLayer theme={theme} width={80} height={50} />
                        </div>
                        <span className="text-[9px] text-muted-foreground leading-none px-1 truncate w-full text-center">
                          {theme.name}
                        </span>
                      </button>
                    ))}
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
                      <input type="color" value={bgColor}
                        onChange={e => { setBgColor(e.target.value); setBgGradient('') }}
                        className="h-7 w-10 rounded border cursor-pointer p-0.5" />
                      <Input value={bgColor}
                        onChange={e => { setBgColor(e.target.value); setBgGradient('') }}
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
                      <Input value={bgImage} onChange={e => { setBgImage(e.target.value); if (e.target.value) setBgGradient('') }}
                        placeholder="https://..." className="h-7 text-xs mt-0.5" />
                    </div>

                    {/* Gradient Themes */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-[10px]">Gradient Themes</Label>
                        {bgGradient && (
                          <button
                            onClick={() => setBgGradient('')}
                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {GRADIENT_PRESETS.map(preset => (
                          <button
                            key={preset.name}
                            title={preset.name}
                            onClick={() => {
                              setBgGradient(preset.gradient)
                              setBorderColor(preset.border)
                              setBgImage('')
                            }}
                            className={`relative h-8 w-full rounded-md border-2 transition-all hover:scale-110 ${
                              bgGradient === preset.gradient
                                ? 'border-primary ring-1 ring-primary scale-110'
                                : 'border-transparent hover:border-muted-foreground/50'
                            }`}
                            style={{ background: preset.gradient }}
                          />
                        ))}
                      </div>
                      {bgGradient && (
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                          {GRADIENT_PRESETS.find(p => p.gradient === bgGradient)?.name ?? 'Custom'}
                        </p>
                      )}
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
                      {/* Data Source (Token replacement) */}
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] w-16 shrink-0">Data Source</Label>
                        <Select
                          value={selectedField.token}
                          onValueChange={v => {
                            const meta = TOKENS[userType][v]
                            if (meta) updateFieldBatch({ token: v, label: meta.isCustomText ? 'Your Text Here' : meta.label })
                          }}
                        >
                          <SelectTrigger className="flex-1 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TOKENS[userType])
                              .filter(([_, meta]) => {
                                if (selectedField.type === 'image') return meta.isImage ?? false
                                if (selectedField.type === 'qrcode') return meta.isQR ?? false
                                return !(meta.isImage ?? false) && !(meta.isQR ?? false)
                              })
                              .map(([token, meta]) => (
                                <SelectItem key={token} value={token} className="text-xs">
                                  <span className="text-muted-foreground text-[9px] mr-1">[{meta.category}]</span> {meta.label}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Free text content editor — only for custom_text fields */}
                      {selectedField.token === '{{custom_text}}' && (
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] w-16 shrink-0">Text</Label>
                          <Input
                            value={selectedField.label}
                            onChange={e => updateField('label', e.target.value)}
                            placeholder="Type your text…"
                            className="h-7 text-xs flex-1"
                          />
                        </div>
                      )}

                      {/* Display style toggle (text vs labeled info box) */}
                      {selectedField.type !== 'image' && selectedField.type !== 'shape' && selectedField.type !== 'qrcode' && selectedField.token !== '{{custom_text}}' && (
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px] w-16 shrink-0">Display</Label>
                          <div className="flex gap-1 flex-1">
                            <button
                              onClick={() => updateField('type', 'text')}
                              className={`flex-1 h-7 text-[10px] rounded border transition-colors ${selectedField.type === 'text' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            >Text</button>
                            <button
                              onClick={() => updateFieldBatch({
                                type: 'labeled',
                                bgColor: selectedField.bgColor === 'transparent' ? '#d1fae5' : selectedField.bgColor,
                                borderRadius: selectedField.borderRadius === 0 ? 6 : selectedField.borderRadius,
                                height: selectedField.height < 28 ? 30 : selectedField.height,
                              })}
                              className={`flex-1 h-7 text-[10px] rounded border transition-colors ${selectedField.type === 'labeled' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                            >Info Box</button>
                          </div>
                        </div>
                      )}

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

                      {(selectedField.type === 'text' || selectedField.type === 'labeled') && (
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
                          {selectedField.type === 'text' && (
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
                          )}
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
                        {f.type === 'image' ? <ImageIcon className="h-3 w-3 shrink-0" /> : f.type === 'qrcode' ? <QrCode className="h-3 w-3 shrink-0" /> : <Type className="h-3 w-3 shrink-0" />}
                        <span className="truncate">{f.label}</span>
                        <span className="ml-auto text-[9px] text-muted-foreground font-mono truncate">{f.token.replace(/[{}]/g, '')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Templates */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Templates
                  </p>
                  <div className="flex gap-1 mb-2">
                    <Input
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      placeholder="Template name…"
                      className="h-7 text-xs flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0" onClick={saveTemplate}>
                      Save
                    </Button>
                  </div>
                  {savedTemplates.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground px-1">No templates saved yet</p>
                  ) : (
                    <div className="space-y-0.5">
                      {savedTemplates.map(t => (
                        <div key={t.name} className="flex items-center gap-1 px-1">
                          <button
                            onClick={() => loadTemplate(t.name)}
                            className="flex-1 text-left text-xs py-1 hover:text-primary truncate"
                          >
                            {t.name}
                            <span className="ml-1 text-[9px] text-muted-foreground">({USER_TYPE_META[t.userType]?.label})</span>
                          </button>
                          <button
                            onClick={() => deleteTemplate(t.name)}
                            className="text-destructive hover:text-destructive/80 p-0.5 shrink-0"
                            title="Delete template"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </ScrollArea>
          </div>
        </div>{/* end 3-col row */}

        {/* ── Mobile bottom tab bar (lg and above: hidden) ── */}
        <div className="lg:hidden flex border-t bg-background shrink-0 print:hidden">
          {([
            { id: 'fields',  icon: <Type className="h-4 w-4" />,       label: 'Fields'  },
            { id: 'canvas',  icon: <CreditCard className="h-4 w-4" />, label: 'Canvas'  },
            { id: 'style',   icon: <Palette className="h-4 w-4" />,    label: 'Style'   },
          ] as const).map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setMobilePanel(id)}
              className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors ${
                mobilePanel === id ? 'text-primary border-t-2 border-primary -mt-px' : 'text-muted-foreground'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        </div>
      )}

      {/* ── Print Tab ── */}
      {tab === 'print' && (
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden print:block">
          {/* Mobile toggle bar for user list */}
          <button
            className="lg:hidden flex items-center justify-between px-4 py-2 border-b bg-background text-xs font-semibold print:hidden"
            onClick={() => setPrintListOpen(v => !v)}
          >
            <span>Select {USER_TYPE_META[userType].label}s ({selectedUsers.size} selected)</span>
            <span>{printListOpen ? '▲' : '▼'}</span>
          </button>

          {/* Left: user list — collapsible on mobile */}
          <div className={`${printListOpen ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 border-b lg:border-b-0 lg:border-r bg-background flex-col print:hidden max-h-56 lg:max-h-none`}>
            <div className="p-3 border-b space-y-2">
              <p className="text-xs font-semibold hidden lg:block">
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
                    const name = resolveUserName(u)
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
          <div id="id-card-print-area" className="flex-1 bg-muted/40 overflow-auto p-3 lg:p-6 print:p-0" ref={printAreaRef}>
            {selectedUsers.size === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <CreditCard className="h-12 w-12 opacity-20" />
                <p className="text-sm">Select users from the left to preview cards</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 justify-center print:gap-4 min-w-max lg:min-w-0">
                {filteredUsers.filter((u: any) => selectedUsers.has(u.id)).map((u: any) => {
                  const name = `${u.first_name ?? u.profile?.first_name ?? ''} ${u.last_name ?? u.profile?.last_name ?? ''}`.trim()
                  // Use scale=2 for print quality; on mobile the container is narrower but cards are still scrollable
                  const printScale = 2
                  return (
                    <div
                      key={u.id}
                      data-print-card
                      style={{
                        position: 'relative',
                        width: cardWidthPx * printScale,
                        height: cardHeightPx * printScale,
                        background: bgGradient
                          ? bgGradient
                          : bgImage
                            ? `url(${bgImage}) center / cover no-repeat`
                            : bgColor,
                        border: `${borderWidth}px solid ${borderColor}`,
                        borderRadius: borderRadius,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                    >
                      <ThemeDecoLayer theme={activeTheme} width={cardWidthPx * 2} height={cardHeightPx * 2} />
                      {fields.map(field => {
                        const isImage = field.type === 'image'
                        const isLabeled = field.type === 'labeled'
                        const isQRField = field.type === 'qrcode'
                        const printScale = 2
                        const boxStyle: React.CSSProperties = {
                          position: 'absolute',
                          left: field.x * printScale,
                          top: field.y * printScale,
                          width: field.width * printScale,
                          height: field.height * printScale,
                          backgroundColor: field.bgColor === 'transparent' ? undefined : field.bgColor,
                          borderRadius: field.borderRadius,
                          opacity: field.opacity,
                          overflow: 'visible',
                          boxSizing: 'border-box',
                          zIndex: 1,
                        }

                        // ── QR code type ──
                        if (isQRField) {
                          const qrValue = resolveToken(field.token, u) || u.id || 'N/A'
                          const qrSize = Math.min(field.width * printScale, field.height * printScale) - 8
                          return (
                            <div key={field.id} style={{ ...boxStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', padding: 4, overflow: 'hidden' }}>
                              <QRCode value={qrValue} size={qrSize} bgColor="#ffffff" fgColor="#000000" />
                            </div>
                          )
                        }

                        // ── labeled type: header + value two-line box ──
                        if (isLabeled) {
                          return (
                            <div key={field.id} style={{ ...boxStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '3px 6px', boxSizing: 'border-box' }}>
                              <div style={{ fontSize: field.fontSize * printScale * 0.62, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1, whiteSpace: 'nowrap' }}>
                                {field.label}
                              </div>
                              <div style={{ fontSize: field.fontSize * printScale * 0.85, fontWeight: field.fontWeight, color: field.color, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'visible', maxWidth: '100%' }}>
                                {resolveToken(field.token, u)}
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div key={field.id} style={{
                            ...boxStyle,
                            fontSize: field.fontSize * printScale,
                            fontWeight: field.fontWeight,
                            fontStyle: field.fontStyle,
                            color: field.color,
                            textAlign: field.align,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: field.align === 'center' ? 'center' : field.align === 'right' ? 'flex-end' : 'flex-start',
                            lineHeight: 1.2,
                          }}>
                            {isImage ? (
                              (() => {
                                const imgSrc = resolveImage(field.token, u)
                                return imgSrc ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={imgSrc} alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: field.borderRadius }} />
                                ) : (
                                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 rounded">
                                    <UserCircle style={{ width: field.height * printScale * 0.6, height: field.height * printScale * 0.6 }} />
                                  </div>
                                )
                              })()
                            ) : (
                              <span style={{ width: '100%', whiteSpace: 'nowrap', overflow: 'visible' }}>
                                {field.token === '{{custom_text}}' ? field.label : resolveToken(field.token, u)}
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
          @page { margin: 0.3in; size: auto; }
          body * { visibility: hidden !important; }
          #id-card-print-area,
          #id-card-print-area * { visibility: visible !important; }
          #id-card-print-area {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100vw !important;
            background: white !important;
            padding: 0.3in !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 0.2in !important;
            justify-content: center !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  )
}
