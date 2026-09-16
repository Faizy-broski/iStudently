'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Download, FileSpreadsheet, FileText, Settings2, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'
import { useExportTemplates } from '@/hooks/useExportTemplates'
import { exportRowsToExcel, exportRowsToPdf, type ExportColumn } from '@/lib/utils/tableExport'
import { ExportTemplateManager } from './ExportTemplateManager'

export interface ExportButtonProps<T> {
  /** Stable identifier for this screen's export (e.g. 'students_list') — scopes saved templates. */
  reportKey: string
  /** Every column this screen's data could export. A saved template picks a subset/order/labels from these. */
  columns: ExportColumn<T>[]
  /**
   * The rows currently loaded on screen (already respects whatever filters/search are active).
   * Used as-is only when `fetchAllRows` is not provided. On a paginated screen, this is just the
   * current page — pass `fetchAllRows` there instead, or the export silently only covers page 1.
   */
  rows: T[]
  /**
   * For paginated screens: fetches every row matching the current filters (ignoring pagination)
   * right before exporting, so the file isn't silently limited to whatever page happens to be on
   * screen. Falls back to `rows` when omitted (fine for screens that already load everything).
   */
  fetchAllRows?: () => Promise<T[]>
  /** Base filename, without extension. */
  filename: string
  /** Shown above the table in the PDF export. Defaults to the filename. */
  title?: string
  className?: string
}

/**
 * Drop-in "Export" button for any table/list screen: downloads the given
 * rows as Excel or PDF, using either the school's default saved column
 * template for this reportKey (if one exists) or every column as-is.
 * "Manage columns…" opens a lightweight editor to customize/save templates
 * (see ExportTemplateManager) — a flat column picker, not a canvas builder.
 */
export function ExportButton<T>({ reportKey, columns, rows, fetchAllRows, filename, title, className }: ExportButtonProps<T>) {
  const locale = useLocale() as 'en' | 'ar'
  const isAr = locale === 'ar'
  const { profile } = useAuth()
  const { defaultTemplate } = useExportTemplates(reportKey)
  const [managerOpen, setManagerOpen] = React.useState(false)
  const [exportingPdf, setExportingPdf] = React.useState(false)
  const [exportingExcel, setExportingExcel] = React.useState(false)

  const effectiveColumns = React.useMemo((): ExportColumn<T>[] => {
    if (!defaultTemplate) return columns
    const byKey = new Map(columns.map((c) => [c.key, c]))
    return defaultTemplate.columns
      .filter((c) => c.visible && byKey.has(c.key))
      .sort((a, b) => a.order - b.order)
      .map((c) => {
        const base = byKey.get(c.key)!
        return { ...base, label: c.label || base.label, label_ar: c.label_ar || base.label_ar }
      })
  }, [defaultTemplate, columns])

  const branding = profile?.school ? { name: profile.school.name, logo_url: profile.school.logo_url } : undefined

  const handleExportExcel = async () => {
    setExportingExcel(true)
    try {
      const allRows = fetchAllRows ? await fetchAllRows() : rows
      exportRowsToExcel(effectiveColumns, allRows, filename, { locale })
    } catch (err) {
      toast.error(isAr ? 'فشل تصدير Excel' : 'Failed to export Excel')
      console.error(err)
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const allRows = fetchAllRows ? await fetchAllRows() : rows
      await exportRowsToPdf(effectiveColumns, allRows, filename, { locale, title: title || filename, branding })
    } catch (err) {
      toast.error(isAr ? 'فشل تصدير PDF' : 'Failed to export PDF')
      console.error(err)
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <Download className="h-4 w-4 me-2" />
            {isAr ? 'تصدير' : 'Export'}
            <ChevronDown className="h-3.5 w-3.5 ms-1 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExportExcel} disabled={(rows.length === 0 && !fetchAllRows) || exportingExcel}>
            {exportingExcel ? (
              <Loader2 className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 text-green-600" />
            )}
            {isAr ? 'تصدير إلى Excel' : 'Export to Excel'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportPdf} disabled={(rows.length === 0 && !fetchAllRows) || exportingPdf}>
            {exportingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0 text-red-600" />
            )}
            {isAr ? 'تصدير إلى PDF' : 'Export to PDF'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setManagerOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
            {isAr ? 'إدارة الأعمدة...' : 'Manage columns…'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportTemplateManager
        open={managerOpen}
        onOpenChange={setManagerOpen}
        reportKey={reportKey}
        columns={columns}
      />
    </>
  )
}
