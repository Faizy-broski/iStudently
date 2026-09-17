import { escapeHtml } from './html-pdf.util';

/**
 * Server-side port of frontend/src/components/shared/CertificateCanvasRenderer.tsx's
 * substituteTokens/resolveTableRows and frontend/src/lib/utils/certificateRender.ts's
 * renderCertificatePageHtml. Both are pure string/data builders with zero DOM
 * dependency, so this is a deliberate line-for-line port (not a reimplementation) to
 * render the exact same certificate layout when generating a PDF from the backend
 * (training-certificate issuance) instead of the browser (student/staff/parent print).
 * Keep in sync with the frontend originals if the template schema changes.
 */

export interface CertTemplateField {
  id: string;
  label: string;
  token: string;
  type: 'text' | 'image' | 'table';
  position: { x: number; y: number };
  size: { width: number; height: number };
  style?: {
    fontSize?: number;
    fontWeight?: string;
    fontFamily?: string;
    color?: string;
    align?: string;
  };
  table?: {
    columns: Array<{ id: string; label: string }>;
    rows: string[][];
    showHeader: boolean;
    dataSource: 'manual' | 'student_grades';
    headerBg?: string;
    fontSize?: number;
  };
}

export interface CertTemplateConfig {
  fields: CertTemplateField[];
  layout: { width: number; height: number; orientation: 'portrait' | 'landscape' };
  design: {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    backgroundImage?: string;
  };
}

// Matches printLayout.ts's PDF_FONT_STACK exactly — the Arabic-safe fallback used when a
// field has no explicit fontFamily, and for table cell text.
export const CERT_PDF_FONT_STACK = "'Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";

export function substituteTokens(template: string, data: Record<string, any>): string {
  let result = template;
  Object.keys(data).forEach((key) => {
    const token = `{{${key}}}`;
    const value = data[key] !== null && data[key] !== undefined ? String(data[key]) : '';
    result = result.split(token).join(value);
  });
  return result.replace(/\{\{[^}]+\}\}/g, '');
}

function resolveTableRows(
  field: CertTemplateField,
  data?: Record<string, any>
): { columns: string[]; rows: string[][] } {
  const table = field.table;
  if (!table) return { columns: [], rows: [] };

  if (table.dataSource === 'student_grades') {
    const gradeRows: Array<Record<string, any>> = data?.__tables?.student_grades || [];
    return {
      columns: ['Subject', 'Grade', 'Percent'],
      rows: gradeRows.map((r) => [String(r.Subject ?? ''), String(r.Grade ?? ''), String(r.Percent ?? '')]),
    };
  }

  const columns = table.columns.map((c) => (data ? substituteTokens(c.label, data) : c.label));
  const rows = table.rows.map((row) => row.map((cell) => (data ? substituteTokens(cell, data) : cell)));
  return { columns, rows };
}

export function renderCertificatePageHtml(config: CertTemplateConfig, data: Record<string, any>): string {
  const { layout, design, fields } = config;

  const fieldsHtml = fields
    .map((field) => {
      const value = substituteTokens(field.token, data);
      const posStyle = `position:absolute;left:${field.position.x}px;top:${field.position.y}px;width:${field.size.width}px;height:${field.size.height}px;`;

      if (field.type === 'image') {
        const isUrl = value && (value.startsWith('http') || value.startsWith('data:'));
        return isUrl
          ? `<div style="${posStyle}"><img src="${escapeHtml(value)}" style="width:100%;height:100%;object-fit:cover;" /></div>`
          : `<div style="${posStyle}"></div>`;
      }

      if (field.type === 'table') {
        const { columns, rows } = resolveTableRows(field, data);
        const fontSize = field.table?.fontSize ?? 12;
        const headerHtml = field.table?.showHeader
          ? `<thead><tr>${columns
              .map(
                (col) =>
                  `<th style="border:1px solid #d1d5db;padding:4px 6px;background-color:${field.table?.headerBg || '#f3f4f6'};font-weight:bold;text-align:left;">${escapeHtml(col)}</th>`
              )
              .join('')}</tr></thead>`
          : '';
        const bodyHtml = `<tbody>${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td style="border:1px solid #d1d5db;padding:4px 6px;">${escapeHtml(cell)}</td>`).join('')}</tr>`
          )
          .join('')}</tbody>`;
        return `<div style="${posStyle}overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:${fontSize}px;font-family:${CERT_PDF_FONT_STACK};">${headerHtml}${bodyHtml}</table></div>`;
      }

      const align = field.style?.align === 'center' ? 'center' : field.style?.align === 'right' ? 'flex-end' : 'flex-start';
      const textStyle =
        `font-size:${field.style?.fontSize ?? 14}px;font-weight:${field.style?.fontWeight ?? 'normal'};` +
        `font-family:${field.style?.fontFamily || CERT_PDF_FONT_STACK};` +
        `color:${field.style?.color ?? '#000000'};text-align:${field.style?.align ?? 'left'};` +
        `display:flex;align-items:center;justify-content:${align};overflow:hidden;line-height:1.3;`;

      return `<div style="${posStyle}${textStyle}"><span style="white-space:pre-wrap;">${escapeHtml(value)}</span></div>`;
    })
    .join('');

  const canvasStyle =
    `position:relative;width:${layout.width}px;height:${layout.height}px;` +
    `background-color:${design.backgroundColor};border-style:solid;border-width:${design.borderWidth}px;` +
    `border-color:${design.borderColor};border-radius:${design.borderRadius}px;` +
    (design.backgroundImage ? `background-image:url(${design.backgroundImage});background-size:cover;background-position:center;` : '');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>body{margin:0;padding:0;}</style></head><body>` +
    `<div style="width:${layout.width}px;height:${layout.height}px;margin:0;overflow:hidden;"><div style="${canvasStyle}">${fieldsHtml}</div></div>` +
    `</body></html>`;
}
