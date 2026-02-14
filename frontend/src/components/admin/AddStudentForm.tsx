"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TagsInput } from "@/components/ui/tags-input";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import { StudentPhotoUpload } from "@/components/ui/student-photo-upload";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { Plus, Trash2, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { createStudent } from "@/lib/api/students";
import { searchParents, createParent, type Parent, type CreateParentDTO } from "@/lib/api/parents";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { generateFeeForNewStudent } from "@/lib/api/fees";
import FeeChallanModal from "@/components/admin/FeeChallanModal";
import * as servicesApi from "@/lib/api/services";
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields";
import { getFieldOrders, getEffectiveFieldOrder, DefaultFieldOrder } from '@/lib/utils/field-ordering';
import {
  StudentFormData,
  Gender,
  BloodGroup,
  StudentStatus,
  EmergencyContact,
  CustomFieldCategory,
  CustomField,
  CustomFieldType,
} from "@/types";

// Zod Validation Schema
const studentSchema = z.object({
  // Personal Information (Required) - 4 Name Fields
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  fatherName: z.string().min(2, "Father's name must be at least 2 characters"),
  grandfatherName: z.string().optional(),
  lastName: z.string().min(2, "Surname/Last name must be at least 2 characters"),
  dateOfBirth: z.date({ message: "Date of birth is required" }),
  gender: z.enum(["male", "female"], { message: "Gender is required" }),

  // Academic Information (Required)
  gradeLevel: z.string().optional(), // Legacy field - not required anymore
  grade_level_id: z.string().min(1, "Grade level is required"),
  section_id: z.string().min(1, "Section is required"),
  admissionDate: z.date({ message: "Admission date is required" }),

  // Medical Information (Required) - Removed N/A
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"], { message: "Blood group is required" }),
  hasAllergies: z.boolean(),
  allergiesList: z.array(z.string()).min(0),

  // Optional fields
  studentId: z.string(),
  username: z.string(),
  password: z.string(),
  status: z.enum(["active", "inactive", "suspended"]),
  studentPhoto: z.string().optional(),
  address: z.string().optional(),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phoneNumber: z.string().optional(),
  previousSchoolHistory: z.object({
    schoolName: z.string(),
    transferDate: z.string(),
    lastGradeCompleted: z.string(),
  }),
  medicalNotes: z.string(),
  linkedParentId: z.string(),
  parentRelationType: z.enum(["father", "mother", "guardian", "other"]),
  emergencyContacts: z.array(z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string(),
    address: z.string(),
  })),
});

// Standard Field Definitions with Sort Orders for Students
const STANDARD_FIELDS = [
  // PERSONAL INFORMATION (Category: personal)
  { id: 'firstName', label: 'First Name', type: 'text', category: 'personal', sort_order: 1, required: true, width: 'half' },
  { id: 'fatherName', label: "Father's Name", type: 'text', category: 'personal', sort_order: 2, required: true, width: 'half' },
  { id: 'grandfatherName', label: "Grandfather's Name", type: 'text', category: 'personal', sort_order: 3, required: false, width: 'half' },
  { id: 'lastName', label: 'Surname', type: 'text', category: 'personal', sort_order: 4, required: true, width: 'half' },
  { id: 'dateOfBirth', label: 'Date of Birth', type: 'date', category: 'personal', sort_order: 5, required: true, width: 'half' },
  { id: 'gender', label: 'Gender', type: 'select', category: 'personal', sort_order: 6, required: true, width: 'half', options: ['male', 'female'] },
  { id: 'studentPhoto', label: 'Student Photo', type: 'photo', category: 'personal', sort_order: 7, required: false, width: 'full' },
  { id: 'address', label: 'Address', type: 'textarea', category: 'personal', sort_order: 8, required: false, width: 'full' },
  { id: 'email', label: 'Email', type: 'email', category: 'personal', sort_order: 9, required: true, width: 'half' },
  { id: 'phoneNumber', label: 'Phone Number', type: 'text', category: 'personal', sort_order: 10, required: false, width: 'half' },

  // ACADEMIC INFORMATION (Category: academic)
  { id: 'grade_level_id', label: 'Grade Level', type: 'grade_select', category: 'academic', sort_order: 1, required: true, width: 'half' },
  { id: 'section_id', label: 'Section', type: 'section_select', category: 'academic', sort_order: 2, required: true, width: 'half' },
  { id: 'admissionDate', label: 'Admission Date', type: 'date', category: 'academic', sort_order: 3, required: true, width: 'half' },
  { id: 'previousSchoolHistory', label: 'Previous School History', type: 'school_history', category: 'academic', sort_order: 4, required: false, width: 'full' },

  // MEDICAL INFORMATION (Category: medical)
  { id: 'bloodGroup', label: 'Blood Group', type: 'select', category: 'medical', sort_order: 1, required: true, width: 'half', options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
  { id: 'hasAllergies', label: 'Has Allergies?', type: 'checkbox', category: 'medical', sort_order: 2, required: false, width: 'half' },
  { id: 'allergiesList', label: 'Allergies List', type: 'tags', category: 'medical', sort_order: 3, required: false, width: 'full' },
  { id: 'medicalNotes', label: 'Medical Notes', type: 'textarea', category: 'medical', sort_order: 4, required: false, width: 'full' },

  // FAMILY & EMERGENCY (Category: family)
  { id: 'linkedParentId', label: 'Link to Parent', type: 'parent_search', category: 'family', sort_order: 1, required: false, width: 'full' },
  { id: 'parentRelationType', label: 'Relationship Type', type: 'select', category: 'family', sort_order: 2, required: false, width: 'half', options: ['father', 'mother', 'guardian', 'other'] },
  { id: 'emergencyContacts', label: 'Emergency Contacts', type: 'emergency_contacts', category: 'family', sort_order: 3, required: false, width: 'full' },

  // SERVICES (Category: services)
  { id: 'selectedServices', label: 'School Services', type: 'service_select', category: 'services', sort_order: 1, required: false, width: 'full' },

  // SYSTEM (Category: system)
  { id: 'studentId', label: 'Student ID / Roll Number', type: 'text', category: 'system', sort_order: 1, required: false, width: 'half' },
  { id: 'username', label: 'Username', type: 'text', category: 'system', sort_order: 2, required: false, width: 'half' },
  { id: 'password', label: 'Password (Default)', type: 'text', category: 'system', sort_order: 3, required: false, width: 'half' },
  { id: 'status', label: 'Status', type: 'select', category: 'system', sort_order: 4, required: false, width: 'half', options: ['active', 'inactive', 'suspended'] },
];

interface AddStudentFormProps {
  onSuccess: () => void;
}

export function AddStudentForm({ onSuccess }: AddStudentFormProps) {
  const { profile } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;
  
  // API-based custom fields (replacing localStorage approach)
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [defaultFieldOrders, setDefaultFieldOrders] = useState<DefaultFieldOrder[]>([]);
  const [orderedStandardFields, setOrderedStandardFields] = useState(STANDARD_FIELDS);
  const [activeTab, setActiveTab] = useState("personal");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Keep for backward compatibility if needed
  const [customFieldTemplates, setCustomFieldTemplates] = useState<CustomFieldCategory[]>([]);

  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [parentOptions, setParentOptions] = useState<ComboboxOption[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  
  // Use SWR hooks for grades and sections (cached, no refetch on navigation)
  const { gradeLevels: allGrades, loading: isLoadingGrades } = useGradeLevels();
  const { sections: allSections, loading: isLoadingSections } = useSections();
  const [selectedGradeId, setSelectedGradeId] = useState<string>("");
  
  // Filter grades and sections based on active status
  const grades = useMemo(() => 
    allGrades.filter((g) => g.is_active), 
    [allGrades]
  );
  
  // Filter sections by selected grade and available seats
  const sections = useMemo(() => 
    allSections.filter((s) => 
      s.is_active && 
      s.grade_level_id === selectedGradeId && 
      (s.available_seats ?? 0) > 0
    ), 
    [allSections, selectedGradeId]
  );

  // Services State
  const [services, setServices] = useState<servicesApi.SchoolService[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Fee Generation State
  const [generateFirstChallan, setGenerateFirstChallan] = useState(false);
  const [generatedFeeId, setGeneratedFeeId] = useState<string | null>(null);
  const [showChallanModal, setShowChallanModal] = useState(false);
  const [challanDueDate, setChallanDueDate] = useState<string>(() => {
    const nextMonth = new Date();
    nextMonth.setDate(10); // Due on 10th
    if (new Date().getDate() > 5) nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toISOString().split('T')[0];
  });

  // Parent Creation State
  const [showNewParentForm, setShowNewParentForm] = useState(false);
  const [showParentPassword, setShowParentPassword] = useState(false);
  const [newParentData, setNewParentData] = useState<CreateParentDTO & { relationship: string }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    cnic: '',
    occupation: '',
    workplace: '',
    income: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    password: '',
    relationship: 'Father'
  });

  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Load custom fields from API and grades on mount
  useEffect(() => {
    const loadCustomFields = async () => {
      try {
        const [fieldsResponse, ordersResponse] = await Promise.all([
          getFieldDefinitions('student'),
          getFieldOrders('student')
        ]);
        
        // Apply saved default field orders
        if (ordersResponse.success && ordersResponse.data) {
          setDefaultFieldOrders(ordersResponse.data);
          
          // Apply orders to STANDARD_FIELDS
          const orderedFields = STANDARD_FIELDS.map(field => {
            // Get effective order for this field
            const categoryOrders = ordersResponse.data!.filter(o => o.category_id === field.category);
            const savedOrder = categoryOrders.find(o => o.field_label === field.label);
            
            return savedOrder ? { ...field, sort_order: savedOrder.sort_order } : field;
          });
          
          setOrderedStandardFields(orderedFields);
        }
        
        if (fieldsResponse.success && fieldsResponse.data) {
          setCustomFields(fieldsResponse.data);
          
          // Update active tab to the first ordered category
          const categoryOrderMap: Record<string, number> = {};
          fieldsResponse.data.forEach((field: CustomFieldDefinition) => {
            if (field.category_order !== undefined && !categoryOrderMap[field.category_id]) {
              categoryOrderMap[field.category_id] = field.category_order;
            }
          });
          
          const standardCategories = ['personal', 'academic', 'medical', 'family', 'system'];
          let minOrder = Infinity;
          let firstCategory = 'personal';
          
          standardCategories.forEach(cat => {
            const order = categoryOrderMap[cat] || (standardCategories.indexOf(cat) + 1);
            if (order < minOrder) {
              minOrder = order;
              firstCategory = cat;
            }
          });
          
          setActiveTab(firstCategory);
          
          // Clear localStorage templates when API fields load successfully
          // This ensures deleted fields from Supabase don't persist locally
          localStorage.removeItem('student_custom_field_templates');
        }
      } catch (err) {
        console.error("Error loading custom fields", err);
      } finally {
        setLoadingFields(false);
      }
    };

    loadCustomFields();
    fetchServices();

    // NOTE: localStorage templates are deprecated in favor of API-based custom fields
    // Keeping this for backward compatibility during transition, but it will be cleared
    // when API fields load successfully
    try {
      const saved = localStorage.getItem('student_custom_field_templates');
      if (saved) {
        const templates = JSON.parse(saved);
        setCustomFieldTemplates(templates);
      }
    } catch (error) {
      console.error('Error loading custom field templates:', error);
    }
  }, []);

  // Reset section when grade changes (since sections are filtered by useMemo)
  useEffect(() => {
    if (!selectedGradeId) {
      updateFormData("section_id", "");
    }
  }, [selectedGradeId]);

  // Reset grade and section when campus changes
  useEffect(() => {
    if (!selectedCampus?.id) {
      setSelectedGradeId("");
      updateFormData("grade_level_id", "");
      updateFormData("section_id", "");
    }
  }, [selectedCampus?.id]);

  const fetchServices = async () => {
    try {
      const result = await servicesApi.getServices(true, selectedCampus?.id);
      if (result.success && result.data) {
        setServices(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch services:', err);
    }
  };

  // Fetch parents when search query changes
  useEffect(() => {
    const fetchParents = async () => {
      if (parentSearchQuery.length < 2) {
        setParentOptions([]);
        setIsLoadingParents(false);
        return;
      }

      setIsLoadingParents(true);
      try {
        console.log('Searching parents with query:', parentSearchQuery);
        const response = await searchParents(parentSearchQuery);
        console.log('Parent search response:', response);

        if (response.success && response.data) {
          const options: ComboboxOption[] = response.data.map((p: Parent) => {
            const fullName = `${p.profile?.first_name || ''} ${p.profile?.last_name || ''}`.trim();
            const childrenCount = p.children?.length || 0;
            return {
              value: p.id,
              label: fullName || 'N/A',
              subtitle: `${p.profile?.email || 'No email'} • ${childrenCount} children`
            };
          });
          console.log('Parent options created:', options);
          setParentOptions(options);
        } else {
          console.log('No parent data in response');
          setParentOptions([]);
        }
      } catch (error) {
        console.error('Error fetching parents:', error);
        setParentOptions([]);
        toast.error('Failed to search parents');
      } finally {
        setIsLoadingParents(false);
      }
    };

    const debounceTimer = setTimeout(fetchParents, 300);
    return () => clearTimeout(debounceTimer);
  }, [parentSearchQuery]);

  const [formData, setFormData] = useState<StudentFormData>(() => ({
    // System & Identity
    studentId: `JEHZ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    username: "",
    password: Math.random().toString(36).slice(-8),
    status: "active",

    // Personal Information (4 Name Fields)
    firstName: "",
    fatherName: "",
    grandfatherName: "",
    lastName: "",
    dateOfBirth: null,
    gender: null,
    studentPhoto: "",
    address: "",
    email: "",
    phoneNumber: "",

    // Academic Information
    gradeLevel: "",
    grade_level_id: "",
    section_id: "",
    admissionDate: new Date(),
    previousSchoolHistory: {
      schoolName: "",
      transferDate: "",
      lastGradeCompleted: "",
    },

    // Medical Information
    bloodGroup: null,
    hasAllergies: false,
    allergiesList: [],
    medicalNotes: "",

    // Family & Emergency
    linkedParentId: "",
    parentRelationType: "other" as "father" | "mother" | "guardian" | "other",
    emergencyContacts: [],

    // Custom Fields
    customCategories: [],
  }));

  const updateFormData = <K extends keyof StudentFormData>(field: K, value: StudentFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-generate username when first name or last name changes
  useEffect(() => {
    if (formData.firstName && formData.lastName) {
      const username = `${formData.firstName.toLowerCase()}.${formData.lastName.toLowerCase()}`.replace(/\s+/g, '');
      updateFormData("username", username);
    }
  }, [formData.firstName, formData.lastName]);

  const updateNestedField = (parent: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...(prev[parent as keyof StudentFormData] as unknown as Record<string, string>),
        [field]: value,
      },
    }));
  };

  const addEmergencyContact = () => {
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: [
        ...prev.emergencyContacts,
        { name: "", relationship: "", phone: "", address: "" },
      ],
    }));
  };

  const updateEmergencyContact = (index: number, field: keyof EmergencyContact, value: string) => {
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((contact, i) =>
        i === index ? { ...contact, [field]: value } : contact
      ),
    }));
  };

  const removeEmergencyContact = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index),
    }));
  };

  const updateCustomFieldValue = (fieldId: string, value: any) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    try {
      // Validate with Zod
      const validatedData = studentSchema.parse(formData);

      // HANDLE PARENT CREATION/LINKING
      let finalLinkedParentId = formData.linkedParentId;
      let finalRelationType = formData.parentRelationType;

      if (showNewParentForm) {
        // Validate new parent data - CNIC and Address are mandatory
        if (!newParentData.first_name || !newParentData.last_name || !newParentData.relationship) {
          toast.error("Please fill in all required parent fields (First Name, Last Name, Relationship)");
          setIsSubmitting(false);
          return;
        }
        if (!newParentData.cnic) {
          toast.error("Parent CNIC is required");
          setIsSubmitting(false);
          return;
        }
        if (!newParentData.address || !newParentData.city) {
          toast.error("Parent address (Street Address and City) is required");
          setIsSubmitting(false);
          return;
        }

        // Create parent
        try {
          const parentResponse = await createParent({
            ...newParentData
          });
          if (parentResponse.success && parentResponse.data) {
            finalLinkedParentId = parentResponse.data.id;
            finalRelationType = newParentData.relationship.toLowerCase() as any;
            toast.success("Parent profile created successfully");
          } else {
            throw new Error(parentResponse.error || "Failed to create parent profile");
          }
        } catch (err: any) {
          toast.error(err.message);
          setIsSubmitting(false);
          return;
        }
      }

      // Prepare medical info
      const medicalInfo = {
        blood_group: formData.bloodGroup || undefined,
        allergies: formData.hasAllergies ? formData.allergiesList : [],
        notes: formData.medicalNotes || undefined,
      };

      // Prepare emergency contacts
      const emergencyContactsData = formData.emergencyContacts.map(ec => ({
        name: ec.name,
        relationship: ec.relationship,
        phone: ec.phone,
        address: ec.address,
      }));

      // Prepare custom fields from templates
      const customFieldsData: Record<string, any> = {};
      customFieldTemplates.forEach((category) => {
        const categoryData: Record<string, any> = {};
        category.fields.forEach((field) => {
          const value = customFieldValues[field.id];
          if (value !== undefined && value !== null && value !== '') {
            categoryData[field.id] = {
              label: field.label,
              type: field.type,
              value: value,
            };
          }
        });
        if (Object.keys(categoryData).length > 0) {
          customFieldsData[category.id] = {
            name: category.name,
            fields: categoryData,
          };
        }
      });

      // Create student via API
      const response = await createStudent({
        student_number: validatedData.studentId,
        first_name: validatedData.firstName,
        father_name: validatedData.fatherName, // NEW: Father's name
        grandfather_name: formData.grandfatherName || undefined, // NEW: Grandfather's name
        last_name: validatedData.lastName,
        email: validatedData.email || undefined,
        phone: validatedData.phoneNumber || undefined,
        password: formData.password || undefined, // FIX: Send the frontend-generated password to backend
        grade_level: grades.find(g => g.id === validatedData.grade_level_id)?.name || validatedData.gradeLevel || undefined,
        grade_level_id: validatedData.grade_level_id || undefined,
        section_id: validatedData.section_id || undefined,
        campus_id: selectedCampus?.id, // Assign to selected campus
        profile_photo_url: formData.studentPhoto || undefined, // NEW: Supabase storage URL
        medical_info: medicalInfo,
        custom_fields: {
          ...customFieldsData,
          personal: {
            date_of_birth: formData.dateOfBirth?.toISOString(),
            gender: formData.gender,
            address: formData.address,
            student_photo: formData.studentPhoto,
          },
          academic: {
            admission_date: formData.admissionDate?.toISOString(),
            previous_school: formData.previousSchoolHistory,
          },
          family: {
            linked_parent_id: finalLinkedParentId,
            parent_relation_type: finalRelationType,
            emergency_contacts: emergencyContactsData,
          },
          system: {
            username: formData.username,
            status: formData.status,
          },
        },
      });

      if (response.success && response.data) {
        // SUBSCRIBE TO SERVICES if any selected
        if (selectedServices.length > 0) {
          try {
            await servicesApi.subscribeStudentToServices(response.data.id, selectedServices);
            toast.success("Student subscribed to selected services");
          } catch (svcErr) {
            console.error("Service subscription failed:", svcErr);
            toast.warning("Student created but service subscription failed");
          }
        }

        // GENERATE FIRST FEE CHALLAN if enabled
        if (generateFirstChallan && formData.grade_level_id) {
          try {
            const now = new Date();
            const feeMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const academicYear = now.getMonth() >= 3
              ? `${now.getFullYear()}-${now.getFullYear() + 1}`
              : `${now.getFullYear() - 1}-${now.getFullYear()}`;

            const generatedFee = await generateFeeForNewStudent({
              student_id: response.data.id,
              grade_id: formData.grade_level_id,
              service_ids: selectedServices,
              academic_year: academicYear,
              fee_month: feeMonth,
              due_date: challanDueDate
            });
            toast.success("First fee challan generated!");

            // Show the challan modal for immediate print
            if (generatedFee?.id) {
              setGeneratedFeeId(generatedFee.id);
              setShowChallanModal(true);
              setIsSubmitting(false);
              return; // Don't call onSuccess yet — let user print/close the modal first
            }
          } catch (feeErr) {
            console.error("Fee generation failed:", feeErr);
            toast.warning("Student created but fee challan generation failed");
          }
        }

        toast.success("Student added successfully!");
        onSuccess();
      } else {
        toast.error(response.error || "Failed to add student");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.issues.forEach((err: z.ZodIssue) => {
          if (err.path) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setFormErrors(errors);

        // Validation errors

        // Count errors by tab
        const errorsByTab = {
          personal: ['firstName', 'lastName', 'dateOfBirth', 'gender'].filter(f => errors[f]).length,
          academic: ['grade_level_id', 'section_id', 'admissionDate'].filter(f => errors[f]).length,
          medical: ['bloodGroup', 'allergiesList'].filter(f => errors[f]).length,
          family: ['emergencyContacts'].filter(f => errors[f]).length
        };

        // Switch to first tab with errors
        if (errorsByTab.personal > 0) {
          setActiveTab("personal");
          toast.error(`${errorsByTab.personal} error(s) in Personal Information`);
        } else if (errorsByTab.academic > 0) {
          setActiveTab("academic");
          toast.error(`${errorsByTab.academic} error(s) in Academic Information`);
        } else if (errorsByTab.medical > 0) {
          setActiveTab("medical");
          toast.error(`${errorsByTab.medical} error(s) in Medical Information`);
        } else if (errorsByTab.family > 0) {
          setActiveTab("family");
          toast.error(`${errorsByTab.family} error(s) in Family & Emergency`);
        } else {
          toast.error(`Validation failed. Check fields.`);
        }
      } else {
        toast.error("An error occurred while adding the student");
        console.error('❌ Submission error:', error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  const getFieldError = (fieldName: string): string | undefined => {
    return formErrors[fieldName];
  };

  // Merge & Sort Fields Logic (like AddParentForm)
  const getMergedFields = (categories: string[]) => {
    // 1. Filter standard fields by category (using ordered fields)
    const relevantStandard = orderedStandardFields.filter(f => categories.includes(f.category));

    // 2. Filter and map custom fields
    const relevantCustom = customFields
      .filter(f => categories.includes(f.category_id))
      .map(f => {
        const finalSortOrder = f.sort_order !== undefined && f.sort_order !== null ? f.sort_order : 1000;
        return {
          ...f,
          isCustom: true,
          id: f.field_key,
          category: f.category_id,
          width: f.type === 'long-text' ? 'full' : 'half' as 'full' | 'half' | 'third',
          sort_order: finalSortOrder
        };
      });

    // 3. Merge
    const merged = [...relevantStandard, ...relevantCustom];

    // 4. Sort by sort_order
    const sorted = merged.sort((a, b) => {
      const aOrder = a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 1000;
      const bOrder = b.sort_order !== undefined && b.sort_order !== null ? b.sort_order : 1000;
      return aOrder - bOrder;
    });

    return sorted;
  };

  // Render a single field (standard or custom)
  const renderField = (field: any) => {
    const isCustom = !!field.isCustom;
    // Initialize multi-select fields as arrays
    const defaultValue = field.type === 'multi-select' ? [] : '';
    const value = isCustom ? (customFieldValues[field.field_key] ?? defaultValue) : (formData[field.id as keyof StudentFormData] ?? defaultValue);

    const handleChange = (val: any) => {
      if (isCustom) {
        setCustomFieldValues(prev => ({ ...prev, [field.field_key]: val }));
      } else {
        updateFormData(field.id as keyof StudentFormData, val);
      }
    };

    const error = isCustom ? formErrors[`custom_${field.field_key}`] : getFieldError(field.id);

    const widthClass = field.width === 'full' ? 'col-span-1 md:col-span-2' :
      field.width === 'third' ? 'col-span-1 md:col-span-1 lg:col-span-1' :
        'col-span-1';

    const wrapperClass = `${widthClass} space-y-2`;

    // Handle special field types (non-custom, complex rendering)
    if (!isCustom) {
      // Photo upload
      if (field.type === 'photo') {
        return (
          <div key={field.id} className={wrapperClass}>
            <Label>{field.label}</Label>
            <StudentPhotoUpload
              value={formData.studentPhoto || ''}
              onChange={(url) => updateFormData("studentPhoto", url)}
              schoolId={profile?.school_id || ''}
              label="Click to upload photo"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );
      }

      // Grade select
      if (field.type === 'grade_select') {
        return (
          <div key={field.id} className={wrapperClass}>
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={selectedGradeId}
              onValueChange={(value) => {
                setSelectedGradeId(value);
                updateFormData("grade_level_id", value);
                updateFormData("section_id", "");
              }}
              disabled={isLoadingGrades}
            >
              <SelectTrigger className={error ? "border-red-500" : ""}>
                <SelectValue placeholder={isLoadingGrades ? "Loading grades..." : "Select grade level"} />
              </SelectTrigger>
              <SelectContent>
                {grades.map((grade) => (
                  <SelectItem key={grade.id} value={grade.id}>
                    {grade.name} ({grade.sections_count} sections, {grade.students_count} students)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );
      }

      // Section select
      if (field.type === 'section_select') {
        return (
          <div key={field.id} className={wrapperClass}>
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={formData.section_id || ""}
              onValueChange={(value) => updateFormData("section_id", value)}
              disabled={!selectedGradeId || isLoadingSections}
            >
              <SelectTrigger className={error ? "border-red-500" : ""}>
                <SelectValue
                  placeholder={
                    !selectedGradeId ? "Select grade first" :
                      isLoadingSections ? "Loading sections..." :
                        sections.length === 0 ? "No sections available" : "Select section"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name} - {section.available_seats}/{section.capacity} seats available
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedGradeId && sections.length === 0 && !isLoadingSections && (
              <p className="text-sm text-amber-600">⚠️ No sections available for this grade.</p>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );
      }

      // School history (complex field)
      if (field.type === 'school_history') {
        return (
          <div key={field.id} className="col-span-1 md:col-span-2 space-y-4">
            <Separator className="my-4" />
            <h3 className="font-semibold text-[#022172]">Previous School History</h3>
            <div className="space-y-2">
              <Label htmlFor="previousSchoolName">Previous School Name</Label>
              <Input
                id="previousSchoolName"
                value={formData.previousSchoolHistory.schoolName}
                onChange={(e) => updateNestedField("previousSchoolHistory", "schoolName", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transferDate">Transfer Date</Label>
                <Input
                  id="transferDate"
                  type="date"
                  value={formData.previousSchoolHistory.transferDate}
                  onChange={(e) => updateNestedField("previousSchoolHistory", "transferDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastGradeCompleted">Last Grade Completed</Label>
                <Input
                  id="lastGradeCompleted"
                  value={formData.previousSchoolHistory.lastGradeCompleted}
                  onChange={(e) => updateNestedField("previousSchoolHistory", "lastGradeCompleted", e.target.value)}
                />
              </div>
            </div>
          </div>
        );
      }

      // Tags input for allergies
      if (field.type === 'tags') {
        return (
          <div key={field.id} className={wrapperClass}>
            <Label>{field.label}</Label>
            <TagsInput
              value={formData.allergiesList || []}
              onChange={(tags) => updateFormData("allergiesList", tags)}
              placeholder={`Add ${field.label.toLowerCase()}`}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        );
      }

      // These complex types are rendered separately, return null here
      if (['parent_search', 'emergency_contacts', 'service_select'].includes(field.type)) {
        return null;
      }
    }

    // Standard rendering for text, select, date, checkbox, textarea types
    return (
      <div key={field.id} className={wrapperClass}>
        <Label htmlFor={field.id}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </Label>

        {(field.type === 'text' || field.type === 'email' || field.type === 'number') ? (
          <Input
            id={field.id}
            type={field.type}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            className={error ? "border-red-500" : ""}
          />
        ) : field.type === 'textarea' || field.type === 'long-text' ? (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            className={error ? "border-red-500" : ""}
            rows={3}
          />
        ) : field.type === 'select' ? (
          <Select value={value} onValueChange={handleChange}>
            <SelectTrigger className={error ? "border-red-500" : ""}>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options && field.options.length > 0 ? (
                field.options.map((opt: string) => (
                  <SelectItem key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-options" disabled>
                  No options available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : field.type === 'date' ? (
          <DatePicker
            value={value || undefined}
            onChange={(date) => handleChange(date || null)}
            placeholder={`Select ${field.label.toLowerCase()}`}
          />
        ) : field.type === 'checkbox' ? (
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox checked={!!value} onCheckedChange={handleChange} id={field.id} />
            <label htmlFor={field.id} className="text-sm cursor-pointer">{field.label}</label>
          </div>
        ) : field.type === 'file' ? (
          <div className="space-y-2">
            <Input
              type="file"
              id={field.id}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  // You can implement actual file upload here
                  // For now, store the file name
                  handleChange(file.name);
                }
              }}
              className={error ? "border-red-500" : ""}
            />
            {value && (
              <p className="text-xs text-muted-foreground">Current: {value}</p>
            )}
          </div>
        ) : field.type === 'multi-select' ? (
          <MultiSelect
            options={field.options || []}
            value={Array.isArray(value) ? value : (value ? [value] : [])}
            onChange={handleChange}
            placeholder={`Select ${field.label.toLowerCase()}`}
          />
        ) : null}

        {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  };

  const renderCustomFieldInput = (field: CustomField) => {
    const value = customFieldValues[field.id];

    switch (field.type) {
      case "text":
        return (
          <Input
            value={value || ""}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            required={field.required}
          />
        );
      case "long-text":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            required={field.required}
            rows={3}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            placeholder={`Enter ${field.label}`}
            required={field.required}
          />
        );
      case "date":
        return (
          <DatePicker
            value={value ? new Date(value) : undefined}
            onChange={(date) => updateCustomFieldValue(field.id, date?.toISOString())}
            placeholder={`Select ${field.label}`}
          />
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={value || false}
              onCheckedChange={(checked) => updateCustomFieldValue(field.id, checked)}
            />
            <span className="text-sm">{field.label}</span>
          </div>
        );
      case "select":
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => updateCustomFieldValue(field.id, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "multi-select":
        return (
          <TagsInput
            value={value || []}
            onChange={(tags) => updateCustomFieldValue(field.id, tags)}
            placeholder={`Add ${field.label}`}
          />
        );
      case "file":
        return (
          <Input
            type="url"
            value={String(value || "")}
            onChange={(e) => updateCustomFieldValue(field.id, e.target.value)}
            placeholder={`Enter URL for ${field.label}`}
          />
        );
      default:
        return null;
    }
  };

  // Get custom fields for a specific standard category
  const getCustomFieldsForCategory = (categoryId: string) => {
    // First try API-based custom fields (authoritative source)
    const apiFields = customFields.filter(f => f.category_id === categoryId);
    if (apiFields.length > 0) {
      // Map API fields to match template structure for backward compatibility
      return apiFields.map(f => ({
        id: f.field_key,
        label: f.label,
        type: f.type,
        value: '', // Initialize with empty value
        required: f.required,
        options: f.options || []
      }));
    }

    // Fallback to localStorage templates (legacy)
    const category = customFieldTemplates.find(cat => cat.id === categoryId);
    return category?.fields || [];
  };

  // Render custom fields section for a category
  const renderCustomFieldsSection = (categoryId: string) => {
    const fields = getCustomFieldsForCategory(categoryId);
    if (fields.length === 0) return null;

    return (
      <div className="pt-4 mt-4 border-t space-y-4">
        <h4 className="text-sm font-semibold text-[#022172]">Additional Fields</h4>
        {fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {renderCustomFieldInput(field)}
            {getFieldError(field.id) && (
              <p className="text-sm text-red-500">{getFieldError(field.id)}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Define tab order for navigation - use category_order from database
  const getTabsInOrder = () => {
    const standardCategories = ['personal', 'academic', 'medical', 'family', 'system'];
    
    // Get category order from custom fields
    const categoryOrderMap: Record<string, number> = {};
    customFields.forEach(field => {
      if (field.category_order !== undefined && !categoryOrderMap[field.category_id]) {
        categoryOrderMap[field.category_id] = field.category_order;
      }
    });

    // Create array with categories and their order
    const categoriesWithOrder = standardCategories.map(cat => ({
      id: cat,
      order: categoryOrderMap[cat] || (standardCategories.indexOf(cat) + 1)
    }));

    // Sort by order
    categoriesWithOrder.sort((a, b) => a.order - b.order);

    // Add services (always after categories) and custom if needed
    const orderedTabs = categoriesWithOrder.map(c => c.id);
    orderedTabs.push('services');
    if (hasNonStandardCategories) {
      orderedTabs.push('custom');
    }

    return orderedTabs;
  };

  const hasNonStandardCategories = customFieldTemplates.some(
    cat => !['personal', 'academic', 'medical', 'family', 'system'].includes(cat.id)
  );
  const tabs = getTabsInOrder();
  const currentTabIndex = tabs.indexOf(activeTab);
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === tabs.length - 1;

  // Validate required fields for current tab
  const validateCurrentTab = (): boolean => {
    const errors: Record<string, string> = {};

    if (activeTab === 'personal') {
      if (!formData.firstName || formData.firstName.length < 2) {
        errors.firstName = 'First name must be at least 2 characters';
      }
      if (!formData.fatherName || formData.fatherName.length < 2) {
        errors.fatherName = "Father's name must be at least 2 characters";
      }
      if (!formData.lastName || formData.lastName.length < 2) {
        errors.lastName = 'Surname must be at least 2 characters';
      }
      if (!formData.dateOfBirth) {
        errors.dateOfBirth = 'Date of birth is required';
      }
      if (!formData.gender) {
        errors.gender = 'Gender is required';
      }
      if (!formData.email || formData.email.trim() === '') {
        errors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Invalid email address';
      }
      // Validate custom fields in personal category (API-based)
      customFields
        .filter(f => f.category_id === 'personal' && f.required)
        .forEach((field) => {
          const value = customFieldValues[field.field_key];
          if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
            errors[field.field_key] = `${field.label} is required`;
          }
        });
    } else if (activeTab === 'academic') {
      if (!formData.grade_level_id) {
        errors.grade_level_id = 'Grade level is required';
      }
      if (!formData.section_id) {
        errors.section_id = 'Section is required';
      }
      if (!formData.admissionDate) {
        errors.admissionDate = 'Admission date is required';
      }
      // Validate custom fields in academic category (API-based)
      customFields
        .filter(f => f.category_id === 'academic' && f.required)
        .forEach((field) => {
          const value = customFieldValues[field.field_key];
          if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
            errors[field.field_key] = `${field.label} is required`;
          }
        });
    } else if (activeTab === 'medical') {
      if (!formData.bloodGroup) {
        errors.bloodGroup = 'Blood group is required';
      }
      if (formData.hasAllergies && formData.allergiesList.length === 0) {
        errors.allergiesList = 'Please add at least one allergy';
      }
      // Validate custom fields in medical category (API-based)
      customFields
        .filter(f => f.category_id === 'medical' && f.required)
        .forEach((field) => {
          const value = customFieldValues[field.field_key];
          if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
            errors[field.field_key] = `${field.label} is required`;
          }
        });
    } else if (activeTab === 'family') {
      // Validate custom fields in family category (API-based)
      customFields
        .filter(f => f.category_id === 'family' && f.required)
        .forEach((field) => {
          const value = customFieldValues[field.field_key];
          if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
            errors[field.field_key] = `${field.label} is required`;
          }
        });
    } else if (activeTab === 'system') {
      // Validate custom fields in system category (API-based)
      customFields
        .filter(f => f.category_id === 'system' && f.required)
        .forEach((field) => {
          const value = customFieldValues[field.field_key];
          if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
            errors[field.field_key] = `${field.label} is required`;
          }
        });
    } else if (activeTab === 'custom') {
      // Validate required custom fields in non-standard categories (API-based)
      customFields
        .filter(f =>
          !['personal', 'academic', 'medical', 'family', 'system'].includes(f.category_id) &&
          f.required
        )
        .forEach((field) => {
          const value = customFieldValues[field.field_key];
          if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
            errors[field.field_key] = `${field.label} is required`;
          }
        });
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const errorCount = Object.keys(errors).length;
      // Show error labels instead of IDs
      const errorLabels = Object.values(errors).slice(0, 3).join('; ');
      console.log(`❌ Validation failed on ${activeTab} tab:`, errors);
      toast.error(`${errorCount} error(s) found: ${errorLabels}${errorCount > 3 ? '...' : ''}`);
      return false;
    }

    setFormErrors({});
    console.log(`✅ ${activeTab} tab validated successfully`);
    return true;
  };

  const handleNext = () => {
    if (!isLastTab && validateCurrentTab()) {
      setActiveTab(tabs[currentTabIndex + 1]);
    }
  };

  const handlePrevious = () => {
    if (!isFirstTab) {
      setActiveTab(tabs[currentTabIndex - 1]);
    }
  };

  const getStepTitle = () => {
    const titles: Record<string, string> = {
      personal: 'Personal Information',
      academic: 'Academic Information',
      medical: 'Medical Information',
      family: 'Family & Emergency Contacts',
      services: 'School Services',
      system: 'System & Login',
      custom: 'Additional Information'
    };
    return titles[activeTab] || '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      // Allow Enter in textareas
      if (target.tagName === 'TEXTAREA') {
        return;
      }
      // Allow Enter in TagsInput (for adding tags)
      if (target.closest('[data-tags-input]')) {
        return;
      }
      // Always prevent default Enter behavior to stop form auto-submission
      e.preventDefault();
      // Move to next step if not on last tab
      if (!isLastTab) {
        handleNext();
      }
      // On last tab, do nothing - user must click the submit button explicitly
    }
  };

  // Show loading state while custom fields load to prevent flicker
  if (loadingFields) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#022172]"></div>
      </div>
    );
  }

  return (
    <>
    <form
      onSubmit={(e) => {
        // Always prevent default first
        e.preventDefault();
        
        console.log('Form submit triggered');
        const submitEvent = e.nativeEvent as SubmitEvent;
        console.log('Submitter:', submitEvent?.submitter);
        console.log('Submit button ref:', submitButtonRef.current);
        console.log('Is last tab:', isLastTab);
        console.log('Active tab:', activeTab);

        // Only allow submission on the last tab
        if (!isLastTab) {
          console.log('Prevented: Not on last tab');
          return;
        }

        // Only allow submission from the actual submit button click
        if (submitEvent?.submitter !== submitButtonRef.current) {
          console.log('Prevented: Not from submit button');
          return;
        }

        // Double check we're not already submitting
        if (isSubmitting) {
          console.log('Prevented: Already submitting');
          return;
        }

        console.log('Proceeding with submission');
        handleSubmit(e);
      }}
      onKeyDown={handleKeyDown}
      className="space-y-6"
    >
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172]">Personal Information</CardTitle>
              <CardDescription>Student&apos;s personal details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Render merged standard + custom fields inline, sorted by sort_order */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['personal']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Academic Information Tab */}
        <TabsContent value="academic" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172]">Academic Information</CardTitle>
              <CardDescription>Student&apos;s academic details and history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Render merged standard + custom fields inline, sorted by sort_order */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['academic']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medical Information Tab */}
        <TabsContent value="medical" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172]">Medical Information</CardTitle>
              <CardDescription>Student&apos;s health and medical details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Render merged standard + custom fields inline, sorted by sort_order */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['medical']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab - NEW */}
        <TabsContent value="services" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172]">School Services</CardTitle>
              <CardDescription>Select optional services for the student</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active services available.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {services.map((service) => {
                    const isSelected = selectedServices.includes(service.id);
                    // Find charge for selected grade if available
                    const gradeCharge = service.grade_charges?.find(gc => gc.grade_level_id === formData.grade_level_id);
                    const amount = gradeCharge ? gradeCharge.charge_amount : service.default_charge;

                    return (
                      <div
                        key={service.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${isSelected ? 'border-[#022172] bg-blue-50' : 'hover:border-gray-400'}`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedServices(prev => prev.filter(id => id !== service.id));
                          } else {
                            setSelectedServices(prev => [...prev, service.id]);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="font-medium flex items-center">
                              {service.name}
                              {service.is_mandatory && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Mandatory</span>}
                            </div>
                            <div className="text-sm text-muted-foreground capitalize">{service.charge_frequency} Charge</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-[#022172]">${amount.toFixed(2)}</div>
                            <Checkbox checked={isSelected} className="mt-2" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fee Generation - On the Spot */}
              <div className="pt-4 mt-6 border-t">
                <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Checkbox
                    id="generate_challan"
                    checked={generateFirstChallan}
                    onCheckedChange={(checked) => setGenerateFirstChallan(checked as boolean)}
                    className="mt-1"
                  />
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="generate_challan" className="text-base font-medium flex items-center gap-2 cursor-pointer">
                      Generate First Fee Challan
                      <Badge variant="outline" className="text-xs font-normal">Optional</Badge>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate the first month's fee challan immediately after creating the student.
                      Includes base tuition + selected services.
                    </p>

                    {generateFirstChallan && (
                      <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                        <Label htmlFor="challan_due_date">Due Date</Label>
                        <Input
                          id="challan_due_date"
                          type="date"
                          value={challanDueDate}
                          onChange={(e) => setChallanDueDate(e.target.value)}
                          className="max-w-xs mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          The generated fee will be for the upcoming month:
                          <span className="font-medium ml-1">
                            {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        {/* Family & Emergency Tab */}
        <TabsContent value="family" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172]">Family & Emergency Contacts</CardTitle>
              <CardDescription>Link parent and add emergency contacts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Linked Parent</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNewParentForm(!showNewParentForm);
                      updateFormData("linkedParentId", "");
                    }}
                  >
                    {showNewParentForm ? (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" /> Cancel Creation
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" /> Create New Parent
                      </>
                    )}
                  </Button>
                </div>

                {showNewParentForm ? (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                    <h4 className="font-medium text-sm text-[#022172]">New Parent Details</h4>

                    {/* Personal Information */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name <span className="text-red-500">*</span></Label>
                        <Input
                          value={newParentData.first_name}
                          onChange={(e) => setNewParentData({ ...newParentData, first_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name <span className="text-red-500">*</span></Label>
                        <Input
                          value={newParentData.last_name}
                          onChange={(e) => setNewParentData({ ...newParentData, last_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={newParentData.email}
                          onChange={(e) => setNewParentData({ ...newParentData, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={newParentData.phone}
                          onChange={(e) => setNewParentData({ ...newParentData, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <div className="relative">
                          <Input
                            type={showParentPassword ? "text" : "password"}
                            value={newParentData.password || ''}
                            onChange={(e) => setNewParentData({ ...newParentData, password: e.target.value })}
                            placeholder="Auto-generated if empty"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowParentPassword(!showParentPassword)}
                            tabIndex={-1}
                          >
                            {showParentPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Leave empty to auto-generate a secure password.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>CNIC <span className="text-red-500">*</span></Label>
                        <Input
                          value={newParentData.cnic || ''}
                          onChange={(e) => setNewParentData({ ...newParentData, cnic: e.target.value })}
                          placeholder="e.g., 12345-1234567-1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Relationship <span className="text-red-500">*</span></Label>
                        <Select
                          value={newParentData.relationship}
                          onValueChange={(v) => setNewParentData({ ...newParentData, relationship: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Father">Father</SelectItem>
                            <SelectItem value="Mother">Mother</SelectItem>
                            <SelectItem value="Guardian">Guardian</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Professional Information */}
                    <Separator className="my-2" />
                    <h5 className="font-medium text-xs text-muted-foreground">Professional Information</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Occupation</Label>
                        <Input
                          value={newParentData.occupation || ''}
                          onChange={(e) => setNewParentData({ ...newParentData, occupation: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Workplace</Label>
                        <Input
                          value={newParentData.workplace || ''}
                          onChange={(e) => setNewParentData({ ...newParentData, workplace: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Income</Label>
                        <Input
                          value={newParentData.income || ''}
                          onChange={(e) => setNewParentData({ ...newParentData, income: e.target.value })}
                          placeholder="e.g., 50000-100000"
                        />
                      </div>
                    </div>

                    {/* Address Information - Mandatory */}
                    <Separator className="my-2" />
                    <h5 className="font-medium text-xs text-muted-foreground">Address <span className="text-red-500">*</span></h5>
                    <div className="space-y-2">
                      <Label>Street Address <span className="text-red-500">*</span></Label>
                      <Input
                        value={newParentData.address || ''}
                        onChange={(e) => setNewParentData({ ...newParentData, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>City <span className="text-red-500">*</span></Label>
                        <Input
                          value={newParentData.city || ''}
                          onChange={(e) => setNewParentData({ ...newParentData, city: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State / Province</Label>
                        <Input
                          value={newParentData.state || ''}
                          onChange={(e) => setNewParentData({ ...newParentData, state: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Zip Code</Label>
                        <Input
                          value={newParentData.zip_code || ''}
                          onChange={(e) => setNewParentData({ ...newParentData, zip_code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Input
                          value={newParentData.country || ''}
                          onChange={(e) => setNewParentData({ ...newParentData, country: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Search Parent</Label>
                    <Combobox
                      options={parentOptions}
                      value={formData.linkedParentId}
                      onValueChange={(value) => updateFormData("linkedParentId", value)}
                      onSearchChange={setParentSearchQuery}
                      placeholder="Search by name, email, or phone..."
                      emptyMessage={isLoadingParents ? "Loading..." : parentSearchQuery.length < 2 ? "Type at least 2 characters to search" : "No parents found"}
                    />
                    {formData.linkedParentId && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="text-sm text-muted-foreground flex items-center">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs mr-2">Selected</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => updateFormData("linkedParentId", "")}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Clear
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!showNewParentForm && formData.linkedParentId && (
                  <div className="space-y-2">
                    <Label>Relationship Type <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.parentRelationType}
                      onValueChange={(value) => updateFormData("parentRelationType", value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="father">Father</SelectItem>
                        <SelectItem value="mother">Mother</SelectItem>
                        <SelectItem value="guardian">Guardian</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-[#022172]">Emergency Contacts</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEmergencyContact}
                    className="border-[#57A3CC] text-[#022172]"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                </div>

                {formData.emergencyContacts.map((contact, index) => (
                  <Card key={index} className="border-[#57A3CC]/30">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-[#022172]">
                          Contact {index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEmergencyContact(index)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={contact.name}
                            onChange={(e) =>
                              updateEmergencyContact(index, "name", e.target.value)
                            }
                            placeholder="Full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Relationship</Label>
                          <Input
                            value={contact.relationship}
                            onChange={(e) =>
                              updateEmergencyContact(index, "relationship", e.target.value)
                            }
                            placeholder="e.g., Uncle, Neighbor"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={contact.phone}
                            onChange={(e) =>
                              updateEmergencyContact(index, "phone", e.target.value)
                            }
                            placeholder="Contact number"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Address</Label>
                          <Input
                            value={contact.address}
                            onChange={(e) =>
                              updateEmergencyContact(index, "address", e.target.value)
                            }
                            placeholder="Address"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Custom fields for Family category */}
              {renderCustomFieldsSection('family')}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System & Identity Tab */}
        <TabsContent value="system" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172]">System & Identity</CardTitle>
              <CardDescription>Auto-generated fields (can be overridden if needed)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID / Roll Number</Label>
                  <Input
                    id="studentId"
                    value={formData.studentId}
                    onChange={(e) => updateFormData("studentId", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => updateFormData("username", e.target.value)}
                    placeholder="st_ahmed_123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password (Default)</Label>
                  <Input
                    id="password"
                    type="text"
                    value={formData.password}
                    onChange={(e) => updateFormData("password", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => updateFormData("status", value as StudentStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom fields for System category */}
              {renderCustomFieldsSection('system')}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Fields Tab - Only shown if non-standard categories exist */}
        {hasNonStandardCategories && (
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-4">
              {customFieldTemplates
                .filter(cat => !['personal', 'academic', 'medical', 'family', 'system'].includes(cat.id))
                .map((category) => (
                  <Card key={category.id}>
                    <CardHeader>
                      <CardTitle className="text-[#022172]">{category.name}</CardTitle>
                      <CardDescription>
                        Additional information for {category.name.toLowerCase()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {category.fields.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <Label>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {renderCustomFieldInput(field)}
                          {getFieldError(field.id) && (
                            <p className="text-sm text-red-500">{getFieldError(field.id)}</p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Navigation Buttons */}
      <div className="flex justify-between gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstTab}
        >
          Previous
        </Button>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onSuccess()}
          >
            Cancel
          </Button>

          {isLastTab ? (
            <Button
              type="submit"
              ref={submitButtonRef}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Student
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </form>

    {/* Fee Challan Modal — shown immediately after fee generation for printing */}
    {showChallanModal && generatedFeeId && (
      <FeeChallanModal
        isOpen={showChallanModal}
        onClose={() => {
          setShowChallanModal(false);
          setGeneratedFeeId(null);
          toast.success("Student added successfully!");
          onSuccess();
        }}
        feeId={generatedFeeId}
        schoolId={profile?.school_id || ''}
      />
    )}
    </>
  );
}
