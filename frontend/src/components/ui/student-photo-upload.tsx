"use client";

import * as React from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface StudentPhotoUploadProps {
    value?: string;
    onChange: (url: string) => void;
    schoolId: string;
    studentId?: string; // Optional - for existing students
    label?: string;
    className?: string;
}

const ALLOWED_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

export function StudentPhotoUpload({
    value,
    onChange,
    schoolId,
    studentId,
    label = "Upload Photo",
    className
}: StudentPhotoUploadProps) {
    const [preview, setPreview] = React.useState<string | null>(value || null);
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Update preview when value changes externally
    React.useEffect(() => {
        setPreview(value || null);
    }, [value]);

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
            toast.error("File too large. Maximum size is 1MB");
            return;
        }

        setIsUploading(true);

        try {
            // Create Supabase client
            const supabase = createClient();

            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${studentId || 'new'}-${Date.now()}.${fileExt}`;
            const filePath = `${schoolId}/${fileName}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('students-profile-pictures')
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
                .from('students-profile-pictures')
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

    const clearFile = async () => {
        // If there's an existing file in storage, we could delete it here
        // For now, just clear the preview and value
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
                id="student-photo-upload"
                disabled={isUploading}
            />

            {!preview ? (
                <label
                    htmlFor="student-photo-upload"
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-[#57A3CC]/50 hover:border-[#022172]/50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isUploading ? (
                            <>
                                <Loader2 className="w-8 h-8 mb-2 text-[#57A3CC] animate-spin" />
                                <p className="text-sm text-gray-500">Uploading...</p>
                            </>
                        ) : (
                            <>
                                <Upload className="w-8 h-8 mb-2 text-[#57A3CC]" />
                                <p className="mb-2 text-sm text-gray-500">
                                    <span className="font-semibold">{label}</span>
                                </p>
                                <p className="text-xs text-gray-500">PNG, JPEG, WebP, SVG (max 1MB)</p>
                            </>
                        )}
                    </div>
                </label>
            ) : (
                <div className="relative w-full border rounded-lg p-4 bg-gray-50">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={clearFile}
                        disabled={isUploading}
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    <img
                        src={preview}
                        alt="Student Photo"
                        className="w-full h-32 object-contain rounded"
                    />
                </div>
            )}
        </div>
    );
}
