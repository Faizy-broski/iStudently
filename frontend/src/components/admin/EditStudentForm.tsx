"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { type Student, updateStudent } from "@/lib/api/students";

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

const tabs = [
  { id: 'personal', label: 'Personal' },
  { id: 'academic', label: 'Academic' },
  { id: 'medical', label: 'Medical' },
  { id: 'emergency', label: 'Emergency' }
];

export function EditStudentForm({ student, onSuccess, onCancel }: EditStudentFormProps) {
  const { user } = useAuth();
  const campusContext = useCampus();
  const [activeTab, setActiveTab] = useState('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      personal: 'Personal Information',
      academic: 'Academic Information', 
      medical: 'Medical Information',
      emergency: 'Emergency Contacts'
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
        toast.success('Student updated successfully!');
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to update student');
      }
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('Failed to update student');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#022172]">
            Edit Student: {student.profile?.first_name} {student.profile?.last_name}
          </h2>
          <p className="text-gray-600">Student Number: {student.student_number}</p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </div>

      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#022172]">
            Step {currentTabIndex + 1} of {tabs.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {getStepTitle()}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
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
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172]">Personal Information</CardTitle>
              <CardDescription>Student's personal details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="First Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Last Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Email"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Phone"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Address"
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
              <CardTitle className="text-[#022172]">Academic Information</CardTitle>
              <CardDescription>Student's academic details and school history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="studentNumber">Student Number *</Label>
                  <Input
                    id="studentNumber"
                    value={formData.studentNumber}
                    onChange={(e) => handleInputChange('studentNumber', e.target.value)}
                    placeholder="Student Number"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="gradeLevel">Grade Level</Label>
                  <Select value={formData.gradeLevel} onValueChange={(value) => handleInputChange('gradeLevel', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Grade 9">Grade 9</SelectItem>
                      <SelectItem value="Grade 10">Grade 10</SelectItem>
                      <SelectItem value="Grade 11">Grade 11</SelectItem>
                      <SelectItem value="Grade 12">Grade 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="Username"
                  />
                </div>
                <div>
                  <Label htmlFor="admissionDate">Admission Date</Label>
                  <Input
                    id="admissionDate"
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => handleInputChange('admissionDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="previousSchool">Previous School</Label>
                  <Input
                    id="previousSchool"
                    value={formData.previousSchool}
                    onChange={(e) => handleInputChange('previousSchool', e.target.value)}
                    placeholder="Previous School Name"
                  />
                </div>
                <div>
                  <Label htmlFor="lastGrade">Last Grade Completed</Label>
                  <Input
                    id="lastGrade"
                    value={formData.lastGrade}
                    onChange={(e) => handleInputChange('lastGrade', e.target.value)}
                    placeholder="Last Grade"
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
              <CardTitle className="text-[#022172]">Medical Information</CardTitle>
              <CardDescription>Student's health and medical details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bloodGroup">Blood Group</Label>
                  <Select value={formData.bloodGroup} onValueChange={(value) => handleInputChange('bloodGroup', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select blood group" />
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
                  <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                  <Input
                    id="allergies"
                    value={formData.allergies}
                    onChange={(e) => handleInputChange('allergies', e.target.value)}
                    placeholder="e.g., Peanuts, Dust"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="medicalNotes">Medical Notes</Label>
                  <Textarea
                    id="medicalNotes"
                    value={formData.medicalNotes}
                    onChange={(e) => handleInputChange('medicalNotes', e.target.value)}
                    placeholder="Medical notes and conditions"
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
              <CardTitle className="text-[#022172]">Emergency Contact</CardTitle>
              <CardDescription>Primary emergency contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyName">Contact Name</Label>
                  <Input
                    id="emergencyName"
                    value={formData.emergencyName}
                    onChange={(e) => handleInputChange('emergencyName', e.target.value)}
                    placeholder="Emergency contact name"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyRelation">Relationship</Label>
                  <Input
                    id="emergencyRelation"
                    value={formData.emergencyRelation}
                    onChange={(e) => handleInputChange('emergencyRelation', e.target.value)}
                    placeholder="e.g., Father, Mother, Guardian"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyPhone">Phone Number</Label>
                  <Input
                    id="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                    placeholder="Emergency contact phone"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="emergencyAddress">Address</Label>
                  <Textarea
                    id="emergencyAddress"
                    value={formData.emergencyAddress}
                    onChange={(e) => handleInputChange('emergencyAddress', e.target.value)}
                    placeholder="Emergency contact address"
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
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          ) : (
            <Button 
              type="button"
              onClick={handleNext}
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}