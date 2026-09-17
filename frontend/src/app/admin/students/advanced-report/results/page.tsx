"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, ArrowLeft, ChevronUp, ChevronDown, ArrowUpDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getFieldDefinitions, getFieldLabel as getCustomFieldLabel, getFieldOptions, CustomFieldDefinition, EntityType } from "@/lib/api/custom-fields"
import { getAuthToken } from "@/lib/api/schools"
import { API_URL } from "@/config/api"
import Link from "next/link"
import { ConfidentialFamilyStatusBadge } from "@/components/shared/ConfidentialFamilyStatusBadge"
import { getConfidentialFamilyStatusLabel } from "@/lib/constants/confidential-family-status"
import { ExportButton } from "@/components/shared/ExportButton"
import { serialNumberColumn, type ExportColumn } from "@/lib/utils/tableExport"

type ReportRole = 'student' | 'teacher' | 'staff' | 'librarian' | 'parent'

const ROLE_ENTITY_MAP: Record<ReportRole, EntityType | null> = {
  student: 'student',
  teacher: 'teacher',
  staff: 'staff',
  librarian: null,
  parent: 'parent',
}

export default function AdvancedReportResultsPage() {
  const t = useTranslations('admin.reports.advanced_report')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  const role = (searchParams.get('role') ?? 'student') as ReportRole
  const campusId     = searchParams.get('campus_id')      ?? undefined
  const gradeLevelId = searchParams.get('grade_level_id') ?? undefined
  const sectionId    = searchParams.get('section_id')     ?? undefined
  const department   = searchParams.get('department')     ?? undefined
  const userId       = searchParams.get('user_id')        ?? undefined
  const userLabel    = searchParams.get('user_label')     ?? undefined
  const hasSiblings  = searchParams.get('has_siblings')    ?? undefined

  const roleLabel = t(`roles.${role}`)

  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const fieldsParam = searchParams.get('fields')
    if (!fieldsParam) {
      toast.error(t('select_at_least_one'))
      router.push('/admin/students/advanced-report')
      return
    }
    try {
      setSelectedFields(JSON.parse(decodeURIComponent(fieldsParam)))
    } catch {
      router.push('/admin/students/advanced-report')
    }
  }, [searchParams, router])

  useEffect(() => {
    const entityType = ROLE_ENTITY_MAP[role]
    if (!entityType) return
    getFieldDefinitions(entityType, campusId)
      .then(res => { if (res.success && res.data) setCustomFields(res.data) })
      .catch(() => {})
  }, [role, campusId])

  useEffect(() => {
    if (selectedFields.length === 0) return
    const fetchData = async () => {
      setLoading(true)
      try {
        const token = await getAuthToken()
        const qs = new URLSearchParams({ page: '1', limit: '1000' })
        if (campusId)     qs.set('campus_id',      campusId)
        if (gradeLevelId) qs.set('grade_level_id', gradeLevelId)
        if (sectionId)    qs.set('section_id',     sectionId)
        if (department)   qs.set('department',     department)
        if (userId)       qs.set('user_id',        userId)
        if (hasSiblings)  qs.set('has_siblings',   hasSiblings)

        const res = await fetch(`${API_URL}/advanced-report/${role}?${qs}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
        const json = await res.json()
        if (res.ok && json.success) setRows(json.data ?? [])
        else toast.error(json.error || 'Failed to load report')
      } catch (err: any) {
        toast.error(err.message || 'Network error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedFields, role, campusId, gradeLevelId, sectionId, department, userId, hasSiblings])

  const customFieldLabelMap = useMemo(() =>
    Object.fromEntries(customFields.map(f => [`custom_${f.field_key}`, getCustomFieldLabel(f, locale)])),
    [customFields, locale]
  )

  // Options are stored/keyed by their original English value, so translating a
  // select/multi-select custom field's displayed value needs its options_ar lookup —
  // the label alone being translated still left e.g. a nationality dropdown's actual
  // value showing in English.
  const customFieldOptionsMap = useMemo(() =>
    Object.fromEntries(
      customFields
        .filter(f => f.type === 'select' || f.type === 'multi-select')
        .map(f => [`custom_${f.field_key}`, getFieldOptions(f, locale)])
    ),
    [customFields, locale]
  )

  const getFieldLabel = (fieldId: string) => {
    if (fieldId.startsWith('custom_')) return customFieldLabelMap[fieldId] ?? fieldId.replace('custom_', '')
    // Use translation if available, fallback to formatted key
    try { return t(`fields.${fieldId}`) } catch { return fieldId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
  }

  const getRawValue = (row: any, fieldId: string) => {
    if (fieldId.startsWith('custom_')) return row.custom_fields?.[fieldId.replace('custom_', '')] ?? ''
    return row[fieldId] ?? ''
  }

  const translateCustomValue = (fieldId: string, value: any): string => {
    const options = customFieldOptionsMap[fieldId]
    if (!options) return String(value)
    if (Array.isArray(value)) return value.map(v => options.find(o => o.value === v)?.label ?? v).join(', ')
    return options.find(o => o.value === value)?.label ?? String(value)
  }

  const getDisplayValue = (row: any, fieldId: string) => {
    if (fieldId.startsWith('custom_')) {
      const val = row.custom_fields?.[fieldId.replace('custom_', '')]
      return val != null ? translateCustomValue(fieldId, val) : '—'
    }
    const val = row[fieldId]
    // 'is_active' has no key of its own under admin.reports.advanced_report —
    // reuse the shared common.active/common.inactive pair this same file
    // already uses elsewhere (see the tCommon('active')/tCommon('inactive')
    // call below), instead of the two now-removed dead calls to a
    // non-existent t('is_active') key that never actually got used anywhere.
    if (fieldId === 'is_active') return val ? tCommon('active') : tCommon('inactive')
    if (fieldId === 'confidential_family_status') return getConfidentialFamilyStatusLabel(val) || '—'
    if ((fieldId === 'created_at' || fieldId === 'date_of_birth' || fieldId === 'date_of_joining') && val)
      return new Date(val).toLocaleDateString()
    return val != null ? String(val) : '—'
  }

  const filtered = useMemo(() => {
    let arr = rows
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      arr = arr.filter(row => selectedFields.some(f => String(getRawValue(row, f)).toLowerCase().includes(q)))
    }
    if (sortField) {
      arr = [...arr].sort((a, b) => {
        const aVal = String(getRawValue(a, sortField))
        const bVal = String(getRawValue(b, sortField))
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    }
    return arr
  }, [rows, searchQuery, sortField, sortDir, selectedFields])

  const handleSort = (fieldId: string) => {
    if (sortField === fieldId) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(fieldId); setSortDir('asc') }
  }

  // Excel/PDF export via the shared <ExportButton> (xlsx + jsPDF with an
  // embedded Arabic font) — replaces a raw CSV Blob download that had no
  // UTF-8 BOM, so Excel opened it using the system codepage and rendered
  // every Arabic value as mojibake; this page also never offered PDF at all.
  const exportColumns: ExportColumn<any>[] = [
    serialNumberColumn(),
    ...selectedFields.map(fieldId => ({
      key: fieldId,
      label: getFieldLabel(fieldId),
      accessor: (row: any) => getDisplayValue(row, fieldId),
    })),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#022172] mx-auto" />
          <p className="mt-4 text-muted-foreground">{t('results.loading', { role: roleLabel })}</p>
        </div>
      )
    </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/admin/students/advanced-report">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#022172] dark:text-white">
                {t('results.title', { role: roleLabel })}
              </h1>
              <p className="text-muted-foreground mt-0.5">
                <span className="font-semibold text-[#022172]">{filtered.length}</span> {t('results.records')} · {selectedFields.length} {t('results.fields')}
                {userLabel && <span className="ms-2 text-xs bg-blue-100 text-[#022172] px-2 py-0.5 rounded-full">{userLabel}</span>}
                {gradeLevelId && !userId && <span className="ms-2 text-xs bg-blue-100 text-[#022172] px-2 py-0.5 rounded-full">{t('results.grade_filtered')}</span>}
                {department && !userId && <span className="ms-2 text-xs bg-blue-100 text-[#022172] px-2 py-0.5 rounded-full">{t('results.dept_label', { dept: department })}</span>}
              </p>
            </div>
          </div>
        </div>
        <ExportButton
          reportKey={`advanced_report_${role}`}
          columns={exportColumns}
          rows={filtered}
          filename={`${role}_report_${new Date().toISOString().split('T')[0]}`}
          title={t('results.title', { role: roleLabel })}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('results.title', { role: roleLabel })}</CardTitle>
          <CardDescription>{t('selected_count', { count: selectedFields.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('results.search_placeholder', { role: roleLabel.toLowerCase() })}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="ps-10"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {rows.length === 0 ? t('results.no_records', { role: roleLabel.toLowerCase() }) : t('results.no_search')}
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="whitespace-nowrap w-12">S.N</TableHead>
                    {selectedFields.map(fieldId => (
                      <TableHead
                        key={fieldId}
                        className="whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort(fieldId)}
                      >
                        <div className="flex items-center gap-1">
                          {getFieldLabel(fieldId)}
                          {sortField === fieldId
                            ? sortDir === 'asc'
                              ? <ChevronUp className="h-3 w-3 text-[#022172]" />
                              : <ChevronDown className="h-3 w-3 text-[#022172]" />
                            : <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-40" />
                          }
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row, i) => (
                    <TableRow key={row.id ?? i} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{i + 1}</TableCell>
                      {selectedFields.map(fieldId => {
                        const display = getDisplayValue(row, fieldId)
                        return (
                          <TableCell key={fieldId} className="whitespace-nowrap text-sm">
                            {fieldId === 'confidential_family_status' ? (
                              row[fieldId] && row[fieldId] !== 'NONE' ? (
                                <ConfidentialFamilyStatusBadge status={row[fieldId]} />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )
                            ) : fieldId === 'is_active' ? (
                              <Badge className={row[fieldId]
                                ? 'bg-green-500 text-white border-0'
                                : 'bg-gray-400 text-white border-0'
                              }>
                                {display}
                              </Badge>
                            ) : display}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
