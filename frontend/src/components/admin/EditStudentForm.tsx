"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Save, Loader2, User, GraduationCap, Heart, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { type Student, updateStudent } from "@/lib/api/students";
import { useTranslations } from "next-intl";
import { useGradeLevels } from "@/hooks/useAcademics";

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
  
  // Academic Information
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

  const tabs = [
    { id: 'personal', label: t("personal_info"), icon: User },
    { id: 'academic', label: t("academic_info"), icon: GraduationCap },
    { id: 'medical', label: t("medical_info"), icon: Heart },
    { id: 'emergency', label: t("emergency_contacts"), icon: Shield }
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
      emergency: t("emergency_contacts")
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
        custom_fields: {
          personal: {
            gender: formData.gender,
            date_of_birth: formData.dateOfBirth,
            address: formData.address,
          },
          academic: {
            admission_date: formData.admissionDate,
            previous_school: {
              schoolName: formData.previousSchool,
              lastGradeCompleted: formData.lastGrade,
            },
          },
          system: {
            username: formData.username,
          },
          family: {
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
        <TabsList className="grid w-full grid-cols-4">
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
            </CardContent>
          </Card>
        </TabsContent>
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
          
          {isLastTab ? (
            <Button 
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("btn_saving")}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
                  {t("btn_save_changes")}
                </>
              )}
            </Button>
          ) : (
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