"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Upload,
    FileText,
    X,
    Loader2,
    Save,
    FolderOpen,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
    getCategories,
    getDocumentFields,
    createBook,
    LibraryCategory,
    LibraryDocumentField,
} from "@/lib/api/library";
import { uploadLibraryDocument } from "@/lib/api/storage";
import { toast } from "sonner";

interface UploadDocumentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDocumentUploaded: () => void;
    preselectedCategoryId?: string | null;
}

const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDocumentDialog({
    open,
    onOpenChange,
    onDocumentUploaded,
    preselectedCategoryId,
}: UploadDocumentDialogProps) {
    const { user, profile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Data
    const [categories, setCategories] = useState<LibraryCategory[]>([]);
    const [customFields, setCustomFields] = useState<LibraryDocumentField[]>([]);
    const [isLoadingFields, setIsLoadingFields] = useState(false);

    // Form state
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
    const [title, setTitle] = useState("");
    const [author, setAuthor] = useState("");
    const [reference, setReference] = useState("");
    const [description, setDescription] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    // Load categories on open
    useEffect(() => {
        if (open && user?.access_token) {
            getCategories(user.access_token).then((res) => {
                if (res.success && res.data) setCategories(res.data);
            });
            // Pre-select category if provided
            if (preselectedCategoryId) {
                setSelectedCategoryId(preselectedCategoryId);
            }
        }
    }, [open, user?.access_token, preselectedCategoryId]);

    // Load custom fields when category changes
    const loadCustomFields = useCallback(async (categoryId: string) => {
        if (!user?.access_token || !categoryId) {
            setCustomFields([]);
            return;
        }
        try {
            setIsLoadingFields(true);
            const res = await getDocumentFields(user.access_token, categoryId);
            if (res.success && res.data) {
                setCustomFields(res.data.sort((a, b) => a.sort_order - b.sort_order));
                // Initialize default values
                const defaults: Record<string, any> = {};
                res.data.forEach((field) => {
                    switch (field.field_type) {
                        case "checkbox":
                            defaults[field.id] = false;
                            break;
                        case "select_multiple":
                            defaults[field.id] = [];
                            break;
                        default:
                            defaults[field.id] = "";
                    }
                });
                setCustomFieldValues(defaults);
            }
        } catch {
            console.error("Error loading custom fields");
        } finally {
            setIsLoadingFields(false);
        }
    }, [user?.access_token]);

    useEffect(() => {
        if (selectedCategoryId) {
            loadCustomFields(selectedCategoryId);
        } else {
            setCustomFields([]);
            setCustomFieldValues({});
        }
    }, [selectedCategoryId, loadCustomFields]);

    // File handling
    const validateFile = (f: File): boolean => {
        setFileError(null);
        if (f.size > FILE_SIZE_LIMIT) {
            setFileError(`File too large (${formatFileSize(f.size)}). Max: 50 MB.`);
            return false;
        }
        // Allow all types — just warn on uncommon ones
        return true;
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && validateFile(droppedFile)) {
            setFile(droppedFile);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected && validateFile(selected)) {
            setFile(selected);
        }
    };

    const removeFile = () => {
        setFile(null);
        setFileError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Custom field value updater
    const updateField = (fieldId: string, value: any) => {
        setCustomFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    };

    const toggleMultiSelect = (fieldId: string, option: string) => {
        setCustomFieldValues((prev) => {
            const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
            return {
                ...prev,
                [fieldId]: current.includes(option)
                    ? current.filter((o: string) => o !== option)
                    : [...current, option],
            };
        });
    };

    // Reset form
    const resetForm = () => {
        setSelectedCategoryId(preselectedCategoryId || "");
        setTitle("");
        setAuthor("");
        setReference("");
        setDescription("");
        setFile(null);
        setFileError(null);
        setCustomFieldValues({});
        setCustomFields([]);
    };

    // Validate required custom fields
    const validateCustomFields = (): boolean => {
        for (const field of customFields) {
            if (!field.is_required) continue;
            const val = customFieldValues[field.id];
            if (val === undefined || val === null || val === "") return false;
            if (Array.isArray(val) && val.length === 0) return false;
        }
        return true;
    };

    // Submit
    const handleSubmit = async () => {
        if (!user?.access_token || !title.trim()) return;

        if (!validateCustomFields()) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            setIsSubmitting(true);
            let fileUrl: string | null = null;

            // Upload file first
            if (file && profile?.school_id) {
                const uploadRes = await uploadLibraryDocument(
                    file,
                    profile.school_id,
                    selectedCategoryId || undefined
                );
                if (!uploadRes.success) {
                    toast.error(uploadRes.error || "Failed to upload file");
                    return;
                }
                fileUrl = uploadRes.url || null;
            }

            // Build custom_fields JSONB — store as { field_id: { name, type, value } }
            const customFieldsData: Record<string, any> = {};
            customFields.forEach((field) => {
                const val = customFieldValues[field.id];
                if (val !== undefined && val !== "" && !(Array.isArray(val) && val.length === 0)) {
                    customFieldsData[field.id] = {
                        name: field.field_name,
                        type: field.field_type,
                        value: val,
                    };
                }
            });

            // Create book record
            const bookData = {
                title: title.trim(),
                author: author.trim() || "Unknown",
                reference: reference.trim() || undefined,
                description: description.trim() || undefined,
                category_id: selectedCategoryId || undefined,
                document_type: "document",
                file_url: fileUrl,
                custom_fields: customFieldsData,
            };

            const res = await createBook(bookData, user.access_token);

            if (res.success) {
                toast.success("Document uploaded successfully!");
                resetForm();
                onDocumentUploaded();
                onOpenChange(false);
            } else {
                toast.error(res.error || "Failed to create document");
            }
        } catch (error) {
            console.error("Error uploading document:", error);
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render a custom field input based on its type
    const renderFieldInput = (field: LibraryDocumentField) => {
        const value = customFieldValues[field.id];

        switch (field.field_type) {
            case "text":
                return (
                    <Input
                        value={value || ""}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        placeholder={`Enter ${field.field_name.toLowerCase()}`}
                    />
                );

            case "long_text":
                return (
                    <Textarea
                        value={value || ""}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        placeholder={`Enter ${field.field_name.toLowerCase()}`}
                        className="min-h-[70px]"
                    />
                );

            case "number":
                return (
                    <Input
                        type="number"
                        value={value || ""}
                        onChange={(e) => updateField(field.id, e.target.value ? Number(e.target.value) : "")}
                        placeholder="0"
                    />
                );

            case "date":
                return (
                    <Input
                        type="date"
                        value={value || ""}
                        onChange={(e) => updateField(field.id, e.target.value)}
                    />
                );

            case "checkbox":
                return (
                    <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                            checked={!!value}
                            onCheckedChange={(checked) => updateField(field.id, !!checked)}
                        />
                        <span className="text-sm text-muted-foreground">Yes</span>
                    </div>
                );

            case "select_single":
                return (
                    <select
                        value={value || ""}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <option value="">Select...</option>
                        {(field.options || []).map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                );

            case "select_multiple":
                return (
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                        {(field.options || []).map((opt: string) => {
                            const selected = Array.isArray(value) && value.includes(opt);
                            return (
                                <label
                                    key={opt}
                                    className={cn(
                                        "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-sm",
                                        selected
                                            ? "border-primary bg-primary/5"
                                            : "border-muted hover:bg-muted/50"
                                    )}
                                >
                                    <Checkbox
                                        checked={selected}
                                        onCheckedChange={() => toggleMultiSelect(field.id, opt)}
                                    />
                                    {opt}
                                </label>
                            );
                        })}
                    </div>
                );

            case "files":
                // For the "files" field type, render a secondary file input
                return (
                    <Input
                        type="file"
                        multiple
                        onChange={(e) => {
                            const files = e.target.files;
                            if (files) {
                                updateField(field.id, Array.from(files).map(f => f.name));
                            }
                        }}
                        className="text-sm"
                    />
                );

            default:
                return (
                    <Input
                        value={value || ""}
                        onChange={(e) => updateField(field.id, e.target.value)}
                    />
                );
        }
    };

    const canSubmit = title.trim() && !isSubmitting;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) { if (!v) resetForm(); onOpenChange(v); } }}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center">
                            <Upload className="h-4 w-4 text-white" />
                        </div>
                        Upload Document
                    </DialogTitle>
                    <DialogDescription>
                        Upload a document to the library. Select a category to see its custom fields.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Category Selector */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Category</Label>
                        <select
                            value={selectedCategoryId}
                            onChange={(e) => setSelectedCategoryId(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="">No category</option>
                            {categories
                                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                .map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* Standard Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                Title <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Document title"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Author</Label>
                            <Input
                                value={author}
                                onChange={(e) => setAuthor(e.target.value)}
                                placeholder="Author name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Reference Code</Label>
                            <Input
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="e.g. DOC-001"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Description</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Brief description (optional)"
                            className="min-h-[60px]"
                        />
                    </div>

                    {/* File Upload Zone */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Attach File</Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                            accept={ACCEPTED_TYPES.join(",")}
                        />

                        {file ? (
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                <FileText className="h-8 w-8 text-primary shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                </div>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    onClick={removeFile}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div
                                className={cn(
                                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                                    isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                                )}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleFileDrop}
                            >
                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm font-medium">
                                    Drop a file here or <span className="text-primary">browse</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    PDF, Word, Excel, Images — Max 50 MB
                                </p>
                            </div>
                        )}

                        {fileError && (
                            <div className="flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {fileError}
                            </div>
                        )}
                    </div>

                    {/* Dynamic Custom Fields */}
                    {selectedCategoryId && (
                        <div className="space-y-3">
                            {isLoadingFields ? (
                                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading fields...
                                </div>
                            ) : customFields.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Category Fields
                                        </span>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    {customFields.map((field) => (
                                        <div key={field.id} className="space-y-1.5">
                                            <Label className="text-sm font-medium">
                                                {field.field_name}
                                                {field.is_required && (
                                                    <span className="text-destructive ml-1">*</span>
                                                )}
                                            </Label>
                                            {renderFieldInput(field)}
                                        </div>
                                    ))}
                                </>
                            ) : null}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => { resetForm(); onOpenChange(false); }}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Upload Document
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
