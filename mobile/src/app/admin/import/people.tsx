import type { CustomFieldDefinition, EmployeeImportRow, StudentImportRow } from '@studently/api-client';
import { csvToObjects, normalizeSpreadsheetDate, toCsv } from '@studently/shared-utils';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileDown, FileUp, Upload, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';
import * as XLSX from 'xlsx';

import { FormError } from '@/components/app/form';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminCustomFields, adminEmployees, adminFieldOrders, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

type Entity = 'student' | 'teacher' | 'staff';
type Raw = Record<string, unknown>;
type Role = 'teacher' | 'librarian' | 'staff' | 'admin' | 'counselor';
type Parsed = { rowIndex: number; errors: string[]; role?: Role; student?: StudentImportRow; employee?: EmployeeImportRow };
type ImportError = { row?: number; email?: string; error: string };
type Created = { student_number?: string; first_name?: string; last_name?: string; email?: string; username?: string; password?: string };
type FieldDef = { key: string; label: string; required: boolean; hint?: string };

const SKIP = '__skip__';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMP_TYPES = ['full_time', 'part_time', 'contract'];
const PAY_TYPES = ['fixed_salary', 'hourly'];
const ROLES: Role[] = ['teacher', 'librarian', 'staff', 'admin', 'counselor'];
const DASHBOARD_ROLES: Role[] = ['teacher', 'librarian', 'admin', 'counselor'];
const GRADE_LIKE = ['grade', 'class', 'section', 'standard', 'year group', 'yeargroup'];

/** Template columns, same as the web's import templates. */
const COLUMNS: Record<Entity, string[]> = {
  student: ['first_name', 'father_name', 'grandfather_name', 'last_name', 'email', 'phone', 'gender', 'date_of_birth', 'national_id'],
  teacher: ['employee_number', 'first_name', 'last_name', 'email', 'phone', 'password', 'title', 'department', 'qualifications', 'specialization', 'date_of_joining', 'employment_type', 'payment_type', 'base_salary'],
  staff: ['employee_number', 'first_name', 'last_name', 'email', 'phone', 'password', 'title', 'role', 'department', 'qualifications', 'specialization', 'date_of_joining', 'employment_type', 'payment_type', 'base_salary'],
};
const EXAMPLE: Record<Entity, string[]> = {
  student: ['John', 'Robert', 'James', 'Smith', 'john.smith@school.com', '+1234567890', 'male', '2012-05-14', 'A123456789'],
  teacher: ['TCH001', 'Sara', 'Khalil', 'sara.khalil@example.com', '+218910000001', '', 'Mathematics Teacher', 'Mathematics', 'B.Ed', 'Algebra', '2024-01-15', 'full_time', 'fixed_salary', '5000'],
  staff: ['STF001', 'Hamza', 'Ali', 'hamza.ali@example.com', '+218910000002', '', 'Accountant', 'staff', 'Finance', '', '', '2024-01-15', 'full_time', 'fixed_salary', '3000'],
};

/** Column names the web recognises without mapping (web: AUTO_DETECT_MAP in the three bulk import components). */
const SHARED_ALIASES: Record<string, string> = {
  first_name: 'first_name', firstname: 'first_name', 'first name': 'first_name', given_name: 'first_name', fname: 'first_name',
  last_name: 'last_name', lastname: 'last_name', 'last name': 'last_name', surname: 'last_name', family_name: 'last_name', lname: 'last_name',
  email: 'email', email_address: 'email', emailaddress: 'email', 'e-mail': 'email',
  phone: 'phone', phone_number: 'phone', phonenumber: 'phone', mobile: 'phone', telephone: 'phone', tel: 'phone', 'phone number': 'phone',
};
const STUDENT_ALIASES: Record<string, string> = {
  ...SHARED_ALIASES, givenname: 'first_name',
  father_name: 'father_name', fathername: 'father_name', 'father name': 'father_name', father: 'father_name',
  grandfather_name: 'grandfather_name', grandfathername: 'grandfather_name', 'grandfather name': 'grandfather_name', grandfather: 'grandfather_name',
  gender: 'gender', sex: 'gender',
  date_of_birth: 'date_of_birth', dateofbirth: 'date_of_birth', 'date of birth': 'date_of_birth', dob: 'date_of_birth', birth_date: 'date_of_birth', birthdate: 'date_of_birth',
  national_id: 'national_id', nationalid: 'national_id', 'national id': 'national_id', civil_id: 'national_id', 'civil id': 'national_id', id_number: 'national_id',
};
const EMPLOYEE_ALIASES: Record<string, string> = {
  ...SHARED_ALIASES,
  employee_number: 'employee_number', employeenumber: 'employee_number', 'employee number': 'employee_number', emp_no: 'employee_number',
  employee_id: 'employee_number', employeeid: 'employee_number', emp_id: 'employee_number', staff_id: 'employee_number', staffid: 'employee_number',
  password: 'password', pass: 'password', pwd: 'password',
  title: 'title', job_title: 'title', jobtitle: 'title', 'job title': 'title', position: 'title',
  department: 'department', dept: 'department', division: 'department',
  qualifications: 'qualifications', qualification: 'qualifications', education: 'qualifications', degree: 'qualifications',
  specialization: 'specialization', spec: 'specialization',
  date_of_joining: 'date_of_joining', dateofjoining: 'date_of_joining', 'date of joining': 'date_of_joining', join_date: 'date_of_joining',
  joining_date: 'date_of_joining', start_date: 'date_of_joining', hire_date: 'date_of_joining', hired_date: 'date_of_joining',
  employment_type: 'employment_type', employmenttype: 'employment_type', 'employment type': 'employment_type', contract_type: 'employment_type',
  emp_type: 'employment_type', work_type: 'employment_type',
  payment_type: 'payment_type', pay_type: 'payment_type', salary_type: 'payment_type',
  base_salary: 'base_salary', basesalary: 'base_salary', salary: 'base_salary', 'base salary': 'base_salary', monthly_salary: 'base_salary',
};
const STAFF_ROLE_ALIASES: Record<string, string> = { role: 'role', staff_role: 'role', staffrole: 'role', type: 'role', staff_type: 'role' };

/** Same order as the web: an explicit role wins, otherwise it is guessed from the job title (mirrors the backend). */
function resolveRole(role: string, title: string): Role {
  if (ROLES.includes(role as Role)) return role as Role;
  const t = title.toLowerCase();
  if (t.includes('librarian')) return 'librarian';
  if (t.includes('admin') || t.includes('principal') || t.includes('director')) return 'admin';
  if (t.includes('teacher') || t.includes('instructor') || t.includes('professor') || t.includes('lecturer')) return 'teacher';
  if (t.includes('counselor') || t.includes('counsellor')) return 'counselor';
  return 'staff';
}

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * Bulk import for students, teachers or staff (web: the three Bulk Import pages): upload a CSV or
 * Excel file, map its columns, preview with per-row checks, import, then share the error report and
 * generated logins. Students go into one class or, in "whole school" mode, each row's own class.
 */
export default function ImportPeople() {
  const { t } = useTranslation();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ entity?: string }>();
  const entity: Entity = params.entity === 'teacher' || params.entity === 'staff' ? params.entity : 'student';
  const isStudent = entity === 'student';
  const s = (k: string, o?: Record<string, unknown>) => t(`school.students.bulk_import.${k}`, o);
  const b = (k: string, o?: Record<string, unknown>) => t(`staff.bulkImport.${k}`, o);
  const { campusId } = useCampus();
  const key = campusId ?? 'school';

  const defs = useApi(['admin', 'custom-fields', entity, key], () => adminCustomFields.list(entity, campusId));
  const orders = useApi(isStudent ? ['admin', 'field-orders', 'student', key] : null, () => adminFieldOrders.list('student', campusId));
  const grades = useApi(isStudent ? ['admin', 'grades', key] : null, () => adminAcademics.grades(campusId));
  const allSections = useApi(isStudent ? ['admin', 'sections', key, 'all'] : null, () => adminAcademics.sections(campusId));

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Raw[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'single' | 'whole_school'>('single');
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [parsed, setParsed] = useState<Parsed[]>([]);
  const [result, setResult] = useState<{ success: number; errors: ImportError[]; created: Created[] } | null>(null);

  const customDefs: CustomFieldDefinition[] = (defs.data ?? []).filter((d) => d.is_active !== false);
  const gradeList = grades.data ?? [];
  const sectionList = allSections.data ?? [];
  const sectionsForGrade = sectionList.filter((x) => x.grade_level_id === gradeId);
  // Per-school "email required" setting, the same source the single student form reads.
  const emailOrder = (orders.data ?? []).find((o) => o.category_id === 'personal' && o.field_label === 'email');
  const emailRequired = typeof emailOrder?.required === 'boolean' ? emailOrder.required : false;
  const hasGradeColumn = columns.some((c) => GRADE_LIKE.some((p) => normalize(c).includes(p)));

  const studentFields: FieldDef[] = [
    { key: 'first_name', label: s('fields.first_name'), required: true },
    { key: 'last_name', label: s('fields.last_name'), required: true },
    { key: 'email', label: s('fields.email'), required: emailRequired },
    { key: 'father_name', label: s('fields.father_name'), required: false },
    { key: 'grandfather_name', label: s('fields.grandfather_name'), required: false },
    { key: 'phone', label: s('fields.phone'), required: false },
    { key: 'gender', label: s('fields.gender'), required: false, hint: s('fields.gender_hint') },
    { key: 'date_of_birth', label: s('fields.date_of_birth'), required: false, hint: s('fields.date_of_birth_hint') },
    { key: 'national_id', label: s('fields.national_id'), required: false },
    ...(mode === 'whole_school'
      ? [
          { key: 'grade_level', label: s('fields.grade_level'), required: true },
          { key: 'section', label: s('fields.section'), required: false },
        ]
      : []),
  ];
  const employeeFields: FieldDef[] = [
    { key: 'first_name', label: t('app.im_f_first_name'), required: true },
    { key: 'last_name', label: t('app.im_f_last_name'), required: true },
    { key: 'email', label: t('app.im_f_email'), required: true },
    { key: 'employee_number', label: t('app.im_f_employee_number'), required: false, hint: t('app.im_h_auto') },
    { key: 'phone', label: t('app.im_f_phone'), required: false },
    { key: 'password', label: t('app.im_f_password'), required: false, hint: t('app.im_h_auto') },
    { key: 'title', label: t('app.im_f_title'), required: false, hint: entity === 'staff' ? t('app.im_h_title_role') : undefined },
    ...(entity === 'staff' ? [{ key: 'role', label: t('app.im_f_role'), required: false, hint: ROLES.join(' / ') }] : []),
    { key: 'department', label: t('app.im_f_department'), required: false },
    { key: 'qualifications', label: t('app.im_f_qualifications'), required: false },
    { key: 'specialization', label: t('app.im_f_specialization'), required: false },
    { key: 'date_of_joining', label: t('app.im_f_date_of_joining'), required: false, hint: 'YYYY-MM-DD' },
    { key: 'employment_type', label: t('app.im_f_employment_type'), required: false, hint: EMP_TYPES.join(' / ') },
    { key: 'payment_type', label: t('app.im_f_payment_type'), required: false, hint: PAY_TYPES.join(' / ') },
    { key: 'base_salary', label: t('app.im_f_base_salary'), required: false, hint: t('app.im_h_salary') },
  ];
  const fields = isStudent ? studentFields : employeeFields;

  async function shareTemplate() {
    const headers = [...COLUMNS[entity], ...customDefs.map((d) => d.label)];
    const example = [...EXAMPLE[entity], ...customDefs.map((d) => d.options?.[0] ?? '')];
    await shareTextFile(`${entity}_import_template.csv`, toCsv(headers, [example]), 'text/csv', 'public.comma-separated-values-text');
  }

  function autoMap(cols: string[]) {
    const aliases = isStudent ? STUDENT_ALIASES : { ...EMPLOYEE_ALIASES, ...(entity === 'staff' ? STAFF_ROLE_ALIASES : {}) };
    const out: Record<string, string> = {};
    for (const col of cols) {
      const k = aliases[normalize(col)];
      if (k && !out[k]) out[k] = col;
      // The template's custom field columns carry the field's label.
      const d = customDefs.find((x) => normalize(x.label) === normalize(col) || normalize(x.field_key) === normalize(col));
      if (d && !out[d.field_key]) out[d.field_key] = col;
    }
    return out;
  }

  async function pickFile() {
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
      ],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    const ext = asset.name.split('.').pop()?.toLowerCase();
    let rows: Raw[];
    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const wb = XLSX.read(await new File(asset.uri).base64(), { type: 'base64', cellDates: true });
        rows = XLSX.utils.sheet_to_json<Raw>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      } else if (ext === 'csv' || ext === 'txt') {
        rows = csvToObjects(await new File(asset.uri).text()).rows.filter((r) => Object.values(r).some((v) => v !== ''));
      } else {
        return toast.error(s('msg_unsupported_format'));
      }
    } catch {
      return toast.error(s(ext === 'csv' || ext === 'txt' ? 'msg_parse_failed_csv' : 'msg_parse_failed_excel'));
    }
    if (!rows.length) return toast.error(s('msg_empty_file'));
    const cols = Object.keys(rows[0]);
    setFileName(asset.name);
    setColumns(cols);
    setRawRows(rows);
    setMapping(autoMap(cols));
    setStep(2);
  }

  function validate(): Parsed[] {
    const seenEmails = new Set<string>();
    const seenNumbers = new Set<string>();
    return rawRows.map((raw, i) => {
      const errors: string[] = [];
      const cell = (k: string) => {
        const col = mapping[k];
        return !col || col === SKIP ? undefined : raw[col];
      };
      const get = (k: string) => String(cell(k) ?? '').trim();
      const custom: Record<string, Record<string, unknown>> = {};
      for (const d of customDefs) {
        const v = get(d.field_key);
        if (d.required && !v) errors.push(t('app.im_err_required', { field: d.label }));
        if (v) custom[d.category_id] = { ...(custom[d.category_id] ?? {}), [d.field_key]: d.type === 'multi-select' ? v.split(/[;,]/).map((x) => x.trim()).filter(Boolean) : v };
      }
      const customFields = Object.keys(custom).length ? custom : undefined;
      const firstName = get('first_name');
      const lastName = get('last_name');
      const email = get('email').toLowerCase();

      if (isStudent) {
        const dobRaw = cell('date_of_birth');
        const dob = normalizeSpreadsheetDate(dobRaw);
        const g = get('gender').toLowerCase();
        if (!firstName) errors.push(s('error_first_name_req'));
        if (!dob && dobRaw !== undefined && String(dobRaw).trim() !== '') errors.push(`${s('error_invalid_date_of_birth')}: ${String(dobRaw)}`);
        if (!lastName) errors.push(s('error_last_name_req'));
        if (!email) {
          if (emailRequired) errors.push(s('error_email_req'));
        } else if (!EMAIL_RE.test(email)) errors.push(`${s('error_invalid_email')}: ${email}`);
        else if (seenEmails.has(email)) errors.push(s('error_duplicate_email'));
        if (email && EMAIL_RE.test(email)) seenEmails.add(email);
        let gradeLevelId: string | undefined;
        let rowSectionId: string | undefined;
        if (mode === 'whole_school') {
          const gradeText = get('grade_level');
          const sectionText = get('section');
          if (!gradeText) errors.push(s('error_grade_required'));
          else {
            const grade = gradeList.find((x) => normalize(x.name) === normalize(gradeText));
            if (!grade) errors.push(`${s('error_grade_not_found')}: ${gradeText}`);
            else {
              gradeLevelId = grade.id;
              if (sectionText) {
                const sec = sectionList.find((x) => x.grade_level_id === grade.id && normalize(x.name) === normalize(sectionText));
                if (!sec) errors.push(`${s('error_section_not_found')}: ${sectionText}`);
                else rowSectionId = sec.id;
              }
            }
          }
        }
        return {
          rowIndex: i + 2,
          errors,
          student: {
            first_name: firstName, last_name: lastName, email,
            father_name: get('father_name') || undefined, grandfather_name: get('grandfather_name') || undefined,
            phone: get('phone') || undefined,
            gender: g === 'male' || g === 'm' ? 'male' : g === 'female' || g === 'f' ? 'female' : g ? 'other' : undefined,
            date_of_birth: dob, national_id: get('national_id') || undefined,
            custom_fields: customFields, grade_level_id: gradeLevelId, section_id: rowSectionId, _row: i + 2,
          },
        };
      }

      const empNum = get('employee_number');
      const title = get('title');
      const rawRole = entity === 'staff' ? get('role').toLowerCase() : '';
      const empType = get('employment_type').toLowerCase();
      const payType = get('payment_type').toLowerCase();
      const salary = get('base_salary');
      const dojRaw = cell('date_of_joining');
      const doj = normalizeSpreadsheetDate(dojRaw);
      if (!firstName) errors.push(t('app.im_err_required', { field: 'first_name' }));
      if (!lastName) errors.push(t('app.im_err_required', { field: 'last_name' }));
      if (!email) errors.push(t('app.im_err_required', { field: 'email' }));
      else if (!EMAIL_RE.test(email)) errors.push(t('app.im_err_bad_email', { value: email }));
      else if (seenEmails.has(email)) errors.push(t('app.im_err_dup_email'));
      if (rawRole && !ROLES.includes(rawRole as Role)) errors.push(t('app.im_err_bad_choice', { column: 'role', value: rawRole, allowed: ROLES.join(', ') }));
      if (empType && !EMP_TYPES.includes(empType)) errors.push(t('app.im_err_bad_choice', { column: 'employment_type', value: empType, allowed: EMP_TYPES.join(', ') }));
      if (payType && !PAY_TYPES.includes(payType)) errors.push(t('app.im_err_bad_choice', { column: 'payment_type', value: payType, allowed: PAY_TYPES.join(', ') }));
      if (salary && (isNaN(Number(salary)) || Number(salary) < 0)) errors.push(t('app.im_err_bad_value', { column: 'base_salary', value: salary }));
      if (empNum && seenNumbers.has(empNum)) errors.push(t('app.im_err_dup_number', { value: empNum }));
      if (!doj && dojRaw !== undefined && String(dojRaw).trim() !== '') errors.push(t('app.im_err_bad_value', { column: 'date_of_joining', value: String(dojRaw) }));
      if (EMAIL_RE.test(email)) seenEmails.add(email);
      if (empNum) seenNumbers.add(empNum);
      return {
        rowIndex: i + 2,
        errors,
        role: entity === 'staff' ? resolveRole(rawRole, title) : 'teacher',
        employee: {
          employee_number: empNum || undefined, first_name: firstName, last_name: lastName, email,
          phone: get('phone') || undefined, password: get('password') || undefined, title: title || undefined,
          role: rawRole ? (rawRole as Role) : undefined,
          department: get('department') || undefined, qualifications: get('qualifications') || undefined, specialization: get('specialization') || undefined,
          date_of_joining: doj, employment_type: (empType || undefined) as EmployeeImportRow['employment_type'],
          payment_type: (payType || undefined) as EmployeeImportRow['payment_type'], base_salary: salary ? Number(salary) : undefined,
          custom_fields: customFields,
        },
      };
    });
  }

  function applyMapping() {
    if (isStudent && mode === 'single' && !gradeId) return toast.error(s('msg_target_grade_required'));
    const missing = [...fields.map((f) => ({ key: f.key, label: f.label, required: f.required })), ...customDefs.map((d) => ({ key: d.field_key, label: d.label, required: !!d.required }))]
      .filter((f) => f.required && (!mapping[f.key] || mapping[f.key] === SKIP))
      .map((f) => f.label);
    if (missing.length) return toast.error(isStudent ? `${s('msg_map_required')}: ${missing.join(', ')}` : b('errors.mapRequiredFirst', { fields: missing.join(', ') }));
    setParsed(validate());
    setStep(3);
  }

  const valid = parsed.filter((r) => r.errors.length === 0);
  const invalid = parsed.filter((r) => r.errors.length > 0);
  const roleSummary = valid.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.role ?? 'staff']: (acc[r.role ?? 'staff'] ?? 0) + 1 }), {});
  const dashboardCount = valid.filter((r) => r.role && DASHBOARD_ROLES.includes(r.role)).length;
  const gradeName = gradeList.find((g) => g.id === gradeId)?.name ?? '—';

  async function runImport() {
    if (!valid.length) return toast.error(isStudent ? s('msg_no_valid_rows') : b('errors.noValidRows'));
    setStep(4);
    const res = isStudent
      ? await adminStudents.bulkImport(
          campusId,
          valid.map((r) => r.student as StudentImportRow),
          mode === 'single' ? { gradeLevelId: gradeId, sectionId: sectionId || undefined } : undefined,
        )
      : await adminEmployees.bulkImport(entity, campusId, valid.map((r) => r.employee as EmployeeImportRow));
    if (!res.success || !res.data) {
      toast.error(res.error || (isStudent ? s('msg_import_failed') : b('errors.importFailed')));
      return setStep(3);
    }
    const data = res.data as { success_count: number; error_count: number; errors: ImportError[]; created?: Created[] };
    setResult({ success: data.success_count, errors: data.errors ?? [], created: data.created ?? [] });
    setStep(5);
    if (data.success_count > 0) toast.success(isStudent ? s('msg_import_success', { count: data.success_count }) : b('toasts.importedSuccessfully', { count: data.success_count }));
    if (data.error_count > 0) toast.error(isStudent ? s('msg_import_partial', { count: data.error_count }) : b('toasts.rowsFailedDownloadReport', { count: data.error_count }));
    mutate((k) => (typeof k === 'string' && k.startsWith('admin-')) || (Array.isArray(k) && k[0] === 'admin'));
  }

  function reset() {
    setParsed([]);
    setResult(null);
    setColumns([]);
    setRawRows([]);
    setMapping({});
    setFileName('');
    setGradeId('');
    setSectionId('');
    setMode('single');
    setStep(1);
  }

  async function shareErrors() {
    const errors = result?.errors ?? [];
    const csv = isStudent
      ? toCsv([s('row_label'), s('error_label')], errors.map((e) => [e.row ?? '', e.error]))
      : toCsv(['row', 'email', 'error'], errors.map((e) => [e.row ?? '', e.email ?? '', e.error]));
    await shareTextFile(`${entity}_import_errors.csv`, csv, 'text/csv', 'public.comma-separated-values-text');
  }

  async function shareLogins() {
    const created = (result?.created ?? []).filter((c) => c.password);
    const csv = isStudent
      ? toCsv(['student_number', 'first_name', 'last_name', 'username', 'password'], created.map((c) => [c.student_number ?? '', c.first_name ?? '', c.last_name ?? '', c.username ?? '', c.password ?? '']))
      : toCsv(['email', 'username', 'password'], created.map((c) => [c.email ?? '', c.username ?? '', c.password ?? '']));
    await shareTextFile(`imported_${entity}_logins.csv`, csv, 'text/csv', 'public.comma-separated-values-text');
  }

  const steps = isStudent
    ? [s('step_upload'), s('step_map'), s('step_preview'), s('step_importing'), s('step_results')]
    : [b('steps.Upload'), b('steps.Map Columns'), b('steps.Preview'), b('steps.Importing'), b('steps.Results')];
  const optional = <Text className="text-muted-foreground text-xs">{t('app.im_optional')}</Text>;
  const required = <Text className="text-destructive text-xs">*</Text>;
  const columnOptions = [{ value: SKIP, label: isStudent ? s('skip_option') : b('skip') }, ...columns.map((c) => ({ value: c, label: c }))];

  function mapField(k: string, label: string, isRequired: boolean, hint?: string) {
    const value = mapping[k] ?? SKIP;
    return (
      <View key={k} className="gap-1">
        <View className="flex-row items-center gap-1.5">
          <Label>{label}</Label>
          {isRequired ? required : optional}
        </View>
        {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
        <Picker value={value} onChange={(v) => setMapping((m) => ({ ...m, [k]: v }))} options={columnOptions} invalid={isRequired && value === SKIP} />
      </View>
    );
  }

  function table(headers: string[], rows: { key: string; cells: string[]; bad?: boolean }[]) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View className="border-border flex-row border-b">
            {headers.map((h) => (
              <Text key={h} className="text-muted-foreground w-32 px-2 py-1 text-xs font-medium" numberOfLines={1}>
                {h}
              </Text>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.key} className={cn('border-border flex-row border-b', r.bad && 'bg-destructive/5')}>
              {r.cells.map((c, i) => (
                <Text key={`${r.key}-${i}`} className={cn('w-32 px-2 py-1 text-xs', r.bad && i === r.cells.length - 1 && 'text-destructive')} numberOfLines={2}>
                  {c}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  function warning(title: string, body?: string, tone: 'amber' | 'blue' = 'amber') {
    return (
      <Card className={cn('py-3', tone === 'amber' ? 'border-warning bg-warning-soft ' : 'border-brand bg-info-soft ')}>
        <CardContent className="flex-row gap-2 px-4">
          <Icon as={AlertTriangle} className={cn('mt-0.5 size-4', tone === 'amber' ? 'text-warning' : 'text-brand dark:text-brand-secondary ')} />
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-medium">{title}</Text>
            {body ? <Text className="text-muted-foreground text-xs">{body}</Text> : null}
          </View>
        </CardContent>
      </Card>
    );
  }

  const createdWithLogins = (result?.created ?? []).filter((c) => c.password);

  return (
    <>
      <Stack.Screen options={{ title: t(`app.im_title_${entity}`) }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {steps.map((label, idx) => {
            const n = idx + 1;
            const done = step > n;
            const active = step === n;
            return (
              <View key={label} className="flex-row items-center gap-1.5">
                <View className={cn('size-6 items-center justify-center rounded-full', done ? 'bg-success' : active ? 'bg-primary' : 'bg-muted')}>
                  {done ? <Icon as={CheckCircle2} className="size-3.5 text-white" /> : <Text className={cn('text-xs font-semibold', active ? 'text-primary-foreground' : 'text-muted-foreground')}>{n}</Text>}
                </View>
                <Text className={cn('text-xs', active ? 'font-medium' : 'text-muted-foreground')}>{label}</Text>
                {idx < steps.length - 1 ? <Icon flipRtl as={ArrowRight} className="text-muted-foreground size-3" /> : null}
              </View>
            );
          })}
        </View>

        {step === 1 ? (
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <CardTitle>{isStudent ? s('title') : t(`app.im_title_${entity}`)}</CardTitle>
              <CardDescription>{isStudent ? s('subtitle') : b('description')}</CardDescription>
            </CardHeader>
            <CardContent className="gap-3 px-4">
              <Pressable onPress={pickFile} className="border-muted-foreground/30 active:border-primary items-center gap-2 rounded-lg border-2 border-dashed p-8">
                <Icon as={Upload} className="text-muted-foreground size-9" />
                <Text className="text-sm font-semibold">{t('app.im_pick_sheet')}</Text>
                <Text className="text-muted-foreground text-xs">{isStudent ? s('formats_hint') : b('supports')}</Text>
              </Pressable>
              <Text className="text-muted-foreground text-xs">
                {isStudent ? `${s('required_fields_hint')}: ${s('required_fields_list')}` : `${b('requiredFieldsLabel')} ${b('requiredFields')}`}
              </Text>
              {entity === 'staff' ? (
                <View className="bg-muted/50 gap-1 rounded-md p-3">
                  <Text className="text-xs font-medium">{b('roleValuesTitle')}</Text>
                  {ROLES.map((r) => (
                    <Text key={r} className="text-muted-foreground text-xs">{`${r} — ${b(`roleValueDescriptions.${r}`)}`}</Text>
                  ))}
                </View>
              ) : null}
              {entity === 'teacher' ? (
                <View className="bg-muted/50 gap-1 rounded-md p-3">
                  <Text className="text-xs font-medium">{t('app.im_teacher_role_title')}</Text>
                  <Text className="text-muted-foreground text-xs">{t('app.im_teacher_role_body')}</Text>
                </View>
              ) : null}
              <Button variant="outline" onPress={shareTemplate} disabled={defs.isLoading}>
                <Icon as={FileDown} className="size-4" />
                <Text>{isStudent ? s('download_template') : b('downloadTemplate')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <>
            <View className="gap-1">
              <Text className="font-semibold">{isStudent ? s('map_title') : b('mapColumnsTitle')}</Text>
              <Text className="text-muted-foreground text-sm">
                {isStudent ? s('file_info', { name: fileName, count: rawRows.length }) : b('mapColumnsSubtitle', { fileName, rows: rawRows.length })}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={reset}>
                <Icon flipRtl as={ArrowLeft} className="size-4" />
                <Text>{t('common.back')}</Text>
              </Button>
              <Button className="flex-1" onPress={applyMapping}>
                <Text>{t('common.continue')}</Text>
                <Icon flipRtl as={ArrowRight} className="text-primary-foreground size-4" />
              </Button>
            </View>

            {isStudent ? (
              <Card className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{s('import_mode_title')}</CardTitle>
                  <CardDescription>{s('import_mode_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="gap-2 px-4">
                  {(['single', 'whole_school'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setMode(m)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: mode === m }}
                      className={cn('rounded-lg border-2 p-3', mode === m ? 'border-brand-secondary bg-info-soft' : 'border-muted-foreground/20')}>
                      <Text className="text-sm font-medium">{s(m === 'single' ? 'mode_single_title' : 'mode_whole_school_title')}</Text>
                      <Text className="text-muted-foreground text-xs">{s(m === 'single' ? 'mode_single_desc' : 'mode_whole_school_desc')}</Text>
                    </Pressable>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {isStudent && mode === 'single' && hasGradeColumn ? warning(s('warn_single_mode_grade_column_title'), s('warn_single_mode_grade_column_desc')) : null}

            {isStudent && mode === 'single' ? (
              <Card className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{s('target_class_title')}</CardTitle>
                  <CardDescription>{s('target_class_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="gap-2 px-4">
                  <View className="flex-row items-center gap-1.5">
                    <Label>{s('fields.grade_level')}</Label>
                    {required}
                  </View>
                  <Picker
                    value={gradeId}
                    onChange={(v) => {
                      setGradeId(v);
                      setSectionId('');
                    }}
                    placeholder={s('select_grade_placeholder')}
                    invalid={!gradeId}
                    options={gradeList.map((g) => ({ value: g.id, label: g.name }))}
                  />
                  <View className="flex-row items-center gap-1.5">
                    <Label>{s('fields.section')}</Label>
                    {optional}
                  </View>
                  <Picker
                    value={sectionId}
                    onChange={setSectionId}
                    placeholder={s('select_section_placeholder')}
                    options={sectionsForGrade.map((x) => ({ value: x.id, label: x.name }))}
                  />
                </CardContent>
              </Card>
            ) : null}

            {isStudent && mode === 'whole_school' ? warning(s('mode_whole_school_hint')) : null}

            <Card className="py-4">
              <CardContent className="gap-3 px-4">{fields.map((f) => mapField(f.key, f.label, f.required, f.hint))}</CardContent>
            </Card>

            {customDefs.length > 0 ? (
              <Card className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{t('app.im_custom_fields')}</CardTitle>
                </CardHeader>
                <CardContent className="gap-3 px-4">{customDefs.map((d) => mapField(d.field_key, d.label, !!d.required))}</CardContent>
              </Card>
            ) : null}

            <Card className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-muted-foreground text-sm">{isStudent ? s('first_rows_preview') : b('first3Rows')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                {table(
                  columns,
                  rawRows.slice(0, 3).map((r, i) => ({ key: String(i), cells: columns.map((c) => (r[c] instanceof Date ? (r[c] as Date).toISOString().slice(0, 10) : String(r[c] ?? ''))) })),
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View className="flex-row flex-wrap gap-2">
              <Badge className="gap-1">
                <Icon as={CheckCircle2} className="text-primary-foreground size-3" />
                <Text>{isStudent ? s('valid_count', { count: valid.length }) : b('validCount', { count: valid.length })}</Text>
              </Badge>
              {invalid.length > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <Icon as={XCircle} className="size-3 text-white" />
                  <Text>{isStudent ? s('invalid_count', { count: invalid.length }) : b('invalidCount', { count: invalid.length })}</Text>
                </Badge>
              ) : null}
              {entity === 'staff'
                ? Object.entries(roleSummary).map(([role, count]) => (
                    <Badge key={role} variant={role === 'admin' ? 'destructive' : role === 'teacher' ? 'default' : role === 'librarian' ? 'secondary' : 'outline'}>
                      <Text>{b('roleCount', { count, role: b(`roles.${role}`) })}</Text>
                    </Badge>
                  ))
                : null}
            </View>
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={() => setStep(2)}>
                <Icon flipRtl as={ArrowLeft} className="size-4" />
                <Text>{isStudent ? s('btn_remap') : b('remap')}</Text>
              </Button>
              <Button className="flex-1" onPress={runImport} disabled={valid.length === 0}>
                <Text>{isStudent ? s('btn_import_count', { count: valid.length }) : b('importMembers', { count: valid.length })}</Text>
              </Button>
            </View>

            {isStudent && mode === 'single' && hasGradeColumn ? warning(s('warn_single_mode_confirm', { count: valid.length, grade: gradeName })) : null}
            {entity !== 'student' && dashboardCount > 0 ? warning(b('dashboardCredentialWarning', { count: dashboardCount }).replace(/<[^>]+>/g, ''), undefined, 'blue') : null}

            {invalid.length > 0 ? (
              <Card className="border-destructive/50 gap-2 py-4">
                <CardHeader className="flex-row items-center gap-2 px-4">
                  <Icon as={AlertTriangle} className="text-destructive size-4" />
                  <CardTitle className="text-destructive text-sm">{isStudent ? s('skipped_rows_warning', { count: invalid.length }) : b('rowsSkipped', { count: invalid.length })}</CardTitle>
                </CardHeader>
                <CardContent className="px-4">
                  <ScrollView className="max-h-48" nestedScrollEnabled>
                    {invalid.map((r) => {
                      const email = r.student?.email || r.employee?.email;
                      return (
                        <Text key={r.rowIndex} className="text-destructive text-xs">
                          {`${s('th_row')} ${r.rowIndex}${email ? ` (${email})` : ''}: ${r.errors.join('; ')}`}
                        </Text>
                      );
                    })}
                  </ScrollView>
                </CardContent>
              </Card>
            ) : null}

            <Card className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm">{isStudent ? s('preview_title') : b('previewFirstRows')}</CardTitle>
              </CardHeader>
              <CardContent className="gap-2 px-4">
                {isStudent
                  ? table(
                      [s('th_row'), s('th_first_name'), s('th_last_name'), s('th_email'), s('th_gender'), s('th_dob'), ...(mode === 'whole_school' ? [s('th_grade'), s('th_section')] : []), t('common.status')],
                      parsed.slice(0, 20).map((r) => {
                        const st = r.student as StudentImportRow;
                        return {
                          key: String(r.rowIndex),
                          bad: r.errors.length > 0,
                          cells: [
                            String(r.rowIndex), st.first_name, st.last_name, st.email, st.gender || '—', st.date_of_birth || '—',
                            ...(mode === 'whole_school'
                              ? [gradeList.find((g) => g.id === st.grade_level_id)?.name || '—', sectionList.find((x) => x.id === st.section_id)?.name || '—']
                              : []),
                            r.errors[0] ?? t('common.ok'),
                          ],
                        };
                      }),
                    )
                  : table(
                      [
                        b('previewHeaders.row'), b('previewHeaders.employeeNumber'), b('previewHeaders.firstName'), b('previewHeaders.lastName'), b('previewHeaders.email'),
                        ...(entity === 'staff' ? [b('previewHeaders.role')] : []),
                        b('previewHeaders.title'), b('previewHeaders.department'),
                        ...(entity === 'staff' ? [b('previewHeaders.dashboard')] : []),
                        b('previewHeaders.status'),
                      ],
                      parsed.slice(0, 20).map((r) => {
                        const e = r.employee as EmployeeImportRow;
                        return {
                          key: String(r.rowIndex),
                          bad: r.errors.length > 0,
                          cells: [
                            String(r.rowIndex), e.employee_number || t('app.im_h_auto'), e.first_name, e.last_name, e.email,
                            ...(entity === 'staff' ? [b(`roles.${r.role ?? 'staff'}`)] : []),
                            e.title || '—', e.department || '—',
                            ...(entity === 'staff' ? [r.role && DASHBOARD_ROLES.includes(r.role) ? b('yes') : '—'] : []),
                            r.errors[0] ?? b('ok'),
                          ],
                        };
                      }),
                    )}
                {parsed.length > 20 ? (
                  <Text className="text-muted-foreground text-xs">{isStudent ? s('more_rows_hint', { count: parsed.length - 20 }) : b('moreRows', { count: parsed.length - 20 })}</Text>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}

        {step === 4 ? (
          <Card className="py-4">
            <CardContent className="items-center gap-3 px-4 py-12">
              <ActivityIndicator size="large" />
              <Text className="text-sm font-semibold">{isStudent ? s('msg_importing') : b('creatingAccounts')}</Text>
              <Text className="text-muted-foreground text-center text-sm">
                {isStudent ? s('msg_importing_desc', { count: valid.length }) : b('processingMembers', { count: valid.length })}
              </Text>
            </CardContent>
          </Card>
        ) : null}

        {step === 5 && result ? (
          <>
            <View className="flex-row flex-wrap gap-2">
              <Badge className="gap-1">
                <Icon as={CheckCircle2} className="text-primary-foreground size-3.5" />
                <Text>{isStudent ? s('msg_success_count', { count: result.success }) : b('importedCount', { count: result.success })}</Text>
              </Badge>
              {result.errors.length > 0 ? (
                <Badge variant="destructive" className="gap-1">
                  <Icon as={XCircle} className="size-3.5 text-white" />
                  <Text>{isStudent ? s('msg_failed_count', { count: result.errors.length }) : b('failedCount', { count: result.errors.length })}</Text>
                </Badge>
              ) : null}
            </View>

            {result.errors.length > 0 ? (
              <Card className="border-destructive/50 gap-2 py-4">
                <CardHeader className="flex-row items-center gap-2 px-4">
                  <Icon as={AlertTriangle} className="text-destructive size-4" />
                  <CardTitle className="text-destructive flex-1 text-sm">{isStudent ? s('failed_rows_title') : b('failedRows')}</CardTitle>
                </CardHeader>
                <CardContent className="gap-2 px-4">
                  <Button variant="outline" size="sm" onPress={shareErrors}>
                    <Icon as={FileDown} className="size-4" />
                    <Text>{isStudent ? s('btn_download_errors') : b('downloadErrorReport')}</Text>
                  </Button>
                  <ScrollView className="max-h-60" nestedScrollEnabled>
                    {result.errors.map((e, i) => (
                      <Text key={`${e.row}-${i}`} className="text-destructive text-xs">{`${s('th_row')} ${e.row ?? '—'}${e.email ? ` (${e.email})` : ''}: ${e.error}`}</Text>
                    ))}
                  </ScrollView>
                </CardContent>
              </Card>
            ) : null}

            {createdWithLogins.length > 0 ? (
              <Card className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{s('credentials_title')}</CardTitle>
                  <CardDescription>{s('credentials_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="gap-2 px-4">
                  <FormError message={t('app.im_logins_once')} />
                  <Button variant="outline" size="sm" onPress={shareLogins}>
                    <Icon as={FileDown} className="size-4" />
                    <Text>{t('app.im_share_logins')}</Text>
                  </Button>
                  {isStudent
                    ? table(
                        [s('th_student_num'), s('th_first_name'), s('th_last_name'), s('th_username'), s('th_password')],
                        createdWithLogins.map((c, i) => ({ key: String(i), cells: [c.student_number ?? '', c.first_name ?? '', c.last_name ?? '', c.username || '—', c.password || '—'] })),
                      )
                    : table(
                        [s('th_email'), s('th_username'), s('th_password')],
                        createdWithLogins.map((c, i) => ({ key: String(i), cells: [c.email ?? '', c.username || '—', c.password || '—'] })),
                      )}
                </CardContent>
              </Card>
            ) : null}

            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={reset}>
                <Icon as={FileUp} className="size-4" />
                <Text>{isStudent ? s('btn_import_more') : b('importMore')}</Text>
              </Button>
              <Button
                className="flex-1"
                onPress={() => (isStudent ? router.replace('/admin/students') : router.replace({ pathname: '/admin/employees', params: { kind: entity } }))}>
                <Text>{isStudent ? s('btn_view_students') : b('viewStaff')}</Text>
              </Button>
            </View>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
