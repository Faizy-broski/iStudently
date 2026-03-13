'use client';

import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { getDisciplineFields, createDisciplineReferral, type DisciplineField } from '@/lib/api/discipline';
import { getStudents, getStudentById, type Student } from '@/lib/api/students';

// ---------------------------------------------------------------------------

function StudentSearch({
  campusId,
  onSelect,
}: {
  campusId?: string;
  onSelect: (student: Student) => void;
}) {
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
      const res = await getStudents({ search: q, campus_id: campusId, limit: 10 });
      setResults(res.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [campusId]);

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
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
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
          placeholder="Search by name or student number…"
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
  const { field_type, options, name } = field;

  // Strip the first option if it's a negative-number penalty marker (not selectable)
  const isPenaltyMarker = (opt: string) => !isNaN(parseFloat(opt)) && parseFloat(opt) < 0;
  const visibleOptions = (options ?? []).filter((opt, idx) => !(idx === 0 && isPenaltyMarker(opt)));

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
        <label htmlFor={`chk-${field.id}`} className="text-sm cursor-pointer">Yes</label>
      </div>
    );
  }

  if (field_type === 'select') {
    return (
      <Select value={value || '__na__'} onValueChange={(v) => onChange(v === '__na__' ? '' : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__na__">N/A</SelectItem>
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
// Main Page
// ---------------------------------------------------------------------------

export default function AddReferralPage() {
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

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
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
  }, [schoolId]);

  async function fetchFields() {
    setLoadingFields(true);
    try {
      const res = await getDisciplineFields(schoolId);
      setFields(res.data ?? []);
    } catch {
      toast.error('Failed to load referral form fields');
    } finally {
      setLoadingFields(false);
    }
  }

  function setFieldValue(fieldId: string, value: any) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function getStudentDisplayName(s: Student) {
    if (s.profile) {
      const p = s.profile as any;
      return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || s.student_number;
    }
    return s.student_number;
  }

  async function handleSubmit() {
    if (!selectedStudent) {
      toast.error('Please select a student');
      return;
    }
    if (!schoolId) {
      toast.error('School not found');
      return;
    }

    // use campus from context if available, otherwise fall back to whatever is
    // recorded on the student profile; if neither exists we can't create a
    // referral because the campus is required for filtering and reporting.
    const campusToUse =
      campusId || selectedStudent.campus_id || null;

    if (!campusToUse) {
      toast.error('Student has no campus assigned; please update their record');
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

      toast.success('Referral added successfully');
      setSuccess(true);
      // Reset form
      setSelectedStudent(null);
      setIncidentDate(new Date().toISOString().slice(0, 10));
      setFieldValues({});
    } catch {
      toast.error('Failed to add referral');
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
            Add Referral
          </h1>
          <p className="text-muted-foreground mt-1">
            Record a new discipline incident for a student.
            {campusId && (
              <span className="ml-1 text-xs">
                (Campus: {campusCtx?.selectedCampus?.name})
              </span>
            )}
          </p>
        </div>

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-700" />
            <AlertDescription className="text-green-800">
              Referral submitted successfully. You can add another referral below.
            </AlertDescription>
          </Alert>
        )}

        {/* Main form */}
        {!schoolId && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Please select a school in the top navigation before creating a referral.
              If you're a super‑admin, choosing any campus will also establish the
              school context.
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Student selector */}
            <div className="space-y-1.5">
              <Label>Student <span className="text-destructive">*</span></Label>
              {selectedStudent ? (
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
                      Change
                    </Button>
                  </div>
                  {selectedStudent.campus_id && campusId && selectedStudent.campus_id !== campusId ? (
                    <p className="text-sm text-yellow-700">
                      Student is assigned to a different campus&nbsp;({selectedStudent.campus_id}).
                    </p>
                  ) : !selectedStudent.campus_id && !campusId ? (
                    <p className="text-sm text-red-700">
                      No campus selected. Please select a campus before creating a referral.
                    </p>
                  ) : null}
                </div>
              ) : (
                <StudentSearch
                  campusId={campusId}
                  onSelect={setSelectedStudent}
                />
              )}
            </div>

            {/* Incident Date */}
            <div className="space-y-1.5">
              <Label>Incident Date <span className="text-destructive">*</span></Label>
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
                Loading fields…
              </div>
            ) : fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom fields configured. Go to{' '}
                <a href="/admin/discipline/referral-form" className="underline">
                  Referral Form Setup
                </a>{' '}
                to add fields.
              </p>
            ) : (
              fields.map((field, idx) => (
                <div key={field.id}>
                  {idx > 0 && <hr className="my-4 border-t" />}
                  <div className="space-y-1.5">
                    <Label>{field.name}</Label>
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
          <Button onClick={handleSubmit} disabled={submitting || !selectedStudent}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 mr-2" />
                Add Referral for Selected Student
              </>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
}
