"use client";

import * as React from "react";
import { Upload, X, File } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  label?: string;
  className?: string;
}

export function FileUpload({ value, onChange, accept = "image/*", label = "Upload File", className }: FileUploadProps) {
  const [preview, setPreview] = React.useState<string | null>(value || null);
  const [fileName, setFileName] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreview(result);
        onChange(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = () => {
    setPreview(null);
    setFileName("");
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isImage = accept.includes("image");

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      
      {!preview ? (
        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors border-[#57A3CC]/50 hover:border-[#022172]/50"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-2 text-[#57A3CC]" />
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">{label}</span>
            </p>
            <p className="text-xs text-gray-500">Click to browse</p>
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
          >
            <X className="h-4 w-4" />
          </Button>
          
          {isImage ? (
            <img
              src={preview}
              alt="Preview"
              className="w-full h-32 object-contain rounded"
            />
          ) : (
            <div className="flex items-center gap-3">
              <File className="h-8 w-8 text-[#57A3CC]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileName}</p>
                <p className="text-xs text-gray-500">File uploaded</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
