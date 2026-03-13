"use client"

import { useState, useEffect } from "react"
import { getPdfHeaderFooter, PdfHeaderFooterSettings } from "@/lib/api/school-settings"

const DEFAULTS: PdfHeaderFooterSettings = {
  pdf_header_html: "",
  pdf_footer_html: "",
  pdf_margin_top: 20,
  pdf_margin_bottom: 18,
  pdf_exclude_print: false,
}

/**
 * Hook to load the PDF header/footer settings for the given campus.
 * Returns the settings and helper utilities for applying them to print/PDF contexts.
 *
 * Usage:
 *   const { settings, printStyles } = usePdfHeaderFooter(campusId)
 *
 * Then inject `printStyles` into a <style> tag in your print template, and
 * render `settings.pdf_header_html` / `settings.pdf_footer_html` in your
 * @page header/footer elements.
 */
export function usePdfHeaderFooter(campusId?: string | null) {
  const [settings, setSettings] = useState<PdfHeaderFooterSettings>(DEFAULTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPdfHeaderFooter(campusId ?? null)
      .then((res) => {
        if (res.success && res.data) setSettings(res.data)
        else setSettings(DEFAULTS)
      })
      .finally(() => setLoading(false))
  }, [campusId])

  /**
   * CSS for @page margins that honour the configured top/bottom values.
   * Inject this into a <style> tag inside your print template.
   */
  const pageMarginStyles = `
    @page {
      margin-top: ${settings.pdf_margin_top}mm;
      margin-bottom: ${settings.pdf_margin_bottom}mm;
    }
  `

  /**
   * CSS that hides the custom header/footer when printing via the browser
   * print dialog (Ctrl+P), if pdf_exclude_print is enabled.
   */
  const excludePrintStyles = settings.pdf_exclude_print
    ? `@media print { .pdf-header, .pdf-footer { display: none !important; } }`
    : ""

  return {
    settings,
    loading,
    pageMarginStyles,
    excludePrintStyles,
    /** Combined CSS string — inject into a <style> tag in your print template */
    printStyles: [pageMarginStyles, excludePrintStyles].filter(Boolean).join("\n"),
  }
}
