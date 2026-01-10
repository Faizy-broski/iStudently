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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { schoolApi } from "@/lib/api/schools";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Upload, X } from "lucide-react";
import ConfirmationDialog from "@/components/super-admin/ConfirmationDialog";

const editSchoolSchema = z.object({
  name: z.string().min(2, "School name must be at least 2 characters"),
  contact_email: z.string().email("Invalid email address"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.string().optional(),
});

type EditSchoolFormData = z.infer<typeof editSchoolSchema>;

interface School {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(school.logo_url);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<EditSchoolFormData | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EditSchoolFormData>({
    resolver: zodResolver(editSchoolSchema),
    defaultValues: {
      name: school.name,
      contact_email: school.contact_email,
      website: school.website || "",
      address: school.address || "",
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type", {
        description: "Please upload an image file",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Please upload an image smaller than 2MB",
      });
      return;
    }

    setLogoFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
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

      const { data, error } = await supabase.storage
        .from("school-logos")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        toast.error("Logo upload failed", {
          description: error.message,
        });
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("school-logos").getPublicUrl(fileName);

      return publicUrl;
    } catch (error: unknown) {
      toast.error("Error uploading logo", {
        description: error.message,
      });
      return null;
    } finally {
      setUploadingLogo(false);
    }
  };

  const onSubmit = async (data: EditSchoolFormData) => {
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  const handleConfirmedSubmit = async () => {
    if (!pendingFormData) return;

    try {
      setIsSubmitting(true);
      setShowConfirmDialog(false);

      let logo_url = school.logo_url;

      // Upload new logo if selected
      if (logoFile) {
        const uploadedUrl = await uploadLogoToSupabase(logoFile);
        if (uploadedUrl) {
          logo_url = uploadedUrl;
        }
      }

      const updateData = {
        name: pendingFormData.name,
        contact_email: pendingFormData.contact_email,
        website: pendingFormData.website || null,
        address: pendingFormData.address || null,
        logo_url,
      };

      const response = await schoolApi.update(school.id, updateData);

      if (response.success) {
        toast.success("School updated successfully");
        onSuccess();
      } else {
        toast.error("Failed to update school", {
          description: response.error,
        });
      }
    } catch (error: any) {
      toast.error("Error updating school", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
      setPendingFormData(null);
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit School</SheetTitle>
          <SheetDescription>
            Update school information and settings
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>School Logo</Label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                  />
                  {logoFile && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                  <Upload className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  disabled={uploadingLogo}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG up to 2MB
                </p>
              </div>
            </div>
          </div>

          {/* School Name */}
          <div className="space-y-2">
            <Label htmlFor="name">School Name *</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Enter school name"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact Email *</Label>
            <Input
              id="contact_email"
              type="email"
              {...register("contact_email")}
              placeholder="contact@school.com"
            />
            {errors.contact_email && (
              <p className="text-sm text-red-500">
                {errors.contact_email.message}
              </p>
            )}
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              {...register("website")}
              placeholder="https://school.com"
            />
            {errors.website && (
              <p className="text-sm text-red-500">{errors.website.message}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="123 Main St, City, State ZIP"
            />
            {errors.address && (
              <p className="text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 hover:bg-gray-100 transition-all duration-300"
              disabled={isSubmitting || uploadingLogo}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gradient-blue hover:shadow-lg hover:scale-[1.02] transition-all duration-300"
              disabled={isSubmitting || uploadingLogo}
            >
              {isSubmitting || uploadingLogo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadingLogo ? "Uploading..." : "Saving..."}
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          title="Update School Information?"
          description={`Are you sure you want to update the information for "${school.name}"? This will change the school's details immediately.`}
          confirmText="Update School"
          onConfirm={handleConfirmedSubmit}
          variant="default"
          loading={isSubmitting || uploadingLogo}
        />
      </SheetContent>
    </Sheet>
  );
}
