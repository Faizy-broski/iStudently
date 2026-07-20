"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { schoolApi } from "@/lib/api/schools";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Upload,
  X,
  Building2,
  User,
  Mail,
  Globe,
  MapPin,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import ConfirmationDialog from "@/components/super-admin/ConfirmationDialog";
import { Spinner } from "@/components/ui/spinner";
import { SchoolLogo } from "@/components/shared/SchoolLogo";

const LOGO_SHAPE_OPTIONS: { value: "circle" | "rounded" | "square" | "rectangle"; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
  { value: "rectangle", label: "Rectangle" },
];

const schoolSchema = z.object({
  name: z.string().min(2, "School name must be at least 2 characters"),
  contact_email: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.string().optional(),
});

const adminSchema = z.object({
  admin_name: z.string().min(2, "Name must be at least 2 characters"),
  admin_email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dots, hyphens, and underscores only")
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional()
    .or(z.literal("")),
  password_confirm: z.string().optional().or(z.literal("")),
}).refine(
  (data) => !data.password || data.password === data.password_confirm,
  { message: "Passwords don't match", path: ["password_confirm"] }
);

type SchoolFormData = z.infer<typeof schoolSchema>;
type AdminFormData = z.infer<typeof adminSchema>;

interface School {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  logo_shape?: "circle" | "rounded" | "square" | "rectangle";
  logo_border_width?: number;
  logo_border_color?: string;
  website: string | null;
  contact_email: string;
  address: string | null;
  status: "active" | "suspended";
}

interface EditSchoolModalProps {
  school: School;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditSchoolModal({
  school,
  onClose,
  onSuccess,
}: EditSchoolModalProps) {
  const [activeTab, setActiveTab] = useState("school");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(school.logo_url);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [fetchingAdmin, setFetchingAdmin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [logoShape, setLogoShape] = useState<"circle" | "rounded" | "square" | "rectangle">("circle");
  const [logoBorderWidth, setLogoBorderWidth] = useState(0);
  const [logoBorderColor, setLogoBorderColor] = useState("#000000");

  const schoolForm = useForm<SchoolFormData>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: school.name,
      contact_email: school.contact_email,
      website: school.website || "",
      address: school.address || "",
    },
  });

  const adminForm = useForm<AdminFormData>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      admin_name: "",
      admin_email: "",
      username: "",
      password: "",
      password_confirm: "",
    },
  });

  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        setFetchingAdmin(true);
        const response = await schoolApi.getAdmin(school.id);
        if (response.success && response.data) {
          adminForm.reset({
            admin_name: response.data.admin_name || "",
            admin_email: response.data.admin_email || "",
            username: response.data.admin_username || "",
            password: "",
            password_confirm: "",
          });
        } else {
          toast.error("Failed to load admin information", {
            description: response.error,
          });
        }
      } catch (error: any) {
        toast.error("Error loading admin information", {
          description: error.message,
        });
      } finally {
        setFetchingAdmin(false);
      }
    };

    fetchAdmin();
  }, [school.id]);

  useEffect(() => {
    const fetchLogoAppearance = async () => {
      const response = await schoolApi.getLogoAppearance(school.id);
      if (response.success && response.data) {
        setLogoShape(response.data.logo_shape);
        setLogoBorderWidth(response.data.logo_border_width);
        setLogoBorderColor(response.data.logo_border_color);
      }
    };
    fetchLogoAppearance();
  }, [school.id]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type", { description: "Please upload an image file" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", { description: "Please upload an image smaller than 2MB" });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(school.logo_url);
  };

  const uploadLogoToSupabase = async (file: File): Promise<string | null> => {
    try {
      setUploadingLogo(true);
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${school.slug}-${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from("school-logos")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (error) {
        toast.error("Logo upload failed", { description: error.message });
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("school-logos")
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast.error("Error uploading logo", { description: error.message });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveClick = async () => {
    const schoolValid = await schoolForm.trigger();
    const adminValid = await adminForm.trigger();

    if (!schoolValid) {
      setActiveTab("school");
      return;
    }
    if (!adminValid) {
      setActiveTab("admin");
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      const schoolData = schoolForm.getValues();
      const adminData = adminForm.getValues();

      // Upload logo if new one selected
      let logo_url = school.logo_url;
      if (logoFile) {
        const uploadedUrl = await uploadLogoToSupabase(logoFile);
        if (uploadedUrl) logo_url = uploadedUrl;
      }

      // Update school info
      const schoolResponse = await schoolApi.update(school.id, {
        name: schoolData.name,
        contact_email: schoolData.contact_email,
        website: schoolData.website || null,
        address: schoolData.address || null,
        logo_url,
      });

      if (!schoolResponse.success) {
        toast.error("Failed to update school", { description: schoolResponse.error });
        return;
      }

      // Update logo display appearance
      const logoAppearanceResponse = await schoolApi.updateLogoAppearance(school.id, {
        logo_shape: logoShape,
        logo_border_width: logoBorderWidth,
        logo_border_color: logoBorderColor,
      });
      if (!logoAppearanceResponse.success) {
        toast.error("School updated but failed to update logo appearance", {
          description: logoAppearanceResponse.error,
        });
      }

      // Update admin info
      const adminUpdate: Record<string, string> = {
        admin_name: adminData.admin_name,
        admin_email: adminData.admin_email,
      };
      if (adminData.username?.trim()) {
        adminUpdate.username = adminData.username;
      }
      if (adminData.password?.trim()) {
        adminUpdate.password = adminData.password;
      }

      const adminResponse = await schoolApi.updateAdmin(school.id, adminUpdate);

      if (!adminResponse.success) {
        toast.error("School updated but failed to update admin", {
          description: adminResponse.error,
        });
        return;
      }

      toast.success("School updated successfully");
      onSuccess();
    } catch (error: any) {
      toast.error("Error updating school", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || uploadingLogo;

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-150 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit School</SheetTitle>
          <SheetDescription>
            Update school information and admin credentials
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="school" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                School Info
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Admin Credentials
              </TabsTrigger>
            </TabsList>

            {/* School Info Tab */}
            <TabsContent value="school" className="space-y-5 mt-6 animate-in fade-in duration-200">
              {/* Logo */}
              <div className="space-y-2">
                <Label className="text-gray-700">School Logo</Label>
                {logoPreview ? (
                  <div className="flex items-center gap-4 p-4 border-2 border-gray-200 rounded-lg">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      {logoFile ? (
                        <>
                          <p className="text-sm font-medium text-gray-700">{logoFile.name}</p>
                          <p className="text-xs text-gray-500">{(logoFile.size / 1024).toFixed(2)} KB</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Current logo</p>
                      )}
                    </div>
                    {logoFile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeLogo}
                        disabled={busy}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <label
                    htmlFor="logo-upload"
                    className="flex flex-col items-center justify-center w-full h-28 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  >
                    <Upload className="w-7 h-7 mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-400">PNG, JPG up to 2MB</p>
                    <input
                      id="logo-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={busy}
                    />
                  </label>
                )}
                {logoPreview && !logoFile && (
                  <label
                    htmlFor="logo-change"
                    className="inline-flex items-center gap-1.5 text-sm text-[#57A3CC] cursor-pointer hover:underline"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Change logo
                    <input
                      id="logo-change"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoChange}
                      disabled={busy}
                    />
                  </label>
                )}
              </div>

              {/* Logo Display */}
              <div className="space-y-3">
                <Label className="text-gray-700">Logo Display</Label>
                <div className="flex items-center gap-4">
                  <SchoolLogo
                    logoUrl={logoPreview}
                    alt="Logo preview"
                    shape={logoShape}
                    borderWidth={logoBorderWidth}
                    borderColor={logoBorderColor}
                    size={72}
                  />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {LOGO_SHAPE_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={logoShape === opt.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLogoShape(opt.value)}
                        disabled={busy}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Border Width (px)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={logoBorderWidth}
                      onChange={(e) => setLogoBorderWidth(Math.max(0, Math.min(10, Number(e.target.value) || 0)))}
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Border Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={logoBorderColor}
                        onChange={(e) => setLogoBorderColor(e.target.value)}
                        className="h-9 w-10 rounded-md cursor-pointer border border-gray-300 p-0.5 bg-white"
                        disabled={busy}
                      />
                      <Input
                        value={logoBorderColor}
                        onChange={(e) => setLogoBorderColor(e.target.value)}
                        className="flex-1 font-mono text-sm"
                        disabled={busy}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* School Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">
                  School Name <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    {...schoolForm.register("name")}
                    placeholder="e.g., Springfield High School"
                    className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                    disabled={busy}
                  />
                </div>
                {schoolForm.formState.errors.name && (
                  <p className="text-sm text-red-500">{schoolForm.formState.errors.name.message}</p>
                )}
              </div>

              {/* Contact Email */}
              <div className="space-y-2">
                <Label htmlFor="contact_email" className="text-gray-700">
                  Contact Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="contact_email"
                    type="email"
                    {...schoolForm.register("contact_email")}
                    placeholder="contact@school.edu"
                    className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                    disabled={busy}
                  />
                </div>
                {schoolForm.formState.errors.contact_email && (
                  <p className="text-sm text-red-500">{schoolForm.formState.errors.contact_email.message}</p>
                )}
              </div>

              {/* Website */}
              <div className="space-y-2">
                <Label htmlFor="website" className="text-gray-700">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="website"
                    type="url"
                    {...schoolForm.register("website")}
                    placeholder="https://www.school.edu"
                    className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                    disabled={busy}
                  />
                </div>
                {schoolForm.formState.errors.website && (
                  <p className="text-sm text-red-500">{schoolForm.formState.errors.website.message}</p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address" className="text-gray-700">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="address"
                    {...schoolForm.register("address")}
                    placeholder="123 Main St, City, State ZIP"
                    className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                    disabled={busy}
                  />
                </div>
                {schoolForm.formState.errors.address && (
                  <p className="text-sm text-red-500">{schoolForm.formState.errors.address.message}</p>
                )}
              </div>
            </TabsContent>

            {/* Admin Credentials Tab */}
            <TabsContent value="admin" className="space-y-5 mt-6 animate-in fade-in duration-200">
              {fetchingAdmin ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <Spinner size="md" className="text-[#57A3CC]" />
                  <p className="text-sm text-gray-500">Loading admin information...</p>
                </div>
              ) : (
                <>
                  {/* Admin Name */}
                  <div className="space-y-2">
                    <Label htmlFor="admin_name" className="text-gray-700">
                      Admin Full Name <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="admin_name"
                        {...adminForm.register("admin_name")}
                        placeholder="John Doe"
                        className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                        disabled={busy}
                      />
                    </div>
                    {adminForm.formState.errors.admin_name && (
                      <p className="text-sm text-red-500">{adminForm.formState.errors.admin_name.message}</p>
                    )}
                  </div>

                  {/* Username */}
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-gray-700">
                      Username{" "}
                      <span className="text-xs font-normal text-gray-400">(optional)</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="username"
                        {...adminForm.register("username")}
                        placeholder="e.g. john.doe"
                        className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                        disabled={busy}
                      />
                    </div>
                    <p className="text-xs text-gray-400">Letters, numbers, dots, hyphens, and underscores only</p>
                    {adminForm.formState.errors.username && (
                      <p className="text-sm text-red-500">{adminForm.formState.errors.username.message}</p>
                    )}
                  </div>

                  {/* Admin Email */}
                  <div className="space-y-2">
                    <Label htmlFor="admin_email" className="text-gray-700">
                      Admin Email <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="admin_email"
                        type="email"
                        {...adminForm.register("admin_email")}
                        placeholder="admin@school.edu"
                        className="pl-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                        disabled={busy}
                      />
                    </div>
                    {adminForm.formState.errors.admin_email && (
                      <p className="text-sm text-red-500">{adminForm.formState.errors.admin_email.message}</p>
                    )}
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-700">
                      New Password{" "}
                      <span className="text-xs font-normal text-gray-400">(leave blank to keep current)</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        {...adminForm.register("password")}
                        placeholder="••••••••"
                        className="pl-10 pr-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                        disabled={busy}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {adminForm.formState.errors.password && (
                      <p className="text-sm text-red-500">{adminForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password_confirm" className="text-gray-700">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password_confirm"
                        type={showPasswordConfirm ? "text" : "password"}
                        {...adminForm.register("password_confirm")}
                        placeholder="••••••••"
                        className="pl-10 pr-10 border-gray-300 focus:border-[#57A3CC] focus:ring-[#57A3CC]"
                        disabled={busy}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        tabIndex={-1}
                      >
                        {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {adminForm.formState.errors.password_confirm && (
                      <p className="text-sm text-red-500">{adminForm.formState.errors.password_confirm.message}</p>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 hover:bg-gray-100 transition-all duration-300"
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveClick}
              className="flex-1 gradient-blue hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
              disabled={busy || fetchingAdmin}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadingLogo ? "Uploading..." : "Saving..."}
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>

        <ConfirmationDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          title="Update School Information?"
          description={`Are you sure you want to update the information for "${school.name}"? This will immediately apply all changes including admin credentials.`}
          confirmText="Update School"
          onConfirm={handleConfirmedSubmit}
          variant="default"
          loading={busy}
        />
      </SheetContent>
    </Sheet>
  );
}
