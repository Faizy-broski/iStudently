"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { onboardSchool } from "@/lib/api/schools";
import { handleApiError } from "@/lib/utils/error-handler";
import { createClient } from "@/lib/supabase/client";
import { billingPlansApi, BillingPlan, calculateBillingAmount, calculateDueDate } from "@/lib/api/billing";
import { Loader2, Building2, User, Mail, Lock, Globe, MapPin, Check, Upload, X, DollarSign, Calendar, FileText, Eye, EyeOff, Clock } from "lucide-react";

// Mirrors backend/src/services/username.service.ts so the preview shown here
// matches what would be auto-derived server-side if left blank.
function generateSuggestedPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
function generateSuggestedUsername(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export interface OnboardSuccessResult {
  schoolName: string;
  logoUrl?: string | null;
  adminName: string;
  adminEmail: string;
  username: string;
  password: string;
}

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
  adminUsername: z.string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, hyphens, and underscores")
    .optional()
    .or(z.literal("")),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  adminPasswordConfirm: z.string(),
  
  // Billing & Subscription
  billingPlanId: z.string().min(1, "Please select a billing plan"),
  billingCycle: z.enum(["Monthly", "Quarterly", "Yearly"]),
  startDate: z.string().min(1, "Start date is required"),

  // Trial / Test Access
  isTrial: z.boolean().optional(),
  trialDuration: z.enum(["5days", "2weeks", "1month", "custom"]).optional(),
  trialEndDate: z.string().optional(),
}).refine((data) => data.adminPassword === data.adminPasswordConfirm, {
  message: "Passwords don't match",
  path: ["adminPasswordConfirm"],
});

type OnboardSchoolFormData = z.infer<typeof onboardSchoolSchema>;

interface OnboardSchoolFormProps {
  onSuccess: (result: OnboardSuccessResult) => void;
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
      isTrial: false,
      trialDuration: "2weeks",
    },
  });

  // Pre-fill admin username/password with a strong auto-generated suggestion
  // as soon as the form mounts — still fully editable afterward.
  useEffect(() => {
    setValue("adminUsername", generateSuggestedUsername());
    const suggestedPassword = generateSuggestedPassword();
    setValue("adminPassword", suggestedPassword);
    setValue("adminPasswordConfirm", suggestedPassword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      ? ['adminFirstName', 'adminLastName', 'adminEmail', 'adminUsername', 'adminPassword', 'adminPasswordConfirm'] as const
      : ['billingPlanId', 'billingCycle', 'startDate'] as const;
    
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
            adminUsername: 'Username',
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

      // Calculate trial end date, if this is a trial account
      let trialEndsAt: string | null = null;
      if (data.isTrial) {
        if (data.trialDuration === "custom" && data.trialEndDate) {
          trialEndsAt = new Date(data.trialEndDate).toISOString();
        } else {
          const days = data.trialDuration === "5days" ? 5 : data.trialDuration === "1month" ? 30 : 14;
          const end = new Date(data.startDate);
          end.setDate(end.getDate() + days);
          trialEndsAt = end.toISOString();
        }
      }

      await onboardSchool({
        school: {
          name: data.schoolName,
          slug: data.schoolSlug,
          contact_email: data.contactEmail,
          website: data.website || null,
          logo_url: logoUrl,
          address: data.address,
          is_trial: !!data.isTrial,
          trial_ends_at: trialEndsAt,
        },
        admin: {
          first_name: data.adminFirstName,
          last_name: data.adminLastName,
          email: data.adminEmail,
          password: data.adminPassword,
          username: data.adminUsername || undefined,
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

      const result: OnboardSuccessResult = {
        schoolName: data.schoolName,
        logoUrl,
        adminName: `${data.adminFirstName} ${data.adminLastName}`,
        adminEmail: data.adminEmail,
        username: data.adminUsername || "",
        password: data.adminPassword,
      };

      reset(); // Reset form after successful submission
      setCurrentStep(1); // Reset to first step
      setLogoFile(null);
      setLogoPreview(null);
      onSuccess(result);
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
                    : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
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
                  currentStep >= step.number ? "text-[#022172] dark:text-[#57A3CC]" : "text-gray-400 dark:text-gray-500"
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
                    : "bg-gray-200 dark:bg-gray-800"
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
            <h3 className="text-xl font-semibold text-[#022172] dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              School Information
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Enter the basic details about the school</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="schoolName" className="text-gray-700 dark:text-gray-300">
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
                className="border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
              />
              {errors.schoolName && (
                <p className="text-sm text-red-500">{errors.schoolName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="schoolSlug" className="text-gray-700 dark:text-gray-300">
                School Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="schoolSlug"
                {...register("schoolSlug")}
                placeholder="e.g., springfield-high"
                disabled={isSubmitting}
                className="border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
              />
              {errors.schoolSlug && (
                <p className="text-sm text-red-500">{errors.schoolSlug.message}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Used in URLs and must be unique
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="text-gray-700 dark:text-gray-300">
                Contact Email <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="contactEmail"
                  type="email"
                  {...register("contactEmail")}
                  placeholder="contact@school.edu"
                  className="pl-10 border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
                  disabled={isSubmitting}
                />
              </div>
              {errors.contactEmail && (
                <p className="text-sm text-red-500">{errors.contactEmail.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website" className="text-gray-700 dark:text-gray-300">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="website"
                  type="url"
                  {...register("website")}
                  placeholder="https://www.school.edu"
                  className="pl-10 border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
                  disabled={isSubmitting}
                />
              </div>
              {errors.website && (
                <p className="text-sm text-red-500">{errors.website.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo" className="text-gray-700 dark:text-gray-300">School Logo</Label>
            <div className="space-y-3">
              {logoPreview ? (
                <div className="flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-850">
                  <img 
                    src={logoPreview} 
                    alt="Logo preview" 
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{logoFile?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{(logoFile!.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeLogo}
                    disabled={isSubmitting}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 dark:border-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="logo-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 dark:border-gray-700 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF (MAX. 2MB)</p>
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
            <Label htmlFor="address" className="text-gray-700 dark:text-gray-300">
              Address <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="address"
                {...register("address")}
                placeholder="123 Main St, City, State, ZIP"
                className="pl-10 border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
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
            <h3 className="text-xl font-semibold text-[#022172] dark:text-white flex items-center gap-2">
              <User className="h-5 w-5" />
              School Admin Credentials
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Create login credentials for the school administrator
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="adminFirstName" className="text-gray-700 dark:text-gray-300">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminFirstName"
                {...register("adminFirstName")}
                placeholder="John"
                disabled={isSubmitting}
                className="border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
              />
              {errors.adminFirstName && (
                <p className="text-sm text-red-500">{errors.adminFirstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminLastName" className="text-gray-700 dark:text-gray-300">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adminLastName"
                {...register("adminLastName")}
                placeholder="Doe"
                disabled={isSubmitting}
                className="border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
              />
              {errors.adminLastName && (
                <p className="text-sm text-red-500">{errors.adminLastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminEmail" className="text-gray-700 dark:text-gray-300">
              Email <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="adminEmail"
                type="email"
                {...register("adminEmail")}
                placeholder="admin@school.edu"
                className="pl-10 border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
                disabled={isSubmitting}
              />
            </div>
            {errors.adminEmail && (
              <p className="text-sm text-red-500">{errors.adminEmail.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adminUsername" className="text-gray-700 dark:text-gray-300">
              Username <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(auto-generated — edit if you want a specific value)</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="adminUsername"
                type="text"
                {...register("adminUsername")}
                placeholder="e.g. john.doe"
                className="pl-10 border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
                disabled={isSubmitting}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">Letters, numbers, dots, hyphens, and underscores only</p>
            {errors.adminUsername && (
              <p className="text-sm text-red-500">{errors.adminUsername.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="adminPassword" className="text-gray-700 dark:text-gray-300">
                Password <span className="text-red-500">*</span>{" "}
                <span className="text-gray-400 dark:text-gray-500 text-xs font-normal">(auto-generated)</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="adminPassword"
                  type={showPassword ? "text" : "password"}
                  {...register("adminPassword")}
                  placeholder="••••••••"
                  className="pl-10 pr-10 border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
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
              <Label htmlFor="adminPasswordConfirm" className="text-gray-700 dark:text-gray-300">
                Confirm Password <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="adminPasswordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  {...register("adminPasswordConfirm")}
                  placeholder="••••••••"
                  className="pl-10 pr-10 border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
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
            <h3 className="text-xl font-semibold text-[#022172] dark:text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Subscription Plan & Billing
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a subscription plan and billing cycle for the school
            </p>
          </div>

          {/* Trial / Test Access */}
          <div className="space-y-2 p-4 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/10">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isTrial"
                checked={watch("isTrial") || false}
                onCheckedChange={(checked) => setValue("isTrial", checked === true)}
                disabled={isSubmitting}
              />
              <label
                htmlFor="isTrial"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none flex items-center gap-1.5"
              >
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                This is a test / trial account
              </label>
            </div>

            {watch("isTrial") && (
              <div className="pl-6 pt-2 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-700 dark:text-gray-300">Trial Duration</Label>
                  <Select
                    value={watch("trialDuration") || "2weeks"}
                    onValueChange={(value) => setValue("trialDuration", value as any)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-56 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5days">5 Days</SelectItem>
                      <SelectItem value="2weeks">2 Weeks</SelectItem>
                      <SelectItem value="1month">1 Month</SelectItem>
                      <SelectItem value="custom">Custom End Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {watch("trialDuration") === "custom" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="trialEndDate" className="text-gray-700 dark:text-gray-300">Trial End Date</Label>
                    <Input
                      id="trialEndDate"
                      type="date"
                      {...register("trialEndDate")}
                      disabled={isSubmitting}
                      className="w-56 border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                )}

                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Access will automatically be blocked for this school once the trial ends.
                </p>
              </div>
            )}
          </div>

          {/* Subscription Plan */}
          <div className="space-y-2">
            <Label htmlFor="billingPlanId" className="text-gray-700 dark:text-gray-300">
              Subscription Plan <span className="text-red-500">*</span>
            </Label>
            {loadingPlans ? (
              <div className="h-11 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
            ) : (
              <Select
                value={watch("billingPlanId")}
                onValueChange={(value) => setValue("billingPlanId", value)}
                disabled={isSubmitting || billingPlans.length === 0}
              >
                <SelectTrigger className="border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white">
                  <SelectValue placeholder="Select a billing plan" />
                </SelectTrigger>
                <SelectContent>
                  {billingPlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{plan.name}</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">
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
              <p className="text-sm text-amber-600 dark:text-amber-400">No billing plans available. Please contact administrator.</p>
            )}
          </div>

          {/* Billing Cycle */}
          <div className="space-y-2">
            <Label htmlFor="billingCycle" className="text-gray-700 dark:text-gray-300">
              Billing Cycle <span className="text-red-500">*</span>
            </Label>
            <Select
              value={watch("billingCycle")}
              onValueChange={(value) => setValue("billingCycle", value as any)}
              disabled={isSubmitting}
            >
              <SelectTrigger className="border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white">
                <SelectValue placeholder="Select billing cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Monthly">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">Monthly</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">Pay monthly</span>
                  </div>
                </SelectItem>
                <SelectItem value="Quarterly">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">Quarterly</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">Save 8% annually</span>
                  </div>
                </SelectItem>
                <SelectItem value="Yearly">
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">Yearly</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-4">Save 15% annually</span>
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
            <Label htmlFor="startDate" className="text-gray-700 dark:text-gray-300">
              Subscription Start Date <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
                className="pl-10 border-gray-300 dark:border-gray-700 focus:border-[#57A3CC] focus:ring-[#57A3CC] dark:bg-gray-800 dark:text-white"
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
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-955 dark:to-indigo-955 p-6 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/10">
            <h4 className="font-bold text-[#022172] dark:text-white mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#57A3CC]" />
              Billing Summary
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Plan:</span>
                <span className="font-semibold text-[#022172] dark:text-sky-300">
                  {billingPlans.find(p => p.id === watch("billingPlanId"))?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Billing Cycle:</span>
                <span className="font-semibold text-[#022172] dark:text-sky-300">{watch("billingCycle")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Start Date:</span>
                <span className="font-semibold text-[#022172] dark:text-sky-300">
                  {watch("startDate") ? new Date(watch("startDate")).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="border-t border-blue-300 dark:border-blue-900 mt-3 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">First Payment:</span>
                  <span className="text-2xl font-bold text-[#57A3CC] dark:text-[#57A3CC]">
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
      <div className="flex justify-between pt-6 border-t dark:border-gray-800">
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            prevStep();
          }}
          disabled={currentStep === 1 || isSubmitting}
          className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
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
