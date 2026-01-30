"use client";

import * as React from "react";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface StaffPhotoUploadProps {
    value?: string;
    onChange: (url: string) => void;
    schoolId: string;
    staffName?: string;
    label?: string;
    className?: string;
}

const ALLOWED_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export function StaffPhotoUpload({
    value,
    onChange,
    schoolId,
    staffName = '',
    label = "Upload Photo",
    className
}: StaffPhotoUploadProps) {
    const [preview, setPreview] = React.useState<string | null>(value || null);
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Update preview when value changes externally
    React.useEffect(() => {
        setPreview(value || null);
    }, [value]);

    const getInitials = () => {
        if (staffName) {
            const names = staffName.trim().split(' ');
            if (names.length >= 2) {
                return `${names[0][0]}${names[1][0]}`.toUpperCase();
            }
            return staffName[0]?.toUpperCase() || 'S';
        }
        return 'S';
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            toast.error("Invalid file type. Allowed: PNG, JPEG, WebP, SVG");
            return;
        }

        // Validate file size
        if (file.size > MAX_SIZE_BYTES) {
            toast.error("File too large. Maximum size is 2MB");
            return;
        }

        setIsUploading(true);

        try {
            // Create Supabase client
            const supabase = createClient();

            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `staff-${Date.now()}.${fileExt}`;
            const filePath = `${schoolId}/${fileName}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('staff_profile_photos')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Upload error:', error);
                toast.error(`Upload failed: ${error.message}`);
                return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('staff_profile_photos')
                .getPublicUrl(data.path);

            const publicUrl = urlData.publicUrl;

            setPreview(publicUrl);
            onChange(publicUrl);
            toast.success("Photo uploaded successfully!");
        } catch (err: any) {
            console.error('Upload error:', err);
            toast.error("Failed to upload photo");
        } finally {
            setIsUploading(false);
        }
    };

    const clearFile = () => {
        setPreview(null);
        onChange("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className={className}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/svg+xml,image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="staff-photo-upload"
                disabled={isUploading}
            />

            <div className="flex flex-col items-center gap-4">
                {/* Avatar Preview */}
                <div className="relative">
                    <Avatar className="h-28 w-28 border-4 border-gray-100 shadow-md">
                        <AvatarImage src={preview || ''} alt="Staff photo" />
                        <AvatarFallback className="bg-[#022172] text-white text-2xl">
                            {getInitials()}
                        </AvatarFallback>
                    </Avatar>

                    {preview && !isUploading && (
                        <button
                            type="button"
                            onClick={clearFile}
                            className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition-colors"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}

                    {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                            <Loader2 className="h-6 w-6 text-white animate-spin" />
                        </div>
                    )}
                </div>

                {/* Upload Button */}
                <label
                    htmlFor="staff-photo-upload"
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${isUploading
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-[#57A3CC]/10 text-[#57A3CC] hover:bg-[#57A3CC]/20'
                        }`}
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Camera className="h-4 w-4" />
                            {preview ? 'Change Photo' : label}
                        </>
                    )}
                </label>

                <p className="text-xs text-gray-400 text-center">
                    PNG, JPG, WebP or SVG. Max 2MB
                </p>
            </div>
        </div>
    );
}
