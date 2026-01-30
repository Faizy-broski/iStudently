"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagsInput } from "@/components/ui/tags-input";
import { MultiSelect } from "@/components/ui/multi-select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Loader2, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { createParent } from "@/lib/api/parents";
import { useCampus } from "@/context/CampusContext";
import { useAuth } from "@/context/AuthContext";
import { CustomFieldsRenderer } from "@/components/admin/CustomFieldsRenderer";
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields";
import { getFieldOrders, getEffectiveFieldOrder, DefaultFieldOrder } from '@/lib/utils/field-ordering';

// Zod validation schema
const parentSchema = z.object({
  relationshipType: z.enum(["mother", "father", "both", "guardian"], {
    message: "Please select a relationship type",
  }),
  guardianRelationship: z.string().optional(),

  // Primary Guardian (Mother/Guardian 1)
  primaryFirstName: z.string().min(2, "First name must be at least 2 characters"),
  primaryLastName: z.string().min(2, "Last name must be at least 2 characters"),
  primaryEmail: z.string().email("Invalid email address"),
  primaryPhone: z.string().min(1, "Phone number is required"),
  primaryCNIC: z.string().min(1, "CNIC/ID number is required"),
  primaryOccupation: z.string().min(1, "Occupation is required"),

  // Secondary Guardian (Father/Guardian 2) - optional
  secondaryFirstName: z.string().optional(),
  secondaryLastName: z.string().optional(),
  secondaryEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  secondaryPhone: z.string().optional(),
});

// Standard Field Definitions with Sort Orders
const STANDARD_FIELDS = [
  // PRIMARY INFO (Category: personal / professional)
  { id: 'primaryFirstName', label: 'First Name', type: 'text', category: 'personal', sort_order: 1, required: true, width: 'half' },
  { id: 'primaryLastName', label: 'Last Name', type: 'text', category: 'personal', sort_order: 2, required: true, width: 'half' },
  { id: 'primaryCNIC', label: 'CNIC / ID Number', type: 'text', category: 'personal', sort_order: 3, required: true, width: 'half', placeholder: 'XXXXX-XXXXXXX-X' },
  { id: 'primaryPhone', label: 'Phone Number', type: 'text', category: 'personal', sort_order: 4, required: true, width: 'half', placeholder: '+92 XXX XXXXXXX' },
  { id: 'primaryEmail', label: 'Email Address', type: 'email', category: 'personal', sort_order: 5, required: true, width: 'half', placeholder: 'email@example.com' },
  { id: 'primaryOccupation', label: 'Occupation', type: 'text', category: 'professional', sort_order: 1, required: true, width: 'half', placeholder: 'e.g., Teacher' },
  { id: 'primaryWorkplace', label: 'Workplace', type: 'text', category: 'professional', sort_order: 2, required: false, width: 'half' },
  { id: 'primaryIncome', label: 'Monthly Income', type: 'number', category: 'professional', sort_order: 3, required: false, width: 'half' },

  // CONTACT INFO (Category: contact / emergency)
  { id: 'address', label: 'Home Address', type: 'textarea', category: 'contact', sort_order: 1, required: false, width: 'full' },
  { id: 'city', label: 'City', type: 'text', category: 'contact', sort_order: 2, required: false, width: 'half' },
  { id: 'state', label: 'State/Province', type: 'text', category: 'contact', sort_order: 3, required: false, width: 'half' },
  { id: 'zipCode', label: 'ZIP/Postal Code', type: 'text', category: 'contact', sort_order: 4, required: false, width: 'half' },
  { id: 'country', label: 'Country', type: 'text', category: 'contact', sort_order: 5, required: false, width: 'half', defaultValue: 'Pakistan' },
  // Emergency
  { id: 'emergencyContactName', label: 'Emergency Contact Name', type: 'text', category: 'emergency', sort_order: 1, required: false, width: 'third' },
  { id: 'emergencyContactRelation', label: 'Relationship', type: 'text', category: 'emergency', sort_order: 2, required: false, width: 'third' },
  { id: 'emergencyContactPhone', label: 'Phone', type: 'text', category: 'emergency', sort_order: 3, required: false, width: 'third' },

  // SYSTEM (Category: system)
  { id: 'username', label: 'Username', type: 'text', category: 'system', sort_order: 1, required: false, width: 'half', help: 'Auto-generated if empty' },
  { id: 'password', label: 'Password', type: 'text', category: 'system', sort_order: 2, required: false, width: 'half', help: 'Auto-generated' },
  { id: 'notes', label: 'Additional Notes', type: 'textarea', category: 'system', sort_order: 3, required: false, width: 'full' },
];

interface AddParentFormProps {
  onSuccess: () => void;
}

export function AddParentForm({ onSuccess }: AddParentFormProps) {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;
  const { mutate } = useSWRConfig();
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [defaultFieldOrders, setDefaultFieldOrders] = useState<DefaultFieldOrder[]>([]);
  const [orderedStandardFields, setOrderedStandardFields] = useState(STANDARD_FIELDS);
  const [activeTab, setActiveTab] = useState("relationship");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const isLastTab = activeTab === "preferences";

  const [formData, setFormData] = useState<Record<string, any>>({
    relationshipType: "",
    guardianRelationship: "",

    // Standard Fields defaults
    primaryFirstName: "",
    primaryLastName: "",
    primaryCNIC: "",
    primaryEmail: "",
    primaryPhone: "",
    primaryOccupation: "",
    primaryWorkplace: "",
    primaryIncome: "",

    // Secondary defaults
    secondaryFirstName: "",
    secondaryLastName: "",
    secondaryCNIC: "",
    secondaryEmail: "",
    secondaryPhone: "",
    secondaryOccupation: "",
    secondaryWorkplace: "",
    secondaryIncome: "",

    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "Pakistan",

    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",

    username: "",
    password: Math.random().toString(36).slice(-8),
    status: "active",
    notes: "",

    // Container for custom field values
    customFieldsValues: {},
  });


  // Fetch Custom Fields
  useEffect(() => {
    const loadFields = async () => {
      try {
        const [fieldsResponse, ordersResponse] = await Promise.all([
          getFieldDefinitions('parent'),
          getFieldOrders('parent')
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
        }
      } catch (err) {
        console.error("Error loading custom fields", err);
      } finally {
        setLoadingFields(false);
      }
    };
    loadFields();
  }, []);

  const getFieldError = (fieldName: string): string | undefined => {
    return formErrors[fieldName];
  };

  // Auto-generate username logic
  useEffect(() => {
    if (!formData.username) {
      let generatedUsername = '';
      if (formData.primaryEmail) {
        generatedUsername = formData.primaryEmail.split('@')[0];
      } else if (formData.primaryFirstName && formData.primaryLastName) {
        generatedUsername = `${formData.primaryFirstName.toLowerCase()}.${formData.primaryLastName.toLowerCase()}`;
      }
      if (generatedUsername && generatedUsername !== formData.username) {
        setFormData(prev => ({ ...prev, username: generatedUsername }));
      }
    }
  }, [formData.primaryEmail, formData.primaryFirstName, formData.primaryLastName, formData.username]);

  const handleStandardChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleCustomChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      customFieldsValues: {
        ...prev.customFieldsValues,
        [key]: value
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    try {
      // Zod Validation for standard fields
      // We need to construct an object that matches what schema expects
      const validationPayload = {
        ...formData,
      };

      const validatedData = parentSchema.parse(validationPayload);

      // Validate required custom fields
      const customErrors: Record<string, string> = {};
      customFields.forEach(field => {
        if (field.required) {
          const val = formData.customFieldsValues[field.field_key];
          if (!val || (Array.isArray(val) && val.length === 0)) {
            customErrors[`custom_${field.field_key}`] = `${field.label} is required`;
          }
        }
      });

      if (Object.keys(customErrors).length > 0) {
        setFormErrors(customErrors);
        toast.error("Please fill in all required custom fields");
        return;
      }

      setIsSubmitting(true);

      const response = await createParent({
        school_id: user?.school_id, // Admin's base school_id (parents are school-wide)
        first_name: validatedData.primaryFirstName,
        last_name: validatedData.primaryLastName,
        email: validatedData.primaryEmail || undefined,
        phone: validatedData.primaryPhone,
        password: formData.password || undefined, // FIX: Send the frontend-generated password to backend
        occupation: validatedData.primaryOccupation || undefined,
        workplace: formData.primaryWorkplace || undefined,
        income: formData.primaryIncome || undefined,
        cnic: validatedData.primaryCNIC || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        zip_code: formData.zipCode || undefined,
        country: formData.country || undefined,
        emergency_contact_name: formData.emergencyContactName || undefined,
        emergency_contact_relation: formData.emergencyContactRelation || undefined,
        emergency_contact_phone: formData.emergencyContactPhone || undefined,
        notes: formData.notes || undefined,
        custom_fields: formData.customFieldsValues,
        metadata: {
          secondary_parent: formData.relationshipType === 'both' || formData.relationshipType === 'guardian' ? {
            first_name: formData.secondaryFirstName,
            last_name: formData.secondaryLastName,
            cnic: formData.secondaryCNIC,
            email: formData.secondaryEmail,
            phone: formData.secondaryPhone,
            occupation: formData.secondaryOccupation,
            workplace: formData.secondaryWorkplace,
            income: formData.secondaryIncome,
          } : null,
          relationship_type: formData.relationshipType,
          guardian_relationship: formData.guardianRelationship,
        }
      });

      if (response.success) {
        toast.success("Parent/Guardian added successfully!");
        // Invalidate all parents cache to refresh the list
        await mutate((key) => Array.isArray(key) && key[0] === 'parents', undefined, { revalidate: true });
        onSuccess();
      } else {
        toast.error(response.error || "Failed to add parent");
      }
    } catch (error) {
      setIsSubmitting(false);
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.issues.forEach((err: z.ZodIssue) => {
          if (err.path) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setFormErrors(errors);
        toast.error("Please fix the errors in the form");

        // Simple tab switching logic based on errors
        const hasPrimaryError = Object.keys(errors).some(k => k.startsWith('primary'));
        const hasContactError = Object.keys(errors).some(k => ['address', 'city'].includes(k));

        if (errors.relationshipType) setActiveTab("relationship");
        else if (hasPrimaryError) setActiveTab("primary");
        else if (hasContactError) setActiveTab("contact");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPrimaryLabel = () => {
    switch (formData.relationshipType) {
      case "mother": return "Mother's";
      case "father": return "Father's";
      case "both": return "Mother's";
      case "guardian": return formData.guardianRelationship ? `${formData.guardianRelationship}'s` : "Guardian's";
      default: return "Primary Guardian's";
    }
  };

  const getSecondaryLabel = () => {
    switch (formData.relationshipType) {
      case "both": return "Father's";
      case "guardian": return "Secondary Guardian's";
      default: return "Secondary Guardian's";
    }
  };

  const showSecondarySection = formData.relationshipType === "both" || formData.relationshipType === "guardian";

  // Merge & Sort Fields Logic
  const getMergedFields = (categories: string[]) => {
    // 1. Filter standard fields (using ordered fields)
    const relevantStandard = orderedStandardFields.filter(f => categories.includes(f.category));

    // 2. Filter custom fields
    const relevantCustom = customFields.filter(f => {
      return categories.includes(f.category_id);
    }).map(f => {
      const finalSortOrder = f.sort_order !== undefined && f.sort_order !== null ? f.sort_order : 1000;
      console.log(`Parent Custom field "${f.label}" - Original sort_order: ${f.sort_order}, Final: ${finalSortOrder}`);
      return {
        ...f,
        isCustom: true,
        id: f.field_key,
        sort_order: finalSortOrder
      };
    });

    // 3. Merge
    const merged = [...relevantStandard, ...relevantCustom];

    console.log('Parent merged before sort:', merged.map(f => ({ label: f.label, sort_order: f.sort_order, isCustom: !!f.isCustom })));

    // 4. Sort
    const sorted = merged.sort((a, b) => {
      const aOrder = a.sort_order !== undefined && a.sort_order !== null ? a.sort_order : 1000;
      const bOrder = b.sort_order !== undefined && b.sort_order !== null ? b.sort_order : 1000;
      return aOrder - bOrder;
    });

    console.log('Parent merged after sort:', sorted.map(f => ({ label: f.label, sort_order: f.sort_order, isCustom: !!f.isCustom })));

    return sorted;
  };

  const renderField = (field: any) => {
    const isCustom = !!field.isCustom;
    // Initialize multi-select fields as arrays
    const defaultValue = field.type === 'multi-select' ? [] : '';
    const value = isCustom ? (formData.customFieldsValues[field.field_key] ?? defaultValue) : (formData[field.id] ?? defaultValue);
    const handleChange = (val: any) => isCustom ? handleCustomChange(field.field_key, val) : handleStandardChange(field.id, val);
    const error = isCustom ? formErrors[`custom_${field.field_key}`] : getFieldError(field.id);

    const widthClass = field.width === 'full' ? 'col-span-1 md:col-span-2' :
      field.width === 'third' ? 'col-span-1 md:col-span-1 lg:col-span-1' : // Approx 1/3 if grid is 3
        'col-span-1';

    // Wrapper Style
    const wrapperClass = `${widthClass} space-y-2`;

    // Helper for select options
    const renderSelect = () => (
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className={error ? "border-red-500" : ""}>
          <SelectValue placeholder={`Select ${field.label}`} />
        </SelectTrigger>
        <SelectContent>
          {field.options && field.options.length > 0 ? (
            field.options.map((opt: string) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))
          ) : (
            <SelectItem value="no-options" disabled>
              No options available
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    );

    return (
      <div key={field.id} className={wrapperClass}>
        <Label htmlFor={field.id}>
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </Label>

        {field.type === 'text' || field.type === 'email' || field.type === 'number' ? (
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
          renderSelect()
        ) : field.type === 'date' ? (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={error ? "border-red-500" : ""}
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

  // Handle Enter key to prevent auto-submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      // Allow Enter in textareas
      if (target.tagName === 'TEXTAREA') {
        return;
      }
      // Always prevent default Enter behavior to stop form auto-submission
      e.preventDefault();
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
      onSubmit={(e) => {
        // Always prevent default first
        e.preventDefault();
        
        const submitEvent = e.nativeEvent as SubmitEvent;
        
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

        handleSubmit(e);
      }} 
      onKeyDown={handleKeyDown}
      className="space-y-6"
    >
      <Tabs value={activeTab} className="w-full">
        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Step {activeTab === "relationship" ? "1" : activeTab === "primary" ? "2" : activeTab === "contact" ? "3" : "4"} of 4
            </span>
            <span className="text-sm text-muted-foreground">
              {activeTab === "relationship" && "Relationship Type"}
              {activeTab === "primary" && "Guardian Information"}
              {activeTab === "contact" && "Contact & Address"}
              {activeTab === "preferences" && "Preferences"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-[#57A3CC] to-[#022172] h-2 rounded-full transition-all duration-300"
              style={{
                width: activeTab === "relationship" ? "25%" : activeTab === "primary" ? "50%" : activeTab === "contact" ? "75%" : "100%"
              }}
            />
          </div>
        </div>

        {/* 1. Relationship Type */}
        <TabsContent value="relationship" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  Select Relationship Type <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={formData.relationshipType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, relationshipType: value }))}
                  className={getFieldError("relationshipType") ? "border border-red-500 rounded-lg p-4" : ""}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Radio options ... simplified for brevity but kept functional */}
                    {[{ id: 'mother', label: 'Mother Only', sub: 'Single mother guardian' },
                    { id: 'father', label: 'Father Only', sub: 'Single father guardian' },
                    { id: 'both', label: 'Both Parents', sub: 'Mother and father' },
                    { id: 'guardian', label: 'Guardian / Other', sub: 'Legal guardian or other' }].map((opt) => (
                      <div key={opt.id} className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-muted/50 cursor-pointer">
                        <RadioGroupItem value={opt.id} id={opt.id} />
                        <Label htmlFor={opt.id} className="flex-1 cursor-pointer">
                          <div className="font-semibold">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.sub}</div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
                {getFieldError("relationshipType") && <p className="text-sm text-red-500">{getFieldError("relationshipType")}</p>}
              </div>

              {/* Guardian Relationship Input */}
              {formData.relationshipType === 'guardian' && (
                <div className="space-y-2">
                  <Label htmlFor="guardianRelationship">Specify Relationship</Label>
                  <Input
                    id="guardianRelationship"
                    value={formData.guardianRelationship}
                    onChange={(e) => setFormData(prev => ({ ...prev, guardianRelationship: e.target.value }))}
                    placeholder="e.g. Uncle"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Primary Guardian & Info (Mixed with Personal/Professional fields) */}
        <TabsContent value="primary" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <h3 className="text-lg font-semibold">{getPrimaryLabel()} Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Render Primary fields (Personal + Professional) sorted */}
                {getMergedFields(['personal', 'professional']).map(renderField)}
              </div>

              {/* Secondary Guardian Section (Hardcoded for now as it doesn't map cleanly to global custom fields yet, or usage is complex) */}
              {showSecondarySection && (
                <>
                  <hr className="my-6 col-span-2" />
                  <h3 className="text-lg font-semibold">{getSecondaryLabel()} Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Manually render Secondary fields for now as they are not in the main 'custom field' flow typically */}
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input value={formData.secondaryFirstName} onChange={(e) => handleStandardChange('secondaryFirstName', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input value={formData.secondaryLastName} onChange={(e) => handleStandardChange('secondaryLastName', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>CNIC</Label>
                      <Input value={formData.secondaryCNIC} onChange={(e) => handleStandardChange('secondaryCNIC', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={formData.secondaryPhone} onChange={(e) => handleStandardChange('secondaryPhone', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={formData.secondaryEmail} onChange={(e) => handleStandardChange('secondaryEmail', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Occupation</Label>
                      <Input value={formData.secondaryOccupation} onChange={(e) => handleStandardChange('secondaryOccupation', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Workplace</Label>
                      <Input value={formData.secondaryWorkplace} onChange={(e) => handleStandardChange('secondaryWorkplace', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Income</Label>
                      <Input value={formData.secondaryIncome} onChange={(e) => handleStandardChange('secondaryIncome', e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Contact Info */}
        <TabsContent value="contact" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <h3 className="text-lg font-semibold">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['contact']).map(renderField)}
              </div>

              <hr className="my-6" />
              <h3 className="text-lg font-semibold">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {getMergedFields(['emergency']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Preferences / System */}
        <TabsContent value="preferences" className="space-y-6 mt-6">
          <Card>
            <CardContent className="pt-6 space-y-6">
              <h3 className="text-lg font-semibold">System Access</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getMergedFields(['system']).map(renderField)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between pt-4">
        <Button type="button" variant="outline"
          onClick={() => {
            if (activeTab === 'primary') setActiveTab('relationship');
            else if (activeTab === 'contact') setActiveTab('primary');
            else if (activeTab === 'preferences') setActiveTab('contact');
          }}
          disabled={activeTab === 'relationship'}
        >
          Back
        </Button>

        {activeTab !== 'preferences' ? (
          <Button type="button" onClick={() => {
            if (activeTab === 'relationship' && !formData.relationshipType) {
              toast.error("Please select a relationship type");
              return;
            }
            if (activeTab === 'relationship') setActiveTab('primary');
            else if (activeTab === 'primary') setActiveTab('contact');
            else if (activeTab === 'contact') setActiveTab('preferences');
          }} className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white">
            Next
          </Button>
        ) : (
          <Button 
            type="submit" 
            ref={submitButtonRef}
            disabled={isSubmitting} 
            className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
          >
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Add Parent"}
          </Button>
        )}
      </div>
    </form>
  );
}
