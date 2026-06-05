"use client";

import * as React from "react";
import { Upload, X, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadProfilePhoto } from "@/lib/api/storage";
import { toast } from "sonner";

interface StudentPhotoUploadProps {
    value?: string;
    onChange: (url: string) => void;
    schoolId: string;
    studentId?: string;
    role?: string; // 'student' | 'teacher' | 'staff' | 'parent' — used for storage path
    label?: string;
    className?: string;
}


export function StudentPhotoUpload({
    value,
    onChange,
    schoolId,
    studentId,
    role = 'student',
    label = "Upload Photo",
    className
}: StudentPhotoUploadProps) {
    const [preview, setPreview] = React.useState<string | null>(value || null);
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setPreview(value || null);
    }, [value]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!schoolId) {
            toast.error('School ID is required to upload a photo');
            return;
        }

        setIsUploading(true);
        const res = await uploadProfilePhoto(file, schoolId, role, studentId);
        setIsUploading(false);

        if (!res.success || !res.url) {
            toast.error(res.error || 'Failed to upload photo');
            return;
        }

        setPreview(res.url);
        onChange(res.url);
        toast.success('Photo uploaded successfully!');

        if (fileInputRef.current) fileInputRef.current.value = '';
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
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-[#57A3CC]/50 hover:border-[#022172]/50 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                <div className="relative w-full border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 group">
                    {/* Remove button */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 z-10 h-6 w-6 bg-black/40 hover:bg-black/60 text-white rounded-full"
                        onClick={clearFile}
                        disabled={isUploading}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>

                    {/* Clickable image with change overlay */}
                    <div
                        className="relative cursor-pointer"
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                    >
                        <img
                            src={preview}
                            alt="Student Photo"
                            className="w-full h-32 object-contain rounded"
                        />
                        {/* Hover overlay to indicate editability */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            {isUploading ? (
                                <Loader2 className="h-6 w-6 text-white animate-spin opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                                <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="h-6 w-6 text-white" />
                                    <span className="text-white text-xs font-medium">Change Photo</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
