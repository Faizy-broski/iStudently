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
  GraduationCap,
  Users,
  UserCheck,
  Minus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { getDisciplineFields, createDisciplineReferral, type DisciplineField, type DisciplinePersonType } from '@/lib/api/discipline';
import { getStudents, getStudentById, type Student } from '@/lib/api/students';
import { getAllStaff, type Staff } from '@/lib/api/staff';
import { useGradeLevels } from '@/hooks/useAcademics';
import { getSections, type Section } from '@/lib/api/academics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelectedPerson {
  id: string;           // staff.id or student.id
  displayName: string;
  subInfo: string;      // student_number or employee_number
  personType: DisciplinePersonType;
}

// ---------------------------------------------------------------------------
// Student search
// ---------------------------------------------------------------------------

function StudentSearch({
  campusId,
  gradeLevelName,
  sectionId,
  onSelect,
}: {
  campusId?: string;
  gradeLevelName?: string;
  sectionId?: string;
  onSelect: (student: Student) => void;
}) {
  const t = useTranslations('discipline');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await getStudents({
        search: q,
        campus_id: campusId,
        grade_level: gradeLevelName || undefined,
        section_id: sectionId || undefined,
        limit: 10,
      });
      setResults(res.data ?? []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [campusId, gradeLevelName, sectionId]);

  async function selectStudent(s: Student) {
    try {
      const res = await getStudentById(s.id, campusId);
      onSelect(res.success && res.data ? res.data : s);
    } catch { onSelect(s); }
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
              {s.grade_level && <span className="text-xs text-muted-foreground">{s.grade_level}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Staff / Teacher search
// ---------------------------------------------------------------------------

function StaffSearch({
  campusId,
  role,
  departmentFilter,
  onSelect,
}: {
  campusId?: string;
  role: 'staff' | 'teacher';
  departmentFilter: string;
  onSelect: (staff: Staff) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Staff[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const apiRole = role === 'teacher' ? 'teacher' : 'staff';
      const res = await getAllStaff(1, 10, q, apiRole, campusId);
      let data: Staff[] = res.data?.data ?? [];
      if (departmentFilter) {
        data = data.filter((s) => s.department?.toLowerCase().includes(departmentFilter.toLowerCase()));
      }
      setResults(data);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, [campusId, role, departmentFilter]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  function displayName(s: Staff) {
    if (s.profile) {
      return `${s.profile.first_name ?? ''} ${s.profile.last_name ?? ''}`.trim() || s.employee_number;
    }
    return s.employee_number;
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={`Search ${role === 'teacher' ? 'teachers' : 'staff'} by name…`}
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
              onClick={() => { onSelect(s); setQuery(''); setResults([]); }}
            >
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{displayName(s)}</span>
              {s.department && (
                <span className="text-xs text-muted-foreground ml-auto">{s.department}</span>
              )}
              <span className="text-muted-foreground text-xs">{s.employee_number}</span>
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

function PenaltyBadge({ options }: { options: string[] | null | undefined }) {
  if (!options || options.length === 0) return null;
  const first = options[0];
  const val = parseFloat(first);
  if (isNaN(val) || val >= 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
      <Minus className="h-3 w-3" />
      {Math.abs(val)} pts
    </span>
  );
}

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

  const isPenaltyMarker = (opt: string) => !isNaN(parseFloat(opt)) && parseFloat(opt) < 0;
  const visibleOptions = (options ?? []).filter((opt, idx) => !(idx === 0 && isPenaltyMarker(opt)));

  if (field_type === 'text') {
    return (
      <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={name} maxLength={1000} />
    );
  }

  if (field_type === 'textarea') {
    return (
      <Textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={name} rows={3} maxLength={5000} />
    );
  }

  if (field_type === 'numeric') {
    return (
      <Input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
    );
  }

  if (field_type === 'date') {
    return (
      <Input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
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
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {visibleOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input type="radio" name={`radio-${field.id}`} value={opt} checked={value === opt} onChange={() => onChange(opt)} className="accent-primary h-4 w-4 shrink-0" />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field_type === 'multiple_checkbox') {
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {visibleOptions.map((opt) => (
          <label key={opt} className="flex items-center gap-2.5 text-sm cursor-pointer">
            <Checkbox
              className="shrink-0"
              checked={selected.includes(opt)}
              onCheckedChange={(checked) => {
                onChange(checked ? [...selected, opt] : selected.filter((v) => v !== opt));
              }}
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const PERSON_TYPES: { value: DisciplinePersonType; label: string; icon: React.ElementType }[] = [
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'staff',   label: 'Staff',   icon: Users },
  { value: 'teacher', label: 'Teacher', icon: UserCheck },
];

export default function AddReferralPage() {
  const t = useTranslations('discipline');
  const { user } = useAuth();
  const campusCtx = useCampus();
  const campusId = campusCtx?.selectedCampus?.id;
  const schoolId = user?.school_id || campusCtx?.selectedCampus?.parent_school_id || '';

  const [fields, setFields] = useState<DisciplineField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);

  // Person type toggle
  const [personType, setPersonType] = useState<DisciplinePersonType>('student');

  // Student filters
  const { gradeLevels } = useGradeLevels();
  const [gradeFilter, setGradeFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  // Staff / teacher filters
  const [departmentFilter, setDepartmentFilter] = useState('');

  const selectedGrade = gradeLevels.find((g) => g.id === gradeFilter);

  useEffect(() => {
    if (!gradeFilter) { setSections([]); setSectionFilter(''); return; }
    setSectionsLoading(true);
    getSections(gradeFilter)
      .then((res) => { if (res.success && res.data) setSections(res.data); })
      .catch(() => {})
      .finally(() => setSectionsLoading(false));
    setSectionFilter('');
  }, [gradeFilter]);

  // Selected person (student or staff/teacher)
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);

  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!schoolId) { setFields([]); setLoadingFields(false); return; }
    fetchFields();
  }, [schoolId]);

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

  function handleSelectStudent(s: Student) {
    const p = s.profile as any;
    const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : s.student_number;
    setSelectedPerson({
      id: s.id,
      displayName: name || s.student_number,
      subInfo: s.student_number + (s.grade_level ? ` · ${s.grade_level}` : ''),
      personType: 'student',
    });
  }

  function handleSelectStaff(s: Staff, type: DisciplinePersonType) {
    const name = s.profile
      ? `${s.profile.first_name ?? ''} ${s.profile.last_name ?? ''}`.trim()
      : s.employee_number;
    setSelectedPerson({
      id: s.id,
      displayName: name || s.employee_number,
      subInfo: s.employee_number + (s.department ? ` · ${s.department}` : ''),
      personType: type,
    });
  }

  // Clear selected person when person type changes
  function switchPersonType(type: DisciplinePersonType) {
    setPersonType(type);
    setSelectedPerson(null);
    setGradeFilter('');
    setSectionFilter('');
    setDepartmentFilter('');
  }

  function setFieldValue(fieldId: string, value: any) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit() {
    if (!selectedPerson) {
      toast.error(t('validation.selectStudent'));
      return;
    }
    if (!schoolId) {
      toast.error(t('validation.schoolNotFound'));
      return;
    }

    const campusToUse = campusId || null;

    setSubmitting(true);
    setSuccess(false);
    try {
      const payload: Parameters<typeof createDisciplineReferral>[0] = {
        school_id: schoolId,
        campus_id: campusToUse,
        person_type: personType,
        reporter_id: user?.id ?? null,
        incident_date: incidentDate,
        field_values: fieldValues,
      };

      if (personType === 'student') {
        payload.student_id = selectedPerson.id;
      } else {
        payload.staff_id = selectedPerson.id;
      }

      const res = await createDisciplineReferral(payload);

      if (res.error) { toast.error(res.error); return; }

      toast.success(t('toasts.referralAdded'));
      setSuccess(true);
      setSelectedPerson(null);
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
        <div className="mb-2">
          <h1 className="text-3xl font-bold flex items-center gap-2 text-[#022172] dark:text-white">
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

        {!schoolId && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t('selectSchoolBeforeReferral')}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-[#022172] dark:text-white">{t('referralDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">

            {/* Person type toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs">Incident Against</Label>
              <div className="flex gap-2">
                {PERSON_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => switchPersonType(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      personType === value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Student filters */}
            {personType === 'student' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Grade</Label>
                  <Select value={gradeFilter || '__all__'} onValueChange={(v) => setGradeFilter(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Grades</SelectItem>
                      {gradeLevels.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Section</Label>
                  <Select
                    value={sectionFilter || '__all__'}
                    onValueChange={(v) => setSectionFilter(v === '__all__' ? '' : v)}
                    disabled={!gradeFilter || sectionsLoading}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={gradeFilter ? 'All Sections' : 'Select grade first'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Sections</SelectItem>
                      {sections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Staff / teacher department filter */}
            {(personType === 'staff' || personType === 'teacher') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Department (optional filter)</Label>
                <Input
                  className="h-8 text-sm"
                  placeholder="Filter by department…"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                />
              </div>
            )}

            {/* Person selector */}
            <div className="space-y-1.5">
              <Label>
                {personType === 'student' ? t('student') : personType === 'teacher' ? 'Teacher' : 'Staff Member'}
                <span className="text-destructive"> *</span>
              </Label>

              {selectedPerson ? (
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/40">
                  {personType === 'student'
                    ? <GraduationCap className="h-5 w-5 text-muted-foreground" />
                    : personType === 'teacher'
                    ? <UserCheck className="h-5 w-5 text-muted-foreground" />
                    : <Users className="h-5 w-5 text-muted-foreground" />
                  }
                  <div className="flex-1">
                    <p className="font-medium text-sm">{selectedPerson.displayName}</p>
                    <p className="text-xs text-muted-foreground">{selectedPerson.subInfo}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedPerson(null)}>
                    {t('change')}
                  </Button>
                </div>
              ) : personType === 'student' ? (
                <StudentSearch
                  campusId={campusId}
                  gradeLevelName={selectedGrade?.name}
                  sectionId={sectionFilter || undefined}
                  onSelect={handleSelectStudent}
                />
              ) : (
                <StaffSearch
                  campusId={campusId}
                  role={personType}
                  departmentFilter={departmentFilter}
                  onSelect={(s) => handleSelectStaff(s, personType)}
                />
              )}
            </div>

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
              fields.map((field, idx) => (
                <div key={field.id}>
                  {idx > 0 && <hr className="my-6 border-t" />}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium">{field.name}</Label>
                      <PenaltyBadge options={field.options} />
                    </div>
                    <DynamicFieldInput
                      field={field}
                      value={fieldValues[field.id]}
                      onChange={(val) => setFieldValue(field.id, val)}
                    />
                  </div>
                </div>
              ))
            )}

          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting || !selectedPerson}>
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
