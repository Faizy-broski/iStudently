"use client";

import { PrintInfoResponse, StudentPrintInfo } from "@/lib/api/students";
import { format } from "date-fns";
import Image from "next/image";

interface StudentInfoPrintReportProps {
  data: PrintInfoResponse;
  selectedCategories: string[];
}

// Standard field definitions for each category
const STANDARD_FIELDS: Record<string, { id: string; label: string; getValue: (student: StudentPrintInfo) => string | null }[]> = {
  personal: [
    { id: 'first_name', label: 'First Name', getValue: (s) => s.profile.first_name },
    { id: 'father_name', label: "Father's Name", getValue: (s) => s.profile.father_name },
    { id: 'grandfather_name', label: "Grandfather's Name", getValue: (s) => s.profile.grandfather_name },
    { id: 'last_name', label: 'Surname', getValue: (s) => s.profile.last_name },
    { id: 'email', label: 'Email', getValue: (s) => s.profile.email },
    { id: 'phone', label: 'Phone', getValue: (s) => s.profile.phone },
    { id: 'gender', label: 'Gender', getValue: (s) => s.custom_fields?.personal?.gender || '' },
    { id: 'date_of_birth', label: 'Date of Birth', getValue: (s) => {
      const dob = s.custom_fields?.personal?.date_of_birth || s.custom_fields?.personal?.dateOfBirth;
      return dob ? format(new Date(dob), 'MMM dd, yyyy') : '';
    }},
    { id: 'address', label: 'Address', getValue: (s) => s.custom_fields?.personal?.address || '' },
  ],
  academic: [
    { id: 'student_number', label: 'Student ID', getValue: (s) => s.student_number },
    { id: 'grade_level', label: 'Grade Level', getValue: (s) => s.academic.grade_level },
    { id: 'section', label: 'Section', getValue: (s) => s.academic.section },
    { id: 'admission_date', label: 'Admission Date', getValue: (s) => {
      const date = s.academic.admission_date || s.custom_fields?.academic?.admissionDate;
      return date ? format(new Date(date), 'MMM dd, yyyy') : '';
    }},
    { id: 'previous_school', label: 'Previous School', getValue: (s) => {
      const history = s.custom_fields?.academic?.previousSchoolHistory;
      return history?.schoolName || '';
    }},
  ],
  medical: [
    { id: 'blood_group', label: 'Blood Group', getValue: (s) => s.custom_fields?.medical?.bloodGroup || s.medical_info?.blood_group || '' },
    { id: 'allergies', label: 'Allergies', getValue: (s) => {
      const allergies = s.custom_fields?.medical?.allergiesList || s.medical_info?.allergies || [];
      return Array.isArray(allergies) ? allergies.join(', ') : allergies;
    }},
    { id: 'medical_notes', label: 'Medical Notes', getValue: (s) => s.custom_fields?.medical?.medicalNotes || s.medical_info?.emergency_notes || '' },
    { id: 'conditions', label: 'Medical Conditions', getValue: (s) => {
      const conditions = s.medical_info?.conditions || [];
      return Array.isArray(conditions) ? conditions.join(', ') : conditions;
    }},
    { id: 'medications', label: 'Medications', getValue: (s) => {
      const medications = s.medical_info?.medications || [];
      return Array.isArray(medications) ? medications.join(', ') : medications;
    }},
  ],
  family: [
    { id: 'parent_info', label: 'Parent/Guardian', getValue: (s) => {
      if (!s.parent_links || s.parent_links.length === 0) return '';
      const parent = s.parent_links[0];
      const profile = parent?.parent?.profile;
      if (!profile) return '';
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }},
    { id: 'parent_phone', label: 'Parent Phone', getValue: (s) => {
      if (!s.parent_links || s.parent_links.length === 0) return '';
      return s.parent_links[0]?.parent?.profile?.phone || '';
    }},
    { id: 'parent_email', label: 'Parent Email', getValue: (s) => {
      if (!s.parent_links || s.parent_links.length === 0) return '';
      return s.parent_links[0]?.parent?.profile?.email || '';
    }},
    { id: 'relationship', label: 'Relationship', getValue: (s) => {
      if (!s.parent_links || s.parent_links.length === 0) return '';
      return s.parent_links[0]?.relation_type || s.parent_links[0]?.relationship || '';
    }},
    { id: 'emergency_contacts', label: 'Emergency Contacts', getValue: (s) => {
      const contacts = s.custom_fields?.family?.emergencyContacts || [];
      if (!Array.isArray(contacts) || contacts.length === 0) return '';
      return contacts.map((c: { name?: string; relationship?: string; phone?: string }) => `${c.name || ''} (${c.relationship || ''}): ${c.phone || ''}`).join('; ');
    }},
  ],
  system: [
    { id: 'student_number', label: 'Student ID / Roll Number', getValue: (s) => s.student_number },
    { id: 'username', label: 'Username', getValue: (s) => s.custom_fields?.system?.username || '' },
    { id: 'status', label: 'Status', getValue: (s) => s.profile.is_active ? 'Active' : 'Inactive' },
    { id: 'created_at', label: 'Registration Date', getValue: (s) => format(new Date(s.created_at), 'MMM dd, yyyy') },
  ],
};

// Get category display name
function getCategoryName(categoryId: string, categories: { id: string; name: string }[]): string {
  const found = categories.find(c => c.id === categoryId);
  if (found) return found.name;
  
  // Fallback names
  const fallbacks: Record<string, string> = {
    personal: 'Personal Information',
    academic: 'Academic Information',
    medical: 'Medical Information',
    family: 'Family & Emergency',
    system: 'System Information',
    services: 'Services',
  };
  
  return fallbacks[categoryId] || categoryId;
}

// Render custom field value
function renderCustomFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ') || '-';
  if (typeof value === 'object') {
    // Handle date objects or other complex types
    if (value instanceof Date) return format(value, 'MMM dd, yyyy');
    return JSON.stringify(value);
  }
  return String(value);
}

// Get custom fields for a category
function getCustomFieldsForCategory(student: StudentPrintInfo, categoryId: string): { label: string; value: string }[] {
  const categoryData = student.custom_fields?.[categoryId];
  if (!categoryData || typeof categoryData !== 'object') return [];
  
  const standardFieldIds = STANDARD_FIELDS[categoryId]?.map(f => f.id) || [];
  
  return Object.entries(categoryData)
    .filter(([key]) => !standardFieldIds.includes(key))
    .map(([key, value]) => ({
      label: key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      value: renderCustomFieldValue(value)
    }));
}

export function StudentInfoPrintReport({ data, selectedCategories }: StudentInfoPrintReportProps) {
  const { students, categories, campus } = data;
  
  return (
    <div className="print-report bg-white">
      {students.map((student, studentIndex) => (
        <div key={student.id}>
          {selectedCategories.map((categoryId, categoryIndex) => {
            const isFirstPage = studentIndex === 0 && categoryIndex === 0;
            const standardFields = STANDARD_FIELDS[categoryId] || [];
            const customFields = getCustomFieldsForCategory(student, categoryId);
            
            return (
              <div
                key={`${student.id}-${categoryId}`}
                className={`${!isFirstPage ? 'page-break' : ''} p-6`}
                style={{ minHeight: '100vh' }}
              >
                {/* Page Header */}
                <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                  <div>
                    {campus && (
                      <h1 className="text-xl font-bold text-gray-800">{campus.name}</h1>
                    )}
                    <p className="text-sm text-gray-600">Student Information Report</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      Generated: {format(new Date(), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500">
                      Page {categoryIndex + 1} of {selectedCategories.length}
                    </p>
                  </div>
                </div>
                
                {/* Student Header with Photo */}
                <div className="flex items-start gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
                  {/* Student Photo */}
                  <div className="shrink-0">
                    {student.profile.profile_photo_url ? (
                      <div className="w-24 h-28 relative rounded border-2 border-gray-300 overflow-hidden">
                        <Image
                          src={student.profile.profile_photo_url}
                          alt={`${student.profile.first_name} ${student.profile.last_name}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-28 rounded border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-100">
                        <span className="text-4xl text-gray-400">
                          {student.profile.first_name?.charAt(0) || 'S'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Student Basic Info */}
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-800">
                      {student.profile.first_name} {student.profile.father_name && `${student.profile.father_name} `}
                      {student.profile.last_name}
                    </h2>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <span className="text-xs text-gray-500 block">Student ID</span>
                        <span className="font-medium">{student.student_number}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">Grade</span>
                        <span className="font-medium">{student.academic.grade_level || '-'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block">Section</span>
                        <span className="font-medium">{student.academic.section || '-'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="shrink-0">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      student.profile.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {student.profile.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                {/* Category Title */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2">
                    {getCategoryName(categoryId, categories)}
                  </h3>
                </div>
                
                {/* Category Fields */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {/* Standard Fields */}
                  {standardFields.map((field) => {
                    const value = field.getValue(student);
                    if (!value) return null;
                    
                    return (
                      <div key={field.id} className="border-b border-gray-100 pb-2">
                        <span className="text-xs text-gray-500 block">{field.label}</span>
                        <span className="font-medium text-gray-800">{value || '-'}</span>
                      </div>
                    );
                  })}
                  
                  {/* Custom Fields for this category */}
                  {customFields.map((field, idx) => (
                    <div key={idx} className="border-b border-gray-100 pb-2">
                      <span className="text-xs text-gray-500 block">{field.label}</span>
                      <span className="font-medium text-gray-800">{field.value}</span>
                    </div>
                  ))}
                </div>
                
                {/* Special handling for Family category - show all parents */}
                {categoryId === 'family' && student.parent_links && student.parent_links.length > 1 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Parents/Guardians</h4>
                    <div className="space-y-3">
                      {student.parent_links.slice(1).map((link, idx) => (
                        <div key={idx} className="grid grid-cols-4 gap-4 p-3 bg-gray-50 rounded">
                          <div>
                            <span className="text-xs text-gray-500 block">Name</span>
                            <span className="font-medium">
                              {link.parent?.profile?.first_name} {link.parent?.profile?.last_name}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Relationship</span>
                            <span className="font-medium">{link.relation_type || link.relationship}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Phone</span>
                            <span className="font-medium">{link.parent?.profile?.phone || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Email</span>
                            <span className="font-medium">{link.parent?.profile?.email || '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Page Footer */}
                <div className="absolute bottom-6 left-6 right-6 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Student: {student.profile.first_name} {student.profile.last_name} ({student.student_number})</span>
                    <span>
                      {getCategoryName(categoryId, categories)} - Confidential
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print-report {
            font-size: 12pt;
          }
          .page-break {
            page-break-before: always;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
