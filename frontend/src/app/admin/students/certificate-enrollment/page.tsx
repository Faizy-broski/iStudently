'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useCampus } from '@/context/CampusContext'
import { useGradeLevels, useSections } from '@/hooks/useAcademics'
import { getStudents, Student } from '@/lib/api/students'
import { getAllTeachers } from '@/lib/api/teachers'
import { getAllStaff } from '@/lib/api/staff'
import {
  getTemplates,
  CertificateTemplate,
  CertificateRecipientType,
} from '@/lib/api/certificate-template'
import { CertificateCanvasRenderer } from '@/components/shared/CertificateCanvasRenderer'
import { MultiSelectPopover } from '@/components/shared/MultiSelectPopover'
import {
  buildStudentCertificateData,
  buildStaffCertificateData,
  renderCertificatePageHtml,
} from '@/lib/utils/certificateRender'
import { openPrintPreview, openPdfDownload } from '@/lib/utils/printLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Award,
  Search,
  Loader2,
  Printer,
  Download,
  UserCircle,
  Users,
  Briefcase,
  Settings,
  CheckSquare,
  Square,
} from 'lucide-react'
import { toast } from 'sonner'

const OCCASION_LABELS: Record<string, string> = {
  general: 'General',
  achievement: 'Achievement',
  appreciation: 'Appreciation',
  completion: 'Completion',
  graduation: 'Graduation',
  employee_of_month: 'Employee of the Month',
  sports_day: 'Sports Day',
  custom: 'Custom',
}

export default function CertificateGeneratorPage() {
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [recipientType, setRecipientType] = useState<CertificateRecipientType>('student')

  // Templates
  const [templates, setTemplates] = useState<CertificateTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [occasionFilter, setOccasionFilter] = useState('all')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  // Student filters
  const { gradeLevels } = useGradeLevels()
  const { sections } = useSections()
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([])
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([])
  const [gradePopoverOpen, setGradePopoverOpen] = useState(false)
  const [sectionPopoverOpen, setSectionPopoverOpen] = useState(false)

  // Recipients
  const [searchQuery, setSearchQuery] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [staffMembers, setStaffMembers] = useState<any[]>([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([])

  const [isPrinting, setIsPrinting] = useState(false)

  // ── Load templates for the active recipient type ──────────────────────────
  useEffect(() => {
    setSelectedTemplateId(null)
    const load = async () => {
      setLoadingTemplates(true)
      try {
        const res = await getTemplates(recipientType)
        setTemplates(res.templates || [])
      } catch (e: any) {
        toast.error(e.message || 'Failed to load certificate templates')
      } finally {
        setLoadingTemplates(false)
      }
    }
    load()
  }, [recipientType])

  // ── Load recipients ─────────────────────────────────────────────────────
  useEffect(() => {
    setSelectedRecipientIds([])
    if (recipientType === 'student') {
      const debounceTimer = setTimeout(async () => {
        setLoadingRecipients(true)
        try {
          const res = await getStudents({
            limit: 5000,
            search: searchQuery || undefined,
            grade_level: selectedGradeIds.length ? selectedGradeIds : undefined,
            campus_id: selectedCampus?.id,
          })
          if (res.success && res.data) setStudents(res.data)
          else if (res.error) toast.error(`Failed to load students: ${res.error}`)
        } catch {
          toast.error('Failed to load students')
        } finally {
          setLoadingRecipients(false)
        }
      }, 300)
      return () => clearTimeout(debounceTimer)
    } else {
      const debounceTimer = setTimeout(async () => {
        setLoadingRecipients(true)
        try {
          if (recipientType === 'teacher') {
            const res = await getAllTeachers({ limit: 2000, search: searchQuery || undefined, campus_id: selectedCampus?.id })
            setStaffMembers(res.data || [])
          } else {
            const res = await getAllStaff(1, 2000, searchQuery || undefined, 'staff', selectedCampus?.id)
            setStaffMembers(res.data || [])
          }
        } catch {
          toast.error(`Failed to load ${recipientType}s`)
        } finally {
          setLoadingRecipients(false)
        }
      }, 300)
      return () => clearTimeout(debounceTimer)
    }
  }, [recipientType, searchQuery, selectedGradeIds, selectedCampus?.id])

  // Client-side section filter (API only supports a single section_id, so filter locally for multi-select)
  const filteredStudents = useMemo(() => {
    if (!selectedSectionIds.length) return students
    return students.filter((s) => selectedSectionIds.includes((s as any).section?.id || (s as any).section_id))
  }, [students, selectedSectionIds])

  const filteredSections = useMemo(() => {
    if (!selectedGradeIds.length) return sections
    return sections.filter((s) => selectedGradeIds.includes(s.grade_level_id))
  }, [sections, selectedGradeIds])

  const recipientList = recipientType === 'student' ? filteredStudents : staffMembers

  const filteredTemplates = useMemo(
    () => templates.filter((t) => occasionFilter === 'all' || t.occasion === occasionFilter),
    [templates, occasionFilter]
  )

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null

  // ── Selection helpers ───────────────────────────────────────────────────
  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allSelected = recipientList.length > 0 && selectedRecipientIds.length === recipientList.length
  const toggleSelectAll = () => {
    setSelectedRecipientIds(allSelected ? [] : recipientList.map((r: any) => r.id))
  }

  const gradeOptions = gradeLevels.map((g) => ({ id: g.id, label: g.name }))
  const sectionOptions = filteredSections.map((s) => ({ id: s.id, label: s.name }))

  const getRecipientName = (r: any) => {
    const p = r.profile || {}
    return `${p.first_name || ''} ${p.last_name || ''}`.trim() || r.student_number || r.employee_number || 'Unnamed'
  }
  const getRecipientSubtitle = (r: any) => {
    if (recipientType === 'student') return `${r.student_number || ''} · ${r.grade_level || r.grade?.name || ''}`
    return `${r.employee_number || ''} · ${r.title || r.department || ''}`
  }

  // ── Build the certificate batch and print / download ───────────────────
  const buildBodyHtml = () => {
    if (!selectedTemplate) return ''
    const selected = recipientList.filter((r: any) => selectedRecipientIds.includes(r.id))
    return selected
      .map((r: any) => {
        const data =
          recipientType === 'student'
            ? buildStudentCertificateData(r as Student, selectedCampus)
            : buildStaffCertificateData(r, selectedCampus)
        return renderCertificatePageHtml(selectedTemplate.template_config, data)
      })
      .join('')
  }

  const validateBeforeGenerate = (): boolean => {
    if (!selectedTemplate) {
      toast.error('Please select a certificate template')
      return false
    }
    if (selectedRecipientIds.length === 0) {
      toast.error(`Please select at least one ${recipientType}`)
      return false
    }
    return true
  }

  const handlePrintPreview = () => {
    if (!validateBeforeGenerate() || !selectedTemplate) return
    setIsPrinting(true)
    try {
      const orientation = selectedTemplate.template_config.layout.orientation
      openPrintPreview({
        title: selectedTemplate.name,
        bodyHtml: `<div style="display:flex;flex-direction:column;align-items:center;">${buildBodyHtml()}</div>`,
        // The browser's print dialog defaults to portrait — without this, a landscape
        // certificate gets squeezed onto a narrower portrait page and half gets cut off.
        bodyStyles: `@page { size: A4 ${orientation}; margin: 10mm; } @media print { .print-page { page-break-after: always; } }`,
        school: {
          name: selectedCampus?.name || '',
          address: selectedCampus?.address,
          phone: selectedCampus?.phone,
          logo_url: selectedCampus?.logo_url,
        },
        pluginActive: false,
      })
    } finally {
      setIsPrinting(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!validateBeforeGenerate() || !selectedTemplate) return
    setIsPrinting(true)
    try {
      await openPdfDownload({
        title: selectedTemplate.name,
        bodyHtml: `<div style="display:flex;flex-direction:column;align-items:center;">${buildBodyHtml()}</div>`,
        bodyStyles: '',
        school: {
          name: selectedCampus?.name || '',
          address: selectedCampus?.address,
          phone: selectedCampus?.phone,
          logo_url: selectedCampus?.logo_url,
        },
        pluginActive: false,
        landscape: selectedTemplate.template_config.layout.orientation === 'landscape',
      })
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8" />
            Certificates
          </h1>
          <p className="text-muted-foreground mt-1">
            Pick a template and recipients, then print or download A4 certificates in bulk
          </p>
        </div>
        <Button variant="outline" asChild className="gap-2">
          <Link href="/admin/certificate-templates">
            <Settings className="h-4 w-4" />
            Manage Templates
          </Link>
        </Button>
      </div>

      {/* Recipient type */}
      <Tabs value={recipientType} onValueChange={(v) => setRecipientType(v as CertificateRecipientType)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="student" className="gap-2"><UserCircle className="h-4 w-4" />Students</TabsTrigger>
          <TabsTrigger value="teacher" className="gap-2"><Users className="h-4 w-4" />Teachers</TabsTrigger>
          <TabsTrigger value="staff" className="gap-2"><Briefcase className="h-4 w-4" />Staff</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template picker */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">1. Choose a Template</CardTitle>
              <Select value={occasionFilter} onValueChange={setOccasionFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="All occasions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All occasions</SelectItem>
                  {Object.entries(OCCASION_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTemplates ? (
              <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No {recipientType} templates yet.{' '}
                <Link href={`/admin/certificate-templates/builder?type=${recipientType}`} className="text-primary underline">
                  Create one
                </Link>
              </div>
            ) : (
              <ScrollArea className="h-[520px] pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`cursor-pointer rounded-lg border-2 p-2 transition-colors ${
                        selectedTemplateId === template.id ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent/50'
                      }`}
                    >
                      <div
                        className="relative rounded border overflow-hidden bg-gray-100 dark:bg-slate-900 flex items-center justify-center mb-2"
                        style={{ aspectRatio: `${template.template_config.layout.width} / ${template.template_config.layout.height}` }}
                      >
                        <CertificateCanvasRenderer
                          layout={template.template_config.layout}
                          design={template.template_config.design}
                          fields={template.template_config.fields}
                          scale={0.16}
                        />
                      </div>
                      <p className="text-sm font-medium truncate">{template.name}</p>
                      <Badge variant="outline" className="text-xs mt-1">{OCCASION_LABELS[template.occasion] ?? template.occasion}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recipient selection */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">2. Choose Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${recipientType}s...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {recipientType === 'student' && (
                <>
                  <MultiSelectPopover
                    options={gradeOptions}
                    selectedIds={selectedGradeIds}
                    onChange={setSelectedGradeIds}
                    placeholder="All grades"
                    emptyMessage="No grades found"
                    open={gradePopoverOpen}
                    onOpenChange={setGradePopoverOpen}
                    className="sm:w-56"
                  />
                  <MultiSelectPopover
                    options={sectionOptions}
                    selectedIds={selectedSectionIds}
                    onChange={setSelectedSectionIds}
                    placeholder="All sections"
                    emptyMessage="No sections found"
                    open={sectionPopoverOpen}
                    onOpenChange={setSectionPopoverOpen}
                    className="sm:w-56"
                  />
                </>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={toggleSelectAll} className="gap-2" disabled={recipientList.length === 0}>
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedRecipientIds.length} of {recipientList.length} selected
              </span>
            </div>

            <ScrollArea className="h-[420px] border rounded-lg">
              {loadingRecipients ? (
                <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
              ) : recipientList.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">No {recipientType}s found</div>
              ) : (
                <div className="divide-y">
                  {recipientList.map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 hover:bg-accent/50 cursor-pointer"
                      onClick={() => toggleRecipient(r.id)}
                    >
                      <Checkbox checked={selectedRecipientIds.includes(r.id)} onCheckedChange={() => toggleRecipient(r.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{getRecipientName(r)}</p>
                        <p className="text-xs text-muted-foreground truncate">{getRecipientSubtitle(r)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Action bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {selectedTemplate ? (
              <>
                Generating <strong>{selectedRecipientIds.length}</strong> {recipientType} certificate
                {selectedRecipientIds.length === 1 ? '' : 's'} using <strong>{selectedTemplate.name}</strong>{' '}
                (A4 {selectedTemplate.template_config.layout.orientation})
              </>
            ) : (
              'Select a template and recipients to continue'
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrintPreview} disabled={isPrinting} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Preview
            </Button>
            <Button onClick={handleDownloadPdf} disabled={isPrinting} className="gap-2">
              {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
