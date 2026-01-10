"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { onboardSchool } from "@/lib/api/schools";
import { handleApiError } from "@/lib/utils/error-handler";
import { createClient } from "@/lib/supabase/client";
import { billingPlansApi, BillingPlan, calculateBillingAmount, calculateDueDate } from "@/lib/api/billing";
import { Loader2, Building2, User, Mail, Lock, Globe, MapPin, Check, Upload, X, DollarSign, Calendar, FileText, Eye, EyeOff } from "lucide-react";

const onboardSchoolSchema = z.object({
  // School Information
  schoolName: z.string().min(2, "School name must be at least 2 characters"),
  schoolSlug: z.string()
    .min(2, "Slug must be at least 2 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  contactEmail: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.string().min(5, "Address must be at least 5 characters"),
  
  // Admin Credentials
  adminFirstName: z.string().min(2, "First name must be at least 2 characters"),
  adminLastName: z.string().min(2, "Last name must be at least 2 characters"),
  adminEmail: z.string().email("Invalid email address"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  adminPasswordConfirm: z.string(),
  
  // Billing & Subscription
  billingPlanId: z.string().min(1, "Please select a billing plan"),
  billingCycle: z.enum(["Monthly", "Quarterly", "Yearly"]),
  startDate: z.string().min(1, "Start date is required"),
}).refine((data) => data.adminPassword === data.adminPasswordConfirm, {
  message: "Passwords don't match",
  path: ["adminPasswordConfirm"],
});

type OnboardSchoolFormData = z.infer<typeof onboardSchoolSchema>;

interface OnboardSchoolFormProps {
  onSuccess: (schoolName: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
}

export default function OnboardSchoolForm({ onSuccess, isSubmitting, setIsSubmitting }: OnboardSchoolFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
    reset,
  } = useForm<OnboardSchoolFormData>({
    resolver: zodResolver(onboardSchoolSchema),
    mode: "onSubmit",
    defaultValues: {
      billingCycle: "Monthly",
      startDate: new Date().toISOString().split('T')[0],
    },
  });

  // Fetch billing plans
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoadingPlans(true);
        const plans = await billingPlansApi.getAll();
        setBillingPlans(plans);
        // Set default plan if available
        if (plans.length > 0) {
          setValue("billingPlanId", plans[0].id);
        }
      } catch (error: any) {
        console.error("Failed to load billing plans:", error);
        toast.error("Failed to load billing plans", {
          description: "Please ensure billing tables are created in the database"
        });
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, [setValue]);

  const schoolName = watch("schoolName");

  // Auto-generate slug from school name
  const handleSchoolNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setValue("schoolSlug", slug);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Invalid file type", {
          description: "Please upload an image file (PNG, JPG, etc.)"
        });
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Logo must be less than 2MB"
        });
        return;
      }
      
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const uploadLogoToSupabase = async (file: File, schoolSlug: string): Promise<string | null> => {
    try {
      setUploadingLogo(true);
      const supabase = createClient();
      
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${schoolSlug}-${Date.now()}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('school-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) {
        toast.error("Failed to upload logo", {
          description: error.message
        });
        return null;
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('school-logos')
        .getPublicUrl(fileName);
      
      return publicUrl;
    } catch (error: any) {
      toast.error("Upload error", {
        description: error.message || "Unknown error occurred"
      });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const nextStep = async () => {
    // Validate current step fields before proceeding
    const fieldsToValidate = currentStep === 1 
      ? ['schoolName', 'schoolSlug', 'contactEmail', 'address'] as const
      : currentStep === 2
      ? ['adminFirstName', 'adminLastName', 'adminEmail', 'adminPassword', 'adminPasswordConfirm'] as const
      : ['subscriptionPlan', 'billingCycle', 'startDate'] as const;
    
    const isValid = await trigger(fieldsToValidate);
    
    if (!isValid) {
      // Show toast for each validation error
      fieldsToValidate.forEach((field) => {
        if (errors[field]) {
          const fieldLabels: Record<string, string> = {
            schoolName: 'School Name',
            schoolSlug: 'School Slug',
            contactEmail: 'Contact Email',
            address: 'Address',
            website: 'Website',
            adminFirstName: 'First Name',
            adminLastName: 'Last Name',
            adminEmail: 'Admin Email',
            adminPassword: 'Password',
            adminPasswordConfirm: 'Confirm Password',
            billingPlanId: 'Billing Plan',
            billingCycle: 'Billing Cycle',
            startDate: 'Start Date',
          };
          
          toast.error(`${fieldLabels[field]}: ${errors[field]?.message}`);
        }
      });
      return;
    }
    
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const steps = [
    { number: 1, title: "School Information" },
    { number: 2, title: "Admin Credentials" },
    { number: 3, title: "Plan & Billing" },
  ];

  const onSubmit = async (data: OnboardSchoolFormData) => {
    setIsSubmitting(true);
    try {
      // Upload logo if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogoToSupabase(logoFile, data.schoolSlug);
        if (!logoUrl) {
          toast.error("Logo upload failed", {
            description: "Proceeding without logo. You can add it later."
          });
        }
      }
      
      // Find selected billing plan
      const selectedPlan = billingPlans.find(p => p.id === data.billingPlanId);
      if (!selectedPlan) {
        throw new Error("Selected billing plan not found");
      }
      
      // Calculate billing amount based on plan and cycle
      const amount = calculateBillingAmount(selectedPlan, data.billingCycle);
      
      // Calculate due date based on start date and billing cycle
      const dueDate = calculateDueDate(data.startDate, data.billingCycle);
      
      await onboardSchool({
        school: {
          name: data.schoolName,
          slug: data.schoolSlug,
          contact_email: data.contactEmail,
          website: data.website || null,
          logo_url: logoUrl,
          address: data.address,
        },
        admin: {
          first_name: data.adminFirstName,
          last_name: data.adminLastName,
          email: data.adminEmail,
          password: data.adminPassword,
        },
        billing: {
          billing_plan_id: data.billingPlanId,
          billing_cycle: data.billingCycle,
          amount: amount,
          start_date: data.startDate,
          due_date: dueDate,
          payment_status: "unpaid",
        },
      });

      toast.success("School onboarded successfully!", {
        description: `${data.schoolName} has been created with admin account and billing`
      });
      reset(); // Reset form after successful submission
      setCurrentStep(1); // Reset to first step
      setLogoFile(null);
      setLogoPreview(null);
      onSuccess(data.schoolName);
    } catch (error: any) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={(e) => {
        if (e.nativeEvent?.submitter !== submitButtonRef.current) {
          e.preventDefault();
          return;
        }
        
        if (currentStep !== totalSteps) {
          e.preventDefault();
          return;
        }
        
        handleSubmit(onSubmit)(e);
      }}
      className="space-y-8"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          return false;
        }
      }}
    >
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  currentStep > step.number
                    ? "bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
                    : currentStep === step.number
                    ? "bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {currentStep > step.number ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`text-xs mt-2 font-medium ${
                  currentStep >= step.number ? "text-[#022172]" : "text-gray-400"
                }`}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-24 h-0.5 mx-4 mb-6 transition-all ${
                  currentStep > step.number
                    ? "bg-gradient-to-r from-[#57A3CC] to-[#022172]"
                    : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: School Information */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="space-y-1 mb-6">
            <h3 className="text-xl font-semibold text-[#022172] flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              School Information
            </h3>
            <p className="text-sm text-gray-500">Enter the basic details about the school</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="schoolName" className="text-gray-700">
                School Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schoolName"
                {...register("schoolName")}
                onChange={(e) => {
                  register("schoolName").onChange(e);
                  handleSchoolNameChange(e);
                }}
                placeholder="e.g., Springfield High School"
                disabled={isSubmitting}
                className="border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
              />
              {errors.schoolName && (
                <p className="text-sm text-red-500">{errors.schoolName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="schoolSlug" className="text-gray-700">
                School Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schoolSlug"
                {...register("schoolSlug")}
                placeholder="e.g., springfield-high"
                disabled={isSubmitting}
                className="border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
              />
              {errors.schoolSlug && (
                <p className="text-sm text-red-500">{errors.schoolSlug.message}</p>
              )}
              <p className="text-xs text-gray-500">
                Used in URLs and must be unique
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="text-gray-700">
                Contact Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="contactEmail"
                  type="email"
                  {...register("contactEmail")}
                  placeholder="contact@school.edu"
                  className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                  disabled={isSubmitting}
                />
              </div>
              {errors.contactEmail && (
                <p className="text-sm text-red-500">{errors.contactEmail.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website" className="text-gray-700">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="website"
                  type="url"
                  {...register("website")}
                  placeholder="https://www.school.edu"
                  className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                  disabled={isSubmitting}
                />
              </div>
              {errors.website && (
                <p className="text-sm text-red-500">{errors.website.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo" className="text-gray-700">School Logo</Label>
            <div className="space-y-3">
              {logoPreview ? (
                <div className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg">
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{logoFile?.name}</p>
                    <p className="text-xs text-gray-500">{(logoFile!.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeLogo}
                    disabled={isSubmitting}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="logo-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF (MAX. 2MB)</p>
                    </div>
                    <input
                      id="logo-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-gray-700">
              Address <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="address"
                {...register("address")}
                placeholder="123 Main St, City, State, ZIP"
                className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                disabled={isSubmitting}
              />
            </div>
            {errors.address && (
              <p className="text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Admin Credentials */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="space-y-1 mb-6">
            <h3 className="text-xl font-semibold text-[#022172] flex items-center gap-2">
              <User className="h-5 w-5" />
              School Admin Credentials
            </h3>
            <p className="text-sm text-gray-500">
              Create login credentials for the school administrator
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="adminFirstName" className="text-gray-700">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminFirstName"
                {...register("adminFirstName")}
                placeholder="John"
                disabled={isSubmitting}
                className="border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
              />
              {errors.adminFirstName && (
                <p className="text-sm text-red-500">{errors.adminFirstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminLastName" className="text-gray-700">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminLastName"
                {...register("adminLastName")}
                placeholder="Doe"
                disabled={isSubmitting}
                className="border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
              />
              {errors.adminLastName && (
                <p className="text-sm text-red-500">{errors.adminLastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail" className="text-gray-700">
              Email <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="adminEmail"
                type="email"
                {...register("adminEmail")}
                placeholder="admin@school.edu"
                className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                disabled={isSubmitting}
              />
            </div>
            {errors.adminEmail && (
              <p className="text-sm text-red-500">{errors.adminEmail.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="adminPassword" className="text-gray-700">
                Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="adminPassword"
                  type={showPassword ? "text" : "password"}
                  {...register("adminPassword")}
                  placeholder="••••••••"
                  className="pl-10 pr-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.adminPassword && (
                <p className="text-sm text-red-500">{errors.adminPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPasswordConfirm" className="text-gray-700">
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="adminPasswordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  {...register("adminPasswordConfirm")}
                  placeholder="••••••••"
                  className="pl-10 pr-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPasswordConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.adminPasswordConfirm && (
                <p className="text-sm text-red-500">{errors.adminPasswordConfirm.message}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Plan & Billing */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="space-y-1 mb-6">
            <h3 className="text-xl font-semibold text-[#022172] flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Subscription Plan & Billing
            </h3>
            <p className="text-sm text-gray-500">
              Select a subscription plan and billing cycle for the school
            </p>
          </div>

          {/* Subscription Plan */}
          <div className="space-y-2">
            <Label htmlFor="billingPlanId" className="text-gray-700">
              Subscription Plan <span className="text-red-500">*</span>
            </Label>
            {loadingPlans ? (
              <div className="h-11 bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <Select
                value={watch("billingPlanId")}
                onValueChange={(value) => setValue("billingPlanId", value)}
                disabled={isSubmitting || billingPlans.length === 0}
              >
                <SelectTrigger className="border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]">
                  <SelectValue placeholder="Select a billing plan" />
                </SelectTrigger>
                <SelectContent>
                  {billingPlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-sm text-gray-500 ml-4">
                          ${plan.monthly_price}/mo
                          {plan.max_students && ` - Up to ${plan.max_students} students`}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.billingPlanId && (
              <p className="text-sm text-red-500">{errors.billingPlanId.message}</p>
            )}
            {billingPlans.length === 0 && !loadingPlans && (
              <p className="text-sm text-amber-600">No billing plans available. Please contact administrator.</p>
            )}
          </div>

          {/* Billing Cycle */}
          <div className="space-y-2">
            <Label htmlFor="billingCycle" className="text-gray-700">
              Billing Cycle <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch("billingCycle")}
              onValueChange={(value) => setValue("billingCycle", value as any)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]">
                <SelectValue placeholder="Select billing cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Monthly">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">Monthly</span>
                    <span className="text-sm text-gray-500 ml-4">Pay monthly</span>
                  </div>
                </SelectItem>
                <SelectItem value="Quarterly">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">Quarterly</span>
                    <span className="text-sm text-gray-500 ml-4">Save 8% annually</span>
                  </div>
                </SelectItem>
                <SelectItem value="Yearly">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">Yearly</span>
                    <span className="text-sm text-gray-500 ml-4">Save 15% annually</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.billingCycle && (
              <p className="text-sm text-red-500">{errors.billingCycle.message}</p>
            )}
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-gray-700">
              Subscription Start Date <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
                className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                disabled={isSubmitting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
              />
            </div>
            {errors.startDate && (
              <p className="text-sm text-red-500">{errors.startDate.message}</p>
            )}
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <h4 className="font-bold text-[#022172] mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Billing Summary
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Plan:</span>
                <span className="font-semibold text-[#022172]">
                  {billingPlans.find(p => p.id === watch("billingPlanId"))?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Billing Cycle:</span>
                <span className="font-semibold text-[#022172]">{watch("billingCycle")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Start Date:</span>
                <span className="font-semibold text-[#022172]">
                  {watch("startDate") ? new Date(watch("startDate")).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="border-t border-blue-300 mt-3 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">First Payment:</span>
                  <span className="text-2xl font-bold text-[#57A3CC]">
                    ${(() => {
                      const selectedPlan = billingPlans.find(p => p.id === watch("billingPlanId"));
                      if (!selectedPlan) return 0;
                      return calculateBillingAmount(selectedPlan, watch("billingCycle"));
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            prevStep();
          }}
          disabled={currentStep === 1 || isSubmitting}
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Previous Step
        </Button>

        {currentStep < totalSteps ? (
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              nextStep();
            }}
            disabled={isSubmitting}
            className="gradient-blue text-white hover:opacity-90"
          >
            Next Step
          </Button>
        ) : (
          <Button
            type="submit"
            ref={submitButtonRef}
            disabled={isSubmitting}
            className="gradient-blue text-white hover:opacity-90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating School...
              </>
            ) : (
              "Onboard School"
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
