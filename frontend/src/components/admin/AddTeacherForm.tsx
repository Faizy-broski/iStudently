"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelect } from "@/components/ui/multi-select"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Check, Copy, Eye, EyeOff } from "lucide-react"
import { StudentPhotoUpload } from "@/components/ui/student-photo-upload"
import { useAuth } from "@/context/AuthContext"
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields"
import { getFieldOrders, getEffectiveFieldOrder, DefaultFieldOrder } from '@/lib/utils/field-ordering';
import * as teachersApi from "@/lib/api/teachers"
import { useCampus } from "@/context/CampusContext"
import { useTranslations } from "next-intl"
import { useSchoolSettings } from '@/hooks/useSchoolSettings'
// Standard Field Definitions with Sort Orders for Teachers
const STANDARD_FIELDS = [
  // PERSONAL INFO (Category: personal)
  { id: 'first_name', label: 'First Name', type: 'text', category: 'personal', sort_order: 1, required: true, width: 'half' },
  { id: 'last_name', label: 'Last Name', type: 'text', category: 'personal', sort_order: 2, required: true, width: 'half' },
  { id: 'email', label: 'Email', type: 'email', category: 'personal', sort_order: 3, required: true, width: 'half' },
  { id: 'phone', label: 'Phone', type: 'tel', category: 'personal', sort_order: 4, required: false, width: 'half' },
  { id: 'gender', label: 'Gender', type: 'select', category: 'personal', sort_order: 5, required: false, width: 'half', options: ['male', 'female', 'other'] },
  { id: 'date_of_birth', label: 'Date of Birth', type: 'date', category: 'personal', sort_order: 6, required: false, width: 'half' },

  // PROFESSIONAL (Category: professional)
  { id: 'employment_type', label: 'Employment Type', type: 'select', category: 'professional', sort_order: 1, required: true, width: 'half', options: ['full_time', 'part_time', 'contract'] },
  { id: 'payment_type', label: 'Payment Type', type: 'select', category: 'professional', sort_order: 2, required: true, width: 'half', options: ['fixed_salary', 'hourly'], help: 'Hourly teachers appear in Teacher Hours module' },
  { id: 'date_of_joining', label: 'Date of Joining', type: 'date', category: 'professional', sort_order: 3, required: false, width: 'half' },
  { id: 'title', label: 'Title', type: 'text', category: 'professional', sort_order: 4, required: false, width: 'half', placeholder: 'e.g., Senior Teacher' },
  { id: 'department', label: 'Department', type: 'text', category: 'professional', sort_order: 5, required: false, width: 'half', placeholder: 'e.g., Science' },
  { id: 'base_salary', label: 'Base Salary (Monthly)', type: 'number', category: 'professional', sort_order: 6, required: false, width: 'full', help: 'Required for fixed salary teachers' },

  // QUALIFICATIONS (Category: qualifications)
  { id: 'qualifications', label: 'Qualifications', type: 'text', category: 'qualifications', sort_order: 1, required: false, width: 'full', placeholder: 'e.g., M.Sc. Mathematics' },
  { id: 'specialization', label: 'Specialization', type: 'text', category: 'qualifications', sort_order: 2, required: false, width: 'full', placeholder: 'e.g., Applied Mathematics' },

  // SYSTEM (Category: system)
  { id: 'employee_number', label: 'Employee Number', type: 'text', category: 'system', sort_order: 1, required: false, width: 'half', help: 'Auto-generated if empty' },
  { id: 'username', label: 'Username', type: 'text', category: 'system', sort_order: 2, required: false, width: 'half', help: 'Auto-generated from name' },
  { id: 'password', label: 'Password', type: 'text', category: 'system', sort_order: 3, required: false, width: 'full', help: 'Auto-generated secure password' },
];

interface AddTeacherFormProps {
  onSuccess: () => void;
  editingTeacher?: teachersApi.Staff | null;
}

export function AddTeacherForm({ onSuccess, editingTeacher }: AddTeacherFormProps) {
  const t = useTranslations('teachers')
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;
  const { profile } = useAuth();
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>('');
  const { currencySymbol } = useSchoolSettings();

  const getDisplayLabel = (fieldId: string, fallback: string): string => {
    const map: Record<string, string> = {
      first_name: t('fields.firstName'),
      last_name: t('fields.lastName'),
      email: t('fields.email'),
      phone: t('fields.phoneNumber'),
      employment_type: t('fields.employmentType'),
      payment_type: t('fields.employmentType'),
      date_of_joining: t('fields.dateOfJoining'),
      title: t('fields.title'),
      department: t('fields.department'),
      base_salary: t('fields.baseSalary'),
      qualifications: t('fields.qualifications'),
      specialization: t('fields.specialization'),
      employee_number: t('fields.employeeNumber'),
      username: t('fields.username'),
      password: t('form.password'),
    }
    return map[fieldId] || fallback
  }

  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [defaultFieldOrders, setDefaultFieldOrders] = useState<DefaultFieldOrder[]>([]);
  const [orderedStandardFields, setOrderedStandardFields] = useState(STANDARD_FIELDS);
  const [activeTab, setActiveTab] = useState("personal");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uniqueUserNum] = useState(() => Math.floor(1000 + Math.random() * 9000));

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(t('form.copiedToClipboard', { fieldName }));
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [formData, setFormData] = useState<teachersApi.CreateStaffDTO>({
    employee_number: "",
    title: "",
    department: "",
    qualifications: "",
    specialization: "",
    date_of_joining: "",
    employment_type: "full_time",
    payment_type: "fixed_salary",
    base_salary: 0,
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    username: "",
    password: Math.floor(10000000 + Math.random() * 90000000).toString(),
    role: "teacher",
    status: "active",
    custom_fields: {}
  });

  // Load custom fields on mount or when campus changes
  useEffect(() => {
    const loadCustomFields = async () => {
      try {
        const campusId = selectedCampus?.id;
        const [fieldsResponse, ordersResponse] = await Promise.all([
          getFieldDefinitions('teacher', campusId),
          getFieldOrders('teacher')
        ]);

        if (ordersResponse.success && ordersResponse.data) {
          setDefaultFieldOrders(ordersResponse.data);

          const orderedFields = STANDARD_FIELDS.map(field => {
            const categoryOrders = ordersResponse.data!.filter(o => o.category_id === field.category);
            const savedOrder = categoryOrders.find(o => o.field_label === field.label);
            return savedOrder ? { ...field, sort_order: savedOrder.sort_order } : field;
          });

          setOrderedStandardFields(orderedFields);
        }

        if (fieldsResponse.success && fieldsResponse.data) {
          setCustomFields(fieldsResponse.data);

          const categoryOrderMap: Record<string, number> = {};
          fieldsResponse.data.forEach((field: CustomFieldDefinition) => {
            if (field.category_order !== undefined && !categoryOrderMap[field.category_id]) {
              categoryOrderMap[field.category_id] = field.category_order;
            }
          });

          const standardCategories = ['personal', 'professional', 'qualifications', 'employment', 'system'];
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
        }
      } catch (err) {
        console.error("Error loading custom fields", err);
      } finally {
        setLoadingFields(false);
      }
    };

    loadCustomFields();
  }, [selectedCampus?.id]);

  // Populate form when editing
  useEffect(() => {
    if (editingTeacher) {
      console.log('🔍 AddTeacherForm - editingTeacher received:', editingTeacher)
      console.log('💰 AddTeacherForm - base_salary:', editingTeacher.base_salary)
      console.log('💰 AddTeacherForm - (any)base_salary:', (editingTeacher as any).base_salary)

      // Extract profile data from nested profile object
      const profile = editingTeacher.profile;

      setFormData({
        employee_number: editingTeacher.employee_number || "",
        title: editingTeacher.title || "",
        department: editingTeacher.department || "",
        qualifications: editingTeacher.qualifications || "",
        specialization: editingTeacher.specialization || "",
        date_of_joining: editingTeacher.date_of_joining || "",
        employment_type: editingTeacher.employment_type || "full_time",
        payment_type: (editingTeacher as any).payment_type || "fixed_salary",
        base_salary: (editingTeacher as any).base_salary || 0,
        // Extract from profile object
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        email: profile?.email || "",
        phone: profile?.phone || "",
        gender: (profile as any)?.gender || "",
        date_of_birth: (profile as any)?.date_of_birth || "",
        username: profile?.username || "",
        password: "",
        role: "teacher",
        status: editingTeacher.is_active ? "active" : "inactive",
        custom_fields: editingTeacher.custom_fields || {}
      });

      console.log('📝 AddTeacherForm - formData after setFormData:', {
        base_salary: (editingTeacher as any).base_salary || 0
      })

      setCustomFieldValues(editingTeacher.custom_fields || {});
    }
  }, [editingTeacher]);

  // Auto-generate employee number when creating new teacher
  useEffect(() => {
    if (!editingTeacher && !formData.employee_number) {
      const timestamp = Date.now().toString().slice(-6)
      const randomDigits = Math.floor(100 + Math.random() * 900)
      const employeeNumber = `EMP${timestamp}${randomDigits}`
      setFormData(prev => ({ ...prev, employee_number: employeeNumber }))
    }
  }, [editingTeacher, formData.employee_number])

  // Auto-generate username from first_name+last_name+unique number when names change
  useEffect(() => {
    if (!editingTeacher && formData.first_name && formData.last_name) {
      const cleanFirst = formData.first_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanLast = formData.last_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      setFormData(prev => ({ ...prev, username: `${cleanFirst}${cleanLast}${uniqueUserNum}` }));
    }
  }, [formData.first_name, formData.last_name, editingTeacher, uniqueUserNum]);

  const updateFormData = (field: keyof teachersApi.CreateStaffDTO, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getFieldError = (fieldName: string): string | undefined => {
    return formErrors[fieldName];
  };

  // Get merged and sorted fields for categories
  const getMergedFields = (categories: string[]) => {
    const relevantStandard = orderedStandardFields.filter(f => categories.includes(f.category));

    const relevantCustom = customFields
      .filter(f => categories.includes(f.category_id))
      .map(f => ({
        ...f,
        isCustom: true,
        id: f.field_key,
        category: f.category_id,
        width: (f.type === 'long-text' || f.type === 'textarea') ? 'full' : 'half' as 'full' | 'half',
        sort_order: f.sort_order ?? 1000
      }));

    const merged = [...relevantStandard, ...relevantCustom];
    return merged.sort((a, b) => (a.sort_order || 1000) - (b.sort_order || 1000));
  };

  // Render a single field
  const renderField = (field: any) => {
    // Hide base_salary for hourly-rate teachers — their pay is tracked in accounting
    if (field.id === 'base_salary' && formData.payment_type === 'hourly') {
      return null;
    }

    // Special render: username (editable, auto-generated from name)
    if (field.id === 'username') {
      return (
        <div key={field.id} className="col-span-1 space-y-2">
          <Label>{t('fields.username')}</Label>
          <div className="flex gap-2">
            <Input
              value={formData.username || ''}
              onChange={(e) => updateFormData('username', e.target.value)}
              placeholder="firstname.lastname"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy(formData.username || '', t('fields.username'))}
            >
              {copiedField === t('fields.username') ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Auto-generated from name. Can be customised.</p>
        </div>
      );
    }

    // Special render: password (show/hide + copy)
    if (field.id === 'password') {
      const passwordValue = String(formData.password || '');
      return (
        <div key={field.id} className="col-span-1 md:col-span-2 space-y-2">
          <Label>{t('form.password')}</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={passwordValue}
                onChange={(e) => updateFormData('password', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleCopy(passwordValue, 'Password')}
            >
              {copiedField === 'Password' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('form.autoGeneratedPasswordHelp')}</p>
        </div>
      );
    }

    const isCustom = !!field.isCustom;
    const defaultValue = field.type === 'multi-select' ? [] : '';
    const value = isCustom
      ? (customFieldValues[field.field_key] ?? defaultValue)
      : (formData[field.id as keyof teachersApi.CreateStaffDTO] ?? defaultValue);

    const handleChange = (val: any) => {
      if (isCustom) {
        setCustomFieldValues(prev => ({ ...prev, [field.field_key]: val }));
      } else {
        updateFormData(field.id as keyof teachersApi.CreateStaffDTO, val);
      }
    };

    const error = isCustom ? formErrors[`custom_${field.field_key}`] : getFieldError(field.id);
    const widthClass = field.width === 'full' ? 'col-span-1 md:col-span-2' : 'col-span-1';

    return (
      <div key={field.id} className={`${widthClass} space-y-2`}>
        <Label htmlFor={field.id}>
          {getDisplayLabel(field.id, field.label)}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>

        {field.type === 'text' || field.type === 'email' || field.type === 'number' || field.type === 'tel' ? (
          field.id === 'base_salary' ? (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500 font-medium">{currencySymbol}</span>
              <Input
                id={field.id}
                type="number"
                value={value}
                onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
                placeholder={field.placeholder}
                className={`pl-10 ${error ? "border-red-500" : ""}`}
                min="0"
                step="100"
              />
            </div>
          ) : (
          <Input
            id={field.id}
            type={field.type}
            value={value}
            onKeyDown={(e) => {
              const nav = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
              if (e.ctrlKey || e.metaKey) return;
              if (nav.includes(e.key)) return;
              if (field.type === 'tel' && !/[0-9+\-() ]/.test(e.key)) e.preventDefault();
              if (field.type === 'number' && !/[0-9.]/.test(e.key)) e.preventDefault();
            }}
            onChange={(e) => {
              let val = e.target.value;
              if (field.type === 'tel') val = val.replace(/[^0-9+\-() ]/g, '');
              if (field.type === 'number') val = val.replace(/[^0-9.]/g, '');
              handleChange(field.type === 'number' ? parseFloat(val) || 0 : val);
            }}
            placeholder={field.placeholder}
            className={error ? "border-red-500" : ""}
          />
          )
        ) : field.type === 'date' ? (
          <Input
            id={field.id}
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={error ? "border-red-500" : ""}
          />
        ) : field.type === 'select' ? (
          <Select value={value} onValueChange={handleChange}>
            <SelectTrigger className={error ? "border-red-500" : ""}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: string) => (
                <SelectItem key={opt} value={opt}>
                  {opt.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === 'textarea' || field.type === 'long-text' ? (
          <Textarea
            id={field.id}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={error ? "border-red-500" : ""}
          />
        ) : field.type === 'checkbox' ? (
          <div className="flex items-center space-x-2 pt-2 rtl:space-x-reverse">
            <Checkbox
              id={field.id}
              checked={!!value}
              onCheckedChange={handleChange}
              className={error ? "border-red-500" : ""}
            />
            <label htmlFor={field.id} className="text-sm cursor-pointer">{field.label}</label>
          </div>
        ) : field.type === 'multi-select' ? (
          <MultiSelect
            options={field.options || []}
            value={Array.isArray(value) ? value : (value ? [value] : [])}
            onChange={handleChange}
            placeholder={`Select ${field.label.toLowerCase()}`}
          />
        ) : field.type === 'file' ? (
          <div className="space-y-1">
            <Input
              type="file"
              id={field.id}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleChange(file.name);
              }}
              className={error ? "border-red-500" : ""}
            />
            {value && <p className="text-xs text-muted-foreground">Current: {value}</p>}
          </div>
        ) : null}

        {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  };

  // Define tab order for navigation - use category_order from database
  const getTabsInOrder = () => {
    const standardCategories = ['personal', 'professional', 'qualifications', 'employment', 'system'];

    const categoryOrderMap: Record<string, number> = {};
    customFields.forEach(field => {
      if (field.category_order !== undefined && !categoryOrderMap[field.category_id]) {
        categoryOrderMap[field.category_id] = field.category_order;
      }
    });

    // Only include employment tab if it has custom fields (no standard fields live there)
    const hasEmploymentFields = customFields.some(f => f.category_id === 'employment');

    const categoriesWithOrder = standardCategories
      .filter(cat => cat !== 'employment' || hasEmploymentFields)
      .map(cat => ({
        id: cat,
        order: categoryOrderMap[cat] || (standardCategories.indexOf(cat) + 1)
      }));

    categoriesWithOrder.sort((a, b) => a.order - b.order);
    return categoriesWithOrder.map(c => c.id);
  };

  const tabs = getTabsInOrder();
  const currentTabIndex = tabs.indexOf(activeTab);
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === tabs.length - 1;

  // Validate current tab
  const validateCurrentTab = (): boolean => {
    const errors: Record<string, string> = {};

    if (activeTab === 'personal') {
      if (!formData.first_name || formData.first_name.length < 2) {
        errors.first_name = t('validation.firstNameMin');
      }
      if (!formData.last_name || formData.last_name.length < 2) {
        errors.last_name = t('validation.lastNameMin');
      }
      if (!formData.email) {
        errors.email = t('validation.emailRequired');
      }

      customFields.filter(f => f.category_id === 'personal' && f.required).forEach(field => {
        const value = customFieldValues[field.field_key];
        if (!value || value === '') {
          errors[`custom_${field.field_key}`] = t('validation.fieldRequired', { field: field.label });
        }
      });
    } else if (activeTab === 'professional') {
      if (!formData.employment_type) {
        errors.employment_type = t('validation.employmentTypeRequired');
      }
      if (!formData.payment_type) {
        errors.payment_type = t('validation.paymentTypeRequired');
      }
      if (formData.payment_type === 'fixed_salary' && (!formData.base_salary || formData.base_salary <= 0)) {
        errors.base_salary = t('validation.baseSalaryRequiredForFixed');
      }

      customFields.filter(f => f.category_id === 'professional' && f.required).forEach(field => {
        const value = customFieldValues[field.field_key];
        if (!value || value === '') {
          errors[`custom_${field.field_key}`] = t('validation.fieldRequired', { field: field.label });
        }
      });
    } else if (activeTab === 'qualifications') {
      customFields.filter(f => f.category_id === 'qualifications' && f.required).forEach(field => {
        const value = customFieldValues[field.field_key];
        if (!value || value === '') {
          errors[`custom_${field.field_key}`] = t('validation.fieldRequired', { field: field.label });
        }
      });
    } else if (activeTab === 'employment') {
      customFields.filter(f => f.category_id === 'employment' && f.required).forEach(field => {
        const value = customFieldValues[field.field_key];
        if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
          errors[`custom_${field.field_key}`] = t('validation.fieldRequired', { field: field.label });
        }
      });
    } else if (activeTab === 'system') {
      customFields.filter(f => f.category_id === 'system' && f.required).forEach(field => {
        const value = customFieldValues[field.field_key];
        if (!value || value === '') {
          errors[`custom_${field.field_key}`] = t('validation.fieldRequired', { field: field.label });
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error(t('validation.pleaseFixErrors', { count: Object.keys(errors).length }));
      return false;
    }

    setFormErrors({});
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
      personal: t('tabs.personalInformation'),
      professional: t('tabs.professionalDetails'),
      qualifications: t('tabs.qualificationsCertifications'),
      employment: t('tabs.employmentCompensation'),
      system: t('tabs.systemLogin'),
    };
    return titles[activeTab] || '';
  };

  const handleSubmit = async () => {

    if (!validateCurrentTab()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const dataToSend = {
        ...formData,
        profile_photo_url: profilePhotoUrl || undefined,
        custom_fields: customFieldValues,
        school_id: selectedCampus?.id
      };

      console.log('💰 Submitting teacher data:', {
        editMode: !!editingTeacher,
        base_salary: dataToSend.base_salary,
        dataToSend
      });

      if (editingTeacher) {
        const result = await teachersApi.updateTeacher(editingTeacher.id, dataToSend);
        console.log('✅ Update result:', result);
        toast.success(t('form.teacherUpdatedSuccessfully'));
      } else {
        await teachersApi.createTeacher(dataToSend);
        toast.success(t('form.teacherAddedSuccessfully'));
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error saving teacher:", error);
      toast.error(error.message || "Failed to save teacher");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') {
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
    <form
      onSubmit={(e) => e.preventDefault()}
      onKeyDown={handleKeyDown}
      className="space-y-6"
    >
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#022172] dark:text-blue-300">
            {t('form.stepOf', { current: currentTabIndex + 1, total: tabs.length })}
          </span>
          <span className="text-sm text-muted-foreground">
            {getStepTitle()}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
              <CardTitle className="text-[#022172] dark:text-white">{t('tabs.personalInformation')}</CardTitle>
              <CardDescription>{t('form.personalDetailsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo upload */}
              <div className="space-y-1.5">
                <Label>Profile Photo</Label>
                <StudentPhotoUpload
                  value={profilePhotoUrl}
                  onChange={setProfilePhotoUrl}
                  schoolId={selectedCampus?.id || profile?.school_id || ''}
                  role="teacher"
                  label="Upload Photo"
                  className="max-w-xs"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['personal']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Professional Details Tab */}
        <TabsContent value="professional" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172] dark:text-white">{t('tabs.professionalDetails')}</CardTitle>
              <CardDescription>{t('form.professionalDetailsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['professional']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualifications Tab */}
        <TabsContent value="qualifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172] dark:text-white">{t('tabs.qualificationsCertifications')}</CardTitle>
              <CardDescription>{t('form.qualificationsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['qualifications']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employment & Compensation Tab — rendered only when custom fields exist */}
        <TabsContent value="employment" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172] dark:text-white">{t('tabs.employmentCompensation')}</CardTitle>
              <CardDescription>{t('form.professionalDetailsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['employment']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System & Login Tab */}
        <TabsContent value="system" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#022172] dark:text-white">{t('tabs.systemLogin')}</CardTitle>
              <CardDescription>{t('form.systemInfoDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['system']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4 border-t dark:border-gray-700">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstTab}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t('previous')}
        </Button>

        {isLastTab ? (
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => { if (!isSubmitting) handleSubmit(); }}
            className="bg-gradient-to-r from-[#57A3CC] to-[#022172]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {editingTeacher ? t('updating') : t('creating')}
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {editingTeacher ? t('updateTeacher') : t('createTeacher')}
              </>
            )}
          </Button>
        ) : (
          <Button type="button" onClick={handleNext}>
            {t('next')}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
