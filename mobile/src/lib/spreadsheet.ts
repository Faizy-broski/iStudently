import { csvToObjects, parseCsv } from '@studently/shared-utils';
import { File } from 'expo-file-system';
import * as XLSX from 'xlsx';

/** Document picker types for the web's import inputs (.csv, .xlsx, .xls). */
export const SHEET_TYPES = [
  'text/csv',
  'text/comma-separated-values',
  'text/plain',
  'application/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const ext = (name: string) => name.toLowerCase().split('.').pop() ?? '';
export const isSheetFile = (name: string) => ['csv', 'txt', 'xlsx', 'xls'].includes(ext(name));

async function firstSheet(uri: string) {
  const wb = XLSX.read(await new File(uri).base64(), { type: 'base64', cellDates: false });
  return wb.Sheets[wb.SheetNames[0]];
}

/** Rows as string arrays (first row = headers), from CSV or the first Excel sheet. */
export async function readSheetRows(file: { uri: string; name: string }): Promise<string[][]> {
  if (ext(file.name) === 'xlsx' || ext(file.name) === 'xls') {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(await firstSheet(file.uri), { header: 1, raw: false, defval: '' });
    return rows.map((r) => r.map((c) => String(c ?? '')));
  }
  return parseCsv(await new File(file.uri).text());
}

/** Rows keyed by lower-cased header with trimmed values, from CSV or the first Excel sheet (same shape as csvToObjects). */
export async function readSheetObjects(file: { uri: string; name: string }): Promise<Record<string, string>[]> {
  if (ext(file.name) === 'xlsx' || ext(file.name) === 'xls') {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(await firstSheet(file.uri), { raw: false, defval: '' });
    return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? '').trim()])));
  }
  return csvToObjects(await new File(file.uri).text()).rows as Record<string, string>[];
}

/** An .xlsx workbook as base64, for templates: sheets in order, optional column widths (characters). */
export function xlsxBase64(sheets: { name: string; rows: (string | number)[][]; widths?: number[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.rows);
    if (sh.widths) ws['!cols'] = sh.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  }
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}
