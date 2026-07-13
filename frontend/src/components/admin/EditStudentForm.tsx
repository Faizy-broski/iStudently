"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TagsInput } from "@/components/ui/tags-input";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Save, Loader2, User, GraduationCap, Heart, Shield, ListPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { type Student, updateStudent } from "@/lib/api/students";
import { getFieldDefinitions, type CustomFieldDefinition } from "@/lib/api/custom-fields";
import { useTranslations } from "next-intl";
import { useGradeLevels } from "@/hooks/useAcademics";
import { StudentPhotoUpload } from "@/components/ui/student-photo-upload";

// Helper: Calculate exact age in years, months and days from a date string (YYYY-MM-DD)
function calculateAge(dateStr: string): { years: number; months: number; days: number } | null {
  if (!dateStr) return null;
  const birthDate = new Date(dateStr);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

interface EditStudentFormProps {
  student: Student;
  onSuccess: () => void;
  onCancel: () => void;
}

interface FormData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  studentPhoto: string;

  studentNumber: string;
  gradeLevel: string;
  username: string;
  admissionDate: string;
  previousSchool: string;
  lastGrade: string;

  // Medical Information
  bloodGroup: string;
  allergies: string;
  medicalNotes: string;

  // Emergency Contact
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  emergencyAddress: string;
}

export function EditStudentForm({ student, onSuccess, onCancel }: EditStudentFormProps) {
  const t = useTranslations("school.students.edit_student");
  const tFields = useTranslations("school.students.fields");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const campusContext = useCampus();
  const [activeTab, setActiveTab] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { gradeLevels } = useGradeLevels();

  // Admin-defined custom field definitions + their current values (keyed by
  // category_id -> field_key), seeded from the student's existing custom_fields
  // so any category/key not covered by the hardcoded inputs below survives a save.
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, Record<string, any>>>(
    () => JSON.parse(JSON.stringify(student.custom_fields ?? {}))
  );

  useEffect(() => {
    getFieldDefinitions('student', campusContext?.selectedCampus?.id).then((res) => {
      if (res.success && res.data) setCustomFieldDefs(res.data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusContext?.selectedCampus?.id]);

  const updateCustomFieldValue = (categoryId: string, fieldKey: string, value: any) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [categoryId]: { ...prev[categoryId], [fieldKey]: value },
    }));
  };

  const KNOWN_CATEGORIES = ['personal', 'academic', 'medical', 'family'];
  const extraCategoryIds = Array.from(
    new Set(customFieldDefs.filter(f => !KNOWN_CATEGORIES.includes(f.category_id)).map(f => f.category_id))
  );

  const renderCustomFieldInput = (field: CustomFieldDefinition) => {
    const value = customFieldValues[field.category_id]?.[field.field_key];
    const onChange = (val: any) => updateCustomFieldValue(field.category_id, field.field_key, val);

    switch (field.type) {
      case "long-text":
        return <Textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} />;
      case "number":
        return <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
      case "date":
        return (
          <DatePicker
            value={value ? new Date(value) : undefined}
            onChange={(date) => onChange(date?.toISOString())}
            placeholder={`Select ${field.label}`}
          />
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox checked={!!value} onCheckedChange={(checked) => onChange(!!checked)} />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      case "select":
        return (
          <Select value={value || ""} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "multi-select":
        return <TagsInput value={value || []} onChange={onChange} placeholder={`Add ${field.label}`} />;
      case "file":
        return <Input type="url" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={`Enter URL for ${field.label}`} />;
      case "text":
      default:
        return <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  const renderCustomFieldsForCategory = (categoryId: string) => {
    const fields = customFieldDefs.filter(f => f.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order);
    if (fields.length === 0) return null;
    return (
      <>
        <Separator />
        <div>
          <Label className="text-sm font-semibold text-[#022172] dark:text-white">Custom Fields</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {fields.map(field => (
              <div key={field.id} className={field.type === 'long-text' ? 'md:col-span-2' : ''}>
                {field.type !== 'checkbox' && (
                  <Label>{field.label}{field.required && <span className="text-red-500"> *</span>}</Label>
                )}
                {renderCustomFieldInput(field)}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  const tabs = [
    { id: 'personal', label: t("personal_info"), icon: User },
    { id: 'academic', label: t("academic_info"), icon: GraduationCap },
    { id: 'medical', label: t("medical_info"), icon: Heart },
    { id: 'emergency', label: t("emergency_contacts"), icon: Shield },
    ...(extraCategoryIds.length > 0 ? [{ id: 'custom', label: 'Custom Fields', icon: ListPlus }] : []),
  ];

  // Initialize form data with student information
  const [formData, setFormData] = useState<FormData>({
    firstName: student.profile?.first_name || '',
    lastName: student.profile?.last_name || '',
    email: student.profile?.email || '',
    phone: student.profile?.phone || '',
    gender: student.custom_fields?.personal?.gender || '',
    dateOfBirth: student.custom_fields?.personal?.date_of_birth ?
      new Date(student.custom_fields.personal.date_of_birth).toISOString().split('T')[0] : '',
    address: student.custom_fields?.personal?.address || '',
studentPhoto: student.profile?.profile_photo_url || student.custom_fields?.personal?.student_photo || '',
    studentNumber: student.student_number || '',
    gradeLevel: student.grade_level || '',
    username: student.custom_fields?.system?.username || '',
    admissionDate: student.custom_fields?.academic?.admission_date ?
      new Date(student.custom_fields.academic.admission_date).toISOString().split('T')[0] : '',
    previousSchool: student.custom_fields?.academic?.previous_school?.schoolName || '',
    lastGrade: student.custom_fields?.academic?.previous_school?.lastGradeCompleted || '',

    bloodGroup: student.medical_info?.blood_group || '',
    allergies: student.medical_info?.allergies?.join(', ') || '',
    medicalNotes: student.medical_info?.emergency_notes || '',

    emergencyName: student.custom_fields?.family?.emergency_contacts?.[0]?.name || '',
    emergencyRelation: student.custom_fields?.family?.emergency_contacts?.[0]?.relationship || '',
    emergencyPhone: student.custom_fields?.family?.emergency_contacts?.[0]?.phone || '',
    emergencyAddress: student.custom_fields?.family?.emergency_contacts?.[0]?.address || '',
  });

  const currentTabIndex = tabs.findIndex(tab => tab.id === activeTab);
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === tabs.length - 1;

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (!isLastTab) {
      setActiveTab(tabs[currentTabIndex + 1].id);
    }
  };

  const handlePrevious = () => {
    if (!isFirstTab) {
      setActiveTab(tabs[currentTabIndex - 1].id);
    }
  };

  const getStepTitle = () => {
    const titles: Record<string, string> = {
      personal: t("personal_info"),
      academic: t("academic_info"),
      medical: t("medical_info"),
      emergency: t("emergency_contacts"),
      custom: 'Custom Fields',
    };
    return titles[activeTab] || '';
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const updateData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        student_number: formData.studentNumber,
        grade_level: formData.gradeLevel,
        username: formData.username || undefined,
        // Start from the preserved custom_fields (original values + any admin-defined
        // custom field edits) and only overlay the keys this form has dedicated inputs
        // for. Overwriting with just the hardcoded shape would silently wipe out any
        // category/key not covered here, since the backend replaces custom_fields wholesale.
        custom_fields: {
          ...customFieldValues,
          personal: {
            ...customFieldValues.personal,
            gender: formData.gender,
            date_of_birth: formData.dateOfBirth,
            address: formData.address,
            student_photo: formData.studentPhoto,
          },
          academic: {
            ...customFieldValues.academic,
            admission_date: formData.admissionDate,
            previous_school: {
              schoolName: formData.previousSchool,
              lastGradeCompleted: formData.lastGrade,
            },
          },
          system: {
            ...customFieldValues.system,
            username: formData.username,
          },
          family: {
            ...customFieldValues.family,
            emergency_contacts: [{
              name: formData.emergencyName,
              relationship: formData.emergencyRelation,
              phone: formData.emergencyPhone,
              address: formData.emergencyAddress,
            }]
          }
        },
        medical_info: {
          blood_group: formData.bloodGroup,
          allergies: formData.allergies.split(',').map(a => a.trim()).filter(Boolean),
          emergency_notes: formData.medicalNotes,
        }
      };

      const result = await updateStudent(student.id, updateData, campusContext?.selectedCampus?.id);
      if (result.success) {
        toast.success(t("msg_update_success"));
        onSuccess();
      } else {
        toast.error(result.error || t("msg_update_failed"));
      }
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error(t("msg_update_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#022172] dark:text-white">
            {t("title")}: {student.profile?.first_name} {student.profile?.last_name}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">{t("student_number")}: {student.student_number}</p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          <ArrowLeft className="mr-2 h-4 w-4 rtl:rotate-180 rtl:ml-2 rtl:mr-0" />
          {tCommon("back")}
        </Button>
      </div>

      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#022172] dark:text-gray-200">
            {t("step_of", { current: currentTabIndex + 1, total: tabs.length })}
          </span>
          <span className="text-sm text-muted-foreground">
            {getStepTitle()}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-[#57A3CC] to-[#022172] h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentTabIndex + 1) / tabs.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <tab.icon className="h-4 w-4 hidden sm:inline" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172] dark:text-white">{t("personal_info")}</CardTitle>
              <CardDescription>{t("personal_info_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="md:col-span-2">
                <Label>{tFields("student_photo")}</Label>
                <StudentPhotoUpload
                  value={formData.studentPhoto}
                  onChange={(url) => handleInputChange('studentPhoto', url)}
                  schoolId={student.school_id}
                  label={tCommon("click_to_upload")}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">{tFields("first_name")} *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder={tFields("first_name")}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{tFields("last_name")} *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder={tFields("last_name")}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">{tFields("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder={tFields("email")}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{tFields("phone_number")}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder={tFields("phone_number")}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">{tFields("gender")}</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("select_gender")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{tCommon("male")}</SelectItem>
                      <SelectItem value="female">{tCommon("female")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dateOfBirth">{tFields("date_of_birth")}</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  />
                  {formData.dateOfBirth && (() => {
                    const age = calculateAge(formData.dateOfBirth);
                    return age ? (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#022172]/8 dark:bg-[#57A3CC]/15 px-2.5 py-0.5 text-xs font-medium text-[#022172] dark:text-[#57A3CC] border border-[#022172]/15 dark:border-[#57A3CC]/25">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                          {age.years} {t("years")} {age.months} {t("months")} {age.days} {t("days")}
                        </span>
                        <span className="text-xs text-muted-foreground">{t("age")}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">{tFields("address")}</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder={tFields("address")}
                    rows={2}
                  />
                </div>
              </div>
              {renderCustomFieldsForCategory('personal')}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Academic Information Tab */}
        <TabsContent value="academic" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172] dark:text-white">{t("academic_info")}</CardTitle>
              <CardDescription>{t("academic_info_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="studentNumber">{tFields("student_number")} *</Label>
                  <Input
                    id="studentNumber"
                    value={formData.studentNumber}
                    onChange={(e) => handleInputChange('studentNumber', e.target.value)}
                    placeholder={tFields("student_number")}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="gradeLevel">{tFields("grade_level")}</Label>
                  <Select value={formData.gradeLevel} onValueChange={(value) => handleInputChange('gradeLevel', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("select_grade")} />
                    </SelectTrigger>
                    <SelectContent>
                      {gradeLevels.map((grade) => (
                        <SelectItem key={grade.id} value={grade.name}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="username">{tFields("username")}</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder={tFields("username")}
                  />
                </div>
                <div>
                  <Label htmlFor="admissionDate">{tFields("admission_date")}</Label>
                  <Input
                    id="admissionDate"
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => handleInputChange('admissionDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="previousSchool">{tFields("previous_school")}</Label>
                  <Input
                    id="previousSchool"
                    value={formData.previousSchool}
                    onChange={(e) => handleInputChange('previousSchool', e.target.value)}
                    placeholder={tFields("previous_school")}
                  />
                </div>
                <div>
                  <Label htmlFor="lastGrade">{tFields("last_grade_completed")}</Label>
                  <Input
                    id="lastGrade"
                    value={formData.lastGrade}
                    onChange={(e) => handleInputChange('lastGrade', e.target.value)}
                    placeholder={tFields("last_grade_completed")}
                  />
                </div>
              </div>
              {renderCustomFieldsForCategory('academic')}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medical Information Tab */}
        <TabsContent value="medical" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172] dark:text-white">{t("medical_info")}</CardTitle>
              <CardDescription>{t("medical_info_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bloodGroup">{tFields("blood_group")}</Label>
                  <Select value={formData.bloodGroup} onValueChange={(value) => handleInputChange('bloodGroup', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("select_blood_group")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A-</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B-</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O-</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="allergies">{tFields("allergies_list")}</Label>
                  <Input
                    id="allergies"
                    value={formData.allergies}
                    onChange={(e) => handleInputChange('allergies', e.target.value)}
                    placeholder={t("allergies_placeholder")}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="medicalNotes">{tFields("medical_notes")}</Label>
                  <Textarea
                    id="medicalNotes"
                    value={formData.medicalNotes}
                    onChange={(e) => handleInputChange('medicalNotes', e.target.value)}
                    placeholder={t("medical_notes_placeholder")}
                    rows={3}
                  />
                </div>
              </div>
              {renderCustomFieldsForCategory('medical')}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emergency Contacts Tab */}
        <TabsContent value="emergency" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172] dark:text-white">{t("emergency_contacts")}</CardTitle>
              <CardDescription>{t("emergency_contact_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyName">{tCommon("contact_name")}</Label>
                  <Input
                    id="emergencyName"
                    value={formData.emergencyName}
                    onChange={(e) => handleInputChange('emergencyName', e.target.value)}
                    placeholder={t("emergency_name_placeholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyRelation">{tCommon("contact_relationship")}</Label>
                  <Input
                    id="emergencyRelation"
                    value={formData.emergencyRelation}
                    onChange={(e) => handleInputChange('emergencyRelation', e.target.value)}
                    placeholder={t("emergency_relation_placeholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyPhone">{tCommon("contact_phone")}</Label>
                  <Input
                    id="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                    placeholder={t("emergency_phone_placeholder")}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="emergencyAddress">{tFields("address")}</Label>
                  <Textarea
                    id="emergencyAddress"
                    value={formData.emergencyAddress}
                    onChange={(e) => handleInputChange('emergencyAddress', e.target.value)}
                    placeholder={t("emergency_address_placeholder")}
                    rows={2}
                  />
                </div>
              </div>
              {renderCustomFieldsForCategory('family')}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Additional Custom Fields Tab (categories beyond the standard 4) */}
        {extraCategoryIds.length > 0 && (
          <TabsContent value="custom" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-[#022172] dark:text-white">Custom Fields</CardTitle>
                <CardDescription>Additional school-defined fields</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {extraCategoryIds.map(categoryId => (
                  <div key={categoryId}>
                    <Label className="text-sm font-semibold text-[#022172] dark:text-white">
                      {customFieldDefs.find(f => f.category_id === categoryId)?.category_name || categoryId}
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {customFieldDefs
                        .filter(f => f.category_id === categoryId)
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(field => (
                          <div key={field.id} className={field.type === 'long-text' ? 'md:col-span-2' : ''}>
                            {field.type !== 'checkbox' && (
                              <Label>{field.label}{field.required && <span className="text-red-500"> *</span>}</Label>
                            )}
                            {renderCustomFieldInput(field)}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstTab || isSubmitting}
        >
          <ArrowLeft className="mr-2 h-4 w-4 rtl:rotate-180 rtl:ml-2 rtl:mr-0" />
          {tCommon("previous")}
        </Button>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {tCommon("cancel")}
          </Button>

          {/* Save available on every step */}
          <Button
            type="button"
            variant="outline"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="border-[#022172] text-[#022172] dark:text-white hover:bg-[#022172]/5"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("btn_saving")}</>
            ) : (
              <><Save className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />{t("btn_save_changes")}</>
            )}
          </Button>

          {!isLastTab && (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
            >
              {tCommon("next")}
              <ArrowRight className="ml-2 h-4 w-4 rtl:rotate-180 rtl:mr-2 rtl:ml-0" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
