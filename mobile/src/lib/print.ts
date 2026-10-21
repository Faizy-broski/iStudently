import type { PdfHeaderFooter } from '@studently/api-client';
import { BASE_PRINT_STYLES, buildAutoFooterHtml, buildAutoHeaderHtml, buildPdfLayoutCss, resolvePdfTokens, type PrintSchool } from '@studently/shared-utils';
import qrcode from 'qrcode-generator';

import i18n from '@/i18n';

export interface PrintDocument {
  title: string;
  /** One HTML block per page (e.g. one per student). */
  pages: string[];
  school: PrintSchool;
  /** The school's custom header/footer (pdf_header_footer plugin), or null for the automatic one. */
  layout?: PdfHeaderFooter | null;
  /** Show a header/footer at all (web: only when the pdf_header_footer plugin is active). */
  withHeader?: boolean;
  reportLabel?: string;
  extraCss?: string;
}

/** Full HTML for expo-print, built like the web's print window (header/footer, page breaks, RTL). */
export function buildPrintHtml(doc: PrintDocument) {
  const rtl = i18n.language === 'ar';
  const header = doc.withHeader
    ? doc.layout?.pdf_header_html
      ? resolvePdfTokens(doc.layout.pdf_header_html, doc.school)
      : buildAutoHeaderHtml(doc.school, undefined, doc.reportLabel)
    : '';
  const footer = doc.withHeader ? (doc.layout?.pdf_footer_html ? resolvePdfTokens(doc.layout.pdf_footer_html, doc.school) : buildAutoFooterHtml(doc.school)) : '';
  const css = buildPdfLayoutCss(doc.layout?.pdf_margin_top ?? 12, doc.layout?.pdf_margin_bottom ?? 12, !!doc.layout?.pdf_exclude_print);
  const pages = doc.pages
    .map((p, i) => `<section class="page" style="${i < doc.pages.length - 1 ? 'page-break-after:always;' : ''}">${header ? `<div class="pdf-header">${header}</div>` : ''}<div class="page-body">${p}</div>${footer ? `<div class="pdf-footer">${footer}</div>` : ''}</section>`)
    .join('');
  return `<!DOCTYPE html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${rtl ? 'ar' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(doc.title)}</title><style>${BASE_PRINT_STYLES}${css}.pdf-header,.pdf-footer{position:relative!important}.page-body{padding:16px 24px;font-size:13px;line-height:1.5}${doc.extraCss ?? ''}</style></head><body>${pages}</body></html>`;
}

export function escapeHtml(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

async function loadPrint() {
  try {
    return await import('expo-print');
  } catch {
    throw new Error('print-unavailable');
  }
}

/** System print dialog (printers, or "Save to Files" as PDF on iOS). */
export async function printHtml(html: string) {
  const Print = await loadPrint();
  await Print.printAsync({ html });
}

/** Render a PDF and open the share sheet (WhatsApp, email, Drive, Files...). */
export async function sharePdf(html: string, fileName: string, page?: { width: number; height: number }) {
  const Print = await loadPrint();
  const { uri } = await Print.printToFileAsync({ html, base64: false, ...page });
  const Sharing = await import('expo-sharing');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
}

/** Render HTML to a PDF file on the device and return its local URI (for uploads). */
export async function pdfFile(html: string) {
  const Print = await loadPrint();
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

/** QR code as inline SVG markup for print HTML (generated on the device, never by a remote service). */
export function qrSvg(value: string, cellSize = 6) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  return qr.createSvgTag({ cellSize, margin: 2, scalable: true });
}

/** QR code as a GIF image (base64, no data: prefix), e.g. to save or share like the web's PNG download. */
export function qrGifBase64(value: string, cellSize = 8) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  return qr.createDataURL(cellSize, 4).replace(/^data:image\/gif;base64,/, '');
}
