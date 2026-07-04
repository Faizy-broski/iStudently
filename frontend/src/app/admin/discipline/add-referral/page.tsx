'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  AlertCircle,
  Loader2,
  Search,
  CheckCircle2,
  User,
  Info,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { getDisciplineFields, createDisciplineReferral, type DisciplineField } from '@/lib/api/discipline';
import { getStudents, getStudentById, type Student } from '@/lib/api/students';
import { getGradeLevels, getSections, type GradeLevel, type Section } from '@/lib/api/academics';
import { StudentMultiSelect, type StudentOption } from '@/components/admin/quiz/StudentMultiSelect';
import { getAllStaff, type Staff } from '@/lib/api/staff';

// ---------------------------------------------------------------------------

function StudentSearch({
  campusId,
  gradeFilter,
  onSelect,
}: {
  campusId?: string;
  gradeFilter: string;
  onSelect: (student: Student) => void;
}) {
  const t = useTranslations('discipline');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await getStudents({ search: q, campus_id: campusId, limit: 20 });
      const all = res.data ?? [];
      setResults(
        gradeFilter && gradeFilter !== 'all'
          ? all.filter((s) => s.grade_level === gradeFilter)
          : all
      );
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [campusId, gradeFilter]);

  async function selectStudent(s: Student) {
    // pull full record so we have campus_id if available (search results don't
    // include it for performance reasons)
    try {
      const res = await getStudentById(s.id, campusId);
      if (res.success && res.data) {
        onSelect(res.data);
      } else {
        onSelect(s);
      }
    } catch {
      onSelect(s);
    }
    setQuery('');
    setResults([]);
  }

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  function displayName(s: Student) {
    if (s.profile) {
      const { first_name, last_name } = s.profile as any;
      return `${first_name ?? ''} ${last_name ?? ''}`.trim() || s.student_number;
    }
    return s.student_number;
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('search_placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-background border rounded-md shadow-md max-h-60 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
              onClick={() => selectStudent(s)}
            >
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{displayName(s)}</span>
              <span className="text-muted-foreground ml-auto">{s.student_number}</span>
              {s.grade_level && (
                <span className="text-xs text-muted-foreground">{s.grade_level}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StaffSearch({
  campusId,
  role,
  onSelect,
}: {
  campusId?: string;
  role: 'teacher' | 'staff';
  onSelect: (staff: Staff) => void;
}) {
  const t = useTranslations('discipline');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Staff[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await getAllStaff(1, 20, q, role, campusId);
      setResults(res.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [campusId, role]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  function selectStaff(s: Staff) {
    onSelect(s);
    setQuery('');
    setResults([]);
  }

  function displayName(s: Staff) {
    if (s.profile) {
      const { first_name, last_name } = s.profile as any;
      return `${first_name ?? ''} ${last_name ?? ''}`.trim() || s.employee_number;
    }
    return s.employee_number;
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('search_placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-background border rounded-md shadow-md max-h-60 overflow-y-auto">
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2"
              onClick={() => selectStaff(s)}
            >
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{displayName(s)}</span>
              <span className="text-muted-foreground ml-auto">{s.employee_number}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dynamic field input renderer
// ---------------------------------------------------------------------------

function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: DisciplineField;
  value: any;
  onChange: (val: any) => void;
}) {
  const t = useTranslations('discipline');
  const { field_type, options, name } = field;
  const visibleOptions = options ?? [];

  if (field_type === 'text') {
    return (
      <Input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={name}
        maxLength={1000}
      />
    );
  }

  if (field_type === 'textarea') {
    return (
      <Textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={name}
        rows={3}
        maxLength={5000}
      />
    );
  }

  if (field_type === 'numeric') {
    return (
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }

  if (field_type === 'date') {
    return (
      <Input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field_type === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={`chk-${field.id}`}
          checked={value === true || value === 'Y'}
          onCheckedChange={(checked) => onChange(checked ? 'Y' : 'N')}
        />
        <label htmlFor={`chk-${field.id}`} className="text-sm cursor-pointer">{t('yes')}</label>
      </div>
    );
  }

  if (field_type === 'select') {
    return (
      <Select value={value || '__na__'} onValueChange={(v) => onChange(v === '__na__' ? '' : v)}>
        <SelectTrigger>
          <SelectValue placeholder={t('select')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__na__">{t('na')}</SelectItem>
          {visibleOptions.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field_type === 'multiple_radio') {
    return (
      <div className="flex flex-wrap gap-4">
        {visibleOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="radio"
              name={`radio-${field.id}`}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="accent-primary"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (field_type === 'multiple_checkbox') {
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-4">
        {visibleOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <Checkbox
              checked={selected.includes(opt)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selected, opt]);
                } else {
                  onChange(selected.filter((v) => v !== opt));
                }
              }}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPenaltyPts(field: DisciplineField): number | null {
  return field.penalty_points ?? null;
}

// Mirrors the scoring logic in backend/src/services/discipline-score.service.ts
// so the teacher sees the same point impact live, before submitting.
function computeTotalPointsImpact(
  fields: DisciplineField[],
  fieldValues: Record<string, any>
): number {
  let total = 0;
  for (const field of fields) {
    const penalty = field.penalty_points;
    if (!penalty) continue;
    const value = fieldValues[field.id];

    if (field.field_type === 'multiple_checkbox') {
      const selected = Array.isArray(value) ? value : [];
      if (selected.length > 0) total += penalty * selected.length;
    } else if (field.field_type === 'select' || field.field_type === 'multiple_radio') {
      const selectedValue = Array.isArray(value) ? value[0] : value;
      if (selectedValue) total += penalty;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AddReferralPage() {
  const t = useTranslations('discipline');
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  // some admin users (super‑admins) may not be tied to a specific school in
  // their profile; in that case we fall back to whatever school the currently
  // selected campus belongs to.  this eliminates the "School not found" error
  // the customer reported when the campus was picked but the profile lacked
  // a school_id.
  const schoolId =
    user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  // Same reasoning as referral-form: if there's no school context we can't create
  // a referral.  Bail out early and show guidance rather than an endlessly
  // spinning loader.

  const [fields, setFields] = useState<DisciplineField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);

  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  // Who this referral is about: a student, a teacher, or other staff
  const [targetKind, setTargetKind] = useState<'student' | 'teacher' | 'staff'>('student');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  // Single vs. multiple-student targeting (only applies when targetKind === 'student')
  const [targetMode, setTargetMode] = useState<'single' | 'multiple'>('single');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Multiple-student mode: scope the roster to one grade/section and multi-select
  const [sections, setSections] = useState<Section[]>([]);
  const [multiSectionId, setMultiSectionId] = useState<string>('all');
  const [multiStudentOptions, setMultiStudentOptions] = useState<StudentOption[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [multiStudentIds, setMultiStudentIds] = useState<string[]>([]);

  const [incidentDate, setIncidentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // same protection as above: don't spam API or keep the spinner running when
    // there's no school context yet.
    if (!schoolId) {
      setFields([]);
      setLoadingFields(false);
      return;
    }

    fetchFields();
    getGradeLevels().then((res) => {
      if (res.data) setGrades(res.data.filter((g) => g.is_active));
    });
  }, [schoolId]);

  // Multiple-student mode: load sections for the selected grade
  useEffect(() => {
    setMultiSectionId('all');
    if (targetMode !== 'multiple' || gradeFilter === 'all') { setSections([]); return; }
    const grade = grades.find((g) => g.name === gradeFilter);
    if (!grade) { setSections([]); return; }
    getSections(grade.id, campusId).then((res) => setSections(res.data ?? []));
  }, [targetMode, gradeFilter, grades, campusId]);

  // Multiple-student mode: load the roster for the chosen grade/section
  useEffect(() => {
    if (targetMode !== 'multiple' || gradeFilter === 'all') {
      setMultiStudentOptions([]);
      setMultiStudentIds([]);
      return;
    }
    setLoadingRoster(true);
    getStudents({
      campus_id: campusId,
      grade_level: gradeFilter,
      section_id: multiSectionId !== 'all' ? multiSectionId : undefined,
      limit: 200,
    })
      .then((res) => {
        const options: StudentOption[] = (res.data ?? []).map((s: any) => ({
          id: s.id,
          name: [s.profile?.first_name, s.profile?.last_name].filter(Boolean).join(' ') || s.student_number,
          subtitle: [s.grade?.name ?? s.grade_level, s.section?.name].filter(Boolean).join(' - ') || undefined,
        }));
        setMultiStudentOptions(options);
        setMultiStudentIds([]);
      })
      .finally(() => setLoadingRoster(false));
  }, [targetMode, campusId, gradeFilter, multiSectionId]);

  async function fetchFields() {
    setLoadingFields(true);
    try {
      const res = await getDisciplineFields(schoolId);
      setFields(res.data ?? []);
    } catch {
      toast.error(t('errors.loadReferralFields'));
    } finally {
      setLoadingFields(false);
    }
  }

  function setFieldValue(fieldId: string, value: any) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  const totalPointsImpact = computeTotalPointsImpact(fields, fieldValues);

  function getStudentDisplayName(s: Student) {
    if (s.profile) {
      const p = s.profile as any;
      return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || s.student_number;
    }
    return s.student_number;
  }

  async function handleSubmit() {
    if (!schoolId) {
      toast.error(t('validation.schoolNotFound'));
      return;
    }

    if (targetKind === 'teacher' || targetKind === 'staff') {
      if (!selectedStaff) {
        toast.error(t('validation.selectStudent'));
        return;
      }
      if (!campusId) {
        toast.error(t('validation.studentNoCampus'));
        return;
      }

      setSubmitting(true);
      setSuccess(false);
      try {
        const res = await createDisciplineReferral({
          school_id: schoolId,
          campus_id: campusId,
          target_type: 'staff',
          staff_id: selectedStaff.id,
          reporter_id: user?.id ?? null,
          incident_date: incidentDate,
          field_values: fieldValues,
        });

        if (res.error) {
          toast.error(res.error);
          return;
        }

        toast.success(t('toasts.referralAdded'));
        setSuccess(true);
        setSelectedStaff(null);
        setIncidentDate(new Date().toISOString().slice(0, 10));
        setFieldValues({});
      } catch {
        toast.error(t('errors.addReferral'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (targetMode === 'single') {
      if (!selectedStudent) {
        toast.error(t('validation.selectStudent'));
        return;
      }

      // use campus from context if available, otherwise fall back to whatever is
      // recorded on the student profile; if neither exists we can't create a
      // referral because the campus is required for filtering and reporting.
      const campusToUse = campusId || selectedStudent.campus_id || null;
      if (!campusToUse) {
        toast.error(t('validation.studentNoCampus'));
        return;
      }

      setSubmitting(true);
      setSuccess(false);
      try {
        const res = await createDisciplineReferral({
          school_id: schoolId,
          campus_id: campusToUse,
          student_id: selectedStudent.id,
          reporter_id: user?.id ?? null,
          incident_date: incidentDate,
          field_values: fieldValues,
        });

        if (res.error) {
          toast.error(res.error);
          return;
        }

        toast.success(t('toasts.referralAdded'));
        setSuccess(true);
        setSelectedStudent(null);
        setIncidentDate(new Date().toISOString().slice(0, 10));
        setFieldValues({});
      } catch {
        toast.error(t('errors.addReferral'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Multiple-student mode
    if (multiStudentIds.length === 0) {
      toast.error(t('validation.selectStudent'));
      return;
    }
    if (!campusId) {
      toast.error(t('validation.studentNoCampus'));
      return;
    }

    setSubmitting(true);
    setSuccess(false);
    try {
      const res = await createDisciplineReferral({
        school_id: schoolId,
        campus_id: campusId,
        student_ids: multiStudentIds,
        reporter_id: user?.id ?? null,
        incident_date: incidentDate,
        field_values: fieldValues,
      });

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success(`Referral added for ${multiStudentIds.length} students`);
      setSuccess(true);
      setMultiStudentIds([]);
      setIncidentDate(new Date().toISOString().slice(0, 10));
      setFieldValues({});
    } catch {
      toast.error(t('errors.addReferral'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertCircle className="h-7 w-7 text-destructive" />
            {t('add')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('addSubtitle')}
            {campusId && (
              <span className="ml-1 text-xs">
                ({t('campus')}: {campusCtx?.selectedCampus?.name})
              </span>
            )}
          </p>
        </div>

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <AlertDescription className="text-green-800">
              {t('successReferralSubmitted')}
            </AlertDescription>
          </Alert>
        )}

        {/* Main form */}
        {!schoolId && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t('selectSchoolBeforeReferral')}
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('referralDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Who this referral is about */}
            <div className="space-y-1.5">
              <Label>Referral About <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-3 gap-2 max-w-lg">
                {(['student', 'teacher', 'staff'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setTargetKind(kind);
                      setSelectedStaff(null);
                    }}
                    className={`py-1.5 px-3 rounded-md text-sm font-medium border capitalize transition-colors ${
                      targetKind === kind ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>

            {/* Target mode toggle (student mode only: single vs. multiple in same class/section) */}
            {targetKind === 'student' && (
            <div className="space-y-1.5">
              <Label>{t('student')} <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                <button
                  type="button"
                  onClick={() => setTargetMode('single')}
                  className={`py-1.5 px-3 rounded-md text-sm font-medium border transition-colors ${
                    targetMode === 'single' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'
                  }`}
                >
                  Single Student
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('multiple')}
                  className={`py-1.5 px-3 rounded-md text-sm font-medium border transition-colors ${
                    targetMode === 'multiple' ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-muted'
                  }`}
                >
                  Multiple Students (same class/section)
                </button>
              </div>
            </div>
            )}

            {/* Student selector */}
            {targetKind === 'student' && (
            <div className="space-y-1.5">
              {targetMode === 'multiple' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Select value={gradeFilter} onValueChange={setGradeFilter}>
                      <SelectTrigger className="w-48 h-9 text-sm">
                        <SelectValue placeholder={t('gradeLevel')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allGrades')}</SelectItem>
                        {grades.map((g) => (
                          <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={multiSectionId}
                      onValueChange={setMultiSectionId}
                      disabled={gradeFilter === 'all' || sections.length === 0}
                    >
                      <SelectTrigger className="w-48 h-9 text-sm">
                        <SelectValue placeholder={t('section')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allSections')}</SelectItem>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {gradeFilter === 'all' ? (
                    <p className="text-sm text-muted-foreground">Choose a grade level to load its roster.</p>
                  ) : loadingRoster ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> {t('loadingFields')}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <StudentMultiSelect
                          options={multiStudentOptions}
                          value={multiStudentIds}
                          onChange={setMultiStudentIds}
                          placeholder="Select students..."
                        />
                      </div>
                      {multiStudentOptions.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setMultiStudentIds(multiStudentOptions.map((o) => o.id))}
                        >
                          Select all ({multiStudentOptions.length})
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : selectedStudent ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/40">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{getStudentDisplayName(selectedStudent)}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedStudent.student_number}
                        {selectedStudent.grade_level && ` · ${selectedStudent.grade_level}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedStudent(null)}
                    >
                      {t('change')}
                    </Button>
                  </div>
                  {selectedStudent.campus_id && campusId && selectedStudent.campus_id !== campusId ? (
                    <p className="text-sm text-yellow-700">
                      {t('warnings.studentDifferentCampus')} ({selectedStudent.campus_id}).
                    </p>
                  ) : !selectedStudent.campus_id && !campusId ? (
                    <p className="text-sm text-red-700">
                      {t('warnings.noCampusSelected')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  {grades.length > 0 && (
                    <Select value={gradeFilter} onValueChange={setGradeFilter}>
                      <SelectTrigger className="w-48 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('allGrades')}</SelectItem>
                        {grades.map((g) => (
                          <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <StudentSearch
                    campusId={campusId}
                    gradeFilter={gradeFilter}
                    onSelect={setSelectedStudent}
                  />
                </div>
              )}
            </div>
            )}

            {/* Teacher/Staff selector */}
            {(targetKind === 'teacher' || targetKind === 'staff') && (
            <div className="space-y-1.5">
              <Label>{targetKind === 'teacher' ? 'Teacher' : 'Staff Member'} <span className="text-destructive">*</span></Label>
              {selectedStaff ? (
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/40">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {selectedStaff.profile
                        ? `${(selectedStaff.profile as any).first_name ?? ''} ${(selectedStaff.profile as any).last_name ?? ''}`.trim()
                        : selectedStaff.employee_number}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedStaff.employee_number}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStaff(null)}>
                    {t('change')}
                  </Button>
                </div>
              ) : (
                <StaffSearch campusId={campusId} role={targetKind} onSelect={setSelectedStaff} />
              )}
            </div>
            )}

            {/* Incident Date */}
            <div className="space-y-1.5">
              <Label>{t('incidentDate')} <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-48"
              />
            </div>

            {/* Dynamic custom fields */}
            {loadingFields ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loadingFields')}
              </div>
            ) : fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('noCustomFields')}{' '}
                <a href="/admin/discipline/referral-form" className="underline">
                  {t('referralForm')}
                </a>{' '}
                {t('toAddFields')}
              </p>
            ) : (
              fields.map((field, idx) => {
                const pts = getPenaltyPts(field);
                return (
                  <div key={field.id}>
                    {idx > 0 && <hr className="my-5 border-t" />}
                    <div className="space-y-3">
                      <p className="text-base font-semibold text-blue-700 flex items-center gap-2">
                        {field.name}
                        {pts !== null && (
                          pts > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">
                              <TrendingUp className="h-3 w-3" />
                              +{pts} pts
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                              <TrendingDown className="h-3 w-3" />
                              {pts} pts
                            </span>
                          )
                        )}
                      </p>
                      <DynamicFieldInput
                        field={field}
                        value={fieldValues[field.id]}
                        onChange={(val) => setFieldValue(field.id, val)}
                      />
                    </div>
                  </div>
                );
              })
            )}

          </CardContent>
        </Card>

        {/* Live points impact summary */}
        {fields.some((f) => f.penalty_points) && (
          <div className={`flex items-center justify-between rounded-lg border p-3 ${
            totalPointsImpact > 0
              ? 'border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-900/20'
              : totalPointsImpact < 0
              ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/20'
              : 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/20'
          }`}>
            <span className="text-sm font-medium text-muted-foreground">Points Impact</span>
            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
              totalPointsImpact > 0
                ? 'text-green-700 dark:text-green-400'
                : totalPointsImpact < 0
                ? 'text-red-700 dark:text-red-400'
                : 'text-muted-foreground'
            }`}>
              {totalPointsImpact > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : totalPointsImpact < 0 ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              {totalPointsImpact > 0 ? `+${totalPointsImpact}` : totalPointsImpact} pts
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              (targetKind === 'teacher' || targetKind === 'staff'
                ? !selectedStaff
                : targetMode === 'single' ? !selectedStudent : multiStudentIds.length === 0)
            }
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('submitting')}
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                {t('addReferralForSelectedStudent')}
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
