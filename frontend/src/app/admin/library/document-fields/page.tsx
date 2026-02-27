'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus,
    Pencil,
    Trash2,
    MoreHorizontal,
    Sliders,
    Loader2,
    Save,
    X,
    ListChecks,
    List,
    Type,
    AlignLeft,
    CheckSquare,
    Hash,
    CalendarDays,
    Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
    getDocumentFields,
    createDocumentField,
    updateDocumentField,
    deleteDocumentField,
    getCategories,
} from "@/lib/api/library";
import { LibraryDocumentField, LibraryCategory, DocumentFieldType } from "@/types";
import { toast } from "sonner";

const FIELD_TYPES: { value: DocumentFieldType; label: string; icon: React.ElementType; description: string }[] = [
    { value: "select_multiple", label: "Select Multiple", icon: ListChecks, description: "Choose multiple options from a list" },
    { value: "select_single", label: "Select Single", icon: List, description: "Choose one option from a list" },
    { value: "text", label: "Text", icon: Type, description: "Short single-line text" },
    { value: "long_text", label: "Long Text", icon: AlignLeft, description: "Multi-line text area" },
    { value: "checkbox", label: "Checkbox", icon: CheckSquare, description: "Yes / No toggle" },
    { value: "number", label: "Number", icon: Hash, description: "Numeric value" },
    { value: "date", label: "Date", icon: CalendarDays, description: "Date picker" },
    { value: "files", label: "Files", icon: Paperclip, description: "File upload(s)" },
];

export default function DocumentFieldsPage() {
    const { user } = useAuth();
    const [fields, setFields] = useState<LibraryDocumentField[]>([]);
    const [categories, setCategories] = useState<LibraryCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingField, setEditingField] = useState<LibraryDocumentField | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formName, setFormName] = useState("");
    const [formType, setFormType] = useState<DocumentFieldType>("text");
    const [formCategoryId, setFormCategoryId] = useState<string>("");
    const [formIsRequired, setFormIsRequired] = useState(false);
    const [formSortOrder, setFormSortOrder] = useState<number>(0);
    const [formOptions, setFormOptions] = useState<string[]>([]);
    const [newOption, setNewOption] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        if (!user?.access_token) return;
        try {
            setIsLoading(true);
            const [fieldsRes, catRes] = await Promise.all([
                getDocumentFields(user.access_token),
                getCategories(user.access_token),
            ]);
            if (fieldsRes.success && fieldsRes.data) setFields(fieldsRes.data);
            if (catRes.success && catRes.data) setCategories(catRes.data);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Failed to load data");
        } finally {
            setIsLoading(false);
        }
    };

    const openCreate = () => {
        setEditingField(null);
        setFormName("");
        setFormType("text");
        setFormCategoryId("");
        setFormIsRequired(false);
        setFormSortOrder(fields.length + 1);
        setFormOptions([]);
        setNewOption("");
        setShowDialog(true);
    };

    const openEdit = (field: LibraryDocumentField) => {
        setEditingField(field);
        setFormName(field.field_name);
        setFormType(field.field_type);
        setFormCategoryId(field.category_id || "");
        setFormIsRequired(field.is_required);
        setFormSortOrder(field.sort_order ?? 0);
        setFormOptions(field.options || []);
        setNewOption("");
        setShowDialog(true);
    };

    const handleSubmit = async () => {
        if (!user?.access_token || !formName.trim()) return;

        if ((formType === "select_multiple" || formType === "select_single") && formOptions.length === 0) {
            toast.error("Please add at least one option for select fields.");
            return;
        }

        try {
            setIsSubmitting(true);
            const payload: Partial<LibraryDocumentField> = {
                field_name: formName.trim(),
                field_type: formType,
                category_id: formCategoryId || null,
                is_required: formIsRequired,
                sort_order: formSortOrder,
                options: ["select_multiple", "select_single"].includes(formType) ? formOptions : [],
            };

            if (editingField) {
                const res = await updateDocumentField(editingField.id, payload, user.access_token);
                if (res.success) {
                    toast.success("Field updated");
                } else {
                    toast.error(res.error || "Failed to update");
                    return;
                }
            } else {
                const res = await createDocumentField(payload, user.access_token);
                if (res.success) {
                    toast.success("Field created");
                } else {
                    toast.error(res.error || "Failed to create");
                    return;
                }
            }
            setShowDialog(false);
            loadData();
        } catch {
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (field: LibraryDocumentField) => {
        if (!user?.access_token) return;
        if (!confirm(`Delete field "${field.field_name}"? Existing data using this field won't be removed.`)) return;
        try {
            const res = await deleteDocumentField(field.id, user.access_token);
            if (res.success) {
                toast.success("Field deleted");
                loadData();
            } else {
                toast.error(res.error || "Failed to delete");
            }
        } catch {
            toast.error("Something went wrong");
        }
    };

    const addOption = () => {
        const v = newOption.trim();
        if (!v) return;
        if (formOptions.includes(v)) {
            toast.error("Option already exists");
            return;
        }
        setFormOptions([...formOptions, v]);
        setNewOption("");
    };

    const removeOption = (idx: number) => {
        setFormOptions(formOptions.filter((_, i) => i !== idx));
    };

    const getFieldTypeInfo = (type: DocumentFieldType) => FIELD_TYPES.find((ft) => ft.value === type);

    const getCategoryName = (id: string | null) => {
        if (!id) return null;
        return categories.find((c) => c.id === id)?.name || null;
    };

    const showOptionsField = formType === "select_multiple" || formType === "select_single";

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center">
                            <Sliders className="h-5 w-5 text-white" />
                        </div>
                        Document Fields
                    </h1>
                    <p className="text-muted-foreground mt-2">Define custom fields for library documents. Fields can be scoped to a specific category.</p>
                </div>
                <Button
                    onClick={openCreate}
                    className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New Field
                </Button>
            </div>

            {/* Fields Table */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">All Fields ({fields.length})</CardTitle>
                    <CardDescription>Click a field row to edit, or use the actions menu.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : fields.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Sliders className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">No custom fields yet</p>
                            <p className="text-xs mt-1">Click &quot;New Field&quot; to create one.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-12 text-center">#</TableHead>
                                        <TableHead>Field Name</TableHead>
                                        <TableHead>Data Type</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Required</TableHead>
                                        <TableHead>Options</TableHead>
                                        <TableHead className="w-16 text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields
                                        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                        .map((field, i) => {
                                            const typeInfo = getFieldTypeInfo(field.field_type);
                                            const TypeIcon = typeInfo?.icon || Type;
                                            return (
                                                <TableRow
                                                    key={field.id}
                                                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                                                    onClick={() => openEdit(field)}
                                                >
                                                    <TableCell className="text-center text-muted-foreground text-xs font-mono">
                                                        {i + 1}
                                                    </TableCell>
                                                    <TableCell className="font-medium">{field.field_name}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                                                                <TypeIcon className="h-3.5 w-3.5 text-primary" />
                                                            </div>
                                                            <span className="text-sm">{typeInfo?.label || field.field_type}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {getCategoryName(field.category_id) ? (
                                                            <Badge variant="secondary" className="text-xs">
                                                                {getCategoryName(field.category_id)}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">All categories</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {field.is_required ? (
                                                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">Required</Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">Optional</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(field.options || []).length > 0 ? (
                                                            <div className="flex flex-wrap gap-1 max-w-48">
                                                                {field.options.slice(0, 3).map((opt: string, j: number) => (
                                                                    <Badge key={j} variant="outline" className="text-[10px]">{opt}</Badge>
                                                                ))}
                                                                {field.options.length > 3 && (
                                                                    <Badge variant="outline" className="text-[10px]">+{field.options.length - 3}</Badge>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(field); }}>
                                                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(field); }}
                                                                    className="text-destructive focus:text-destructive"
                                                                >
                                                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center">
                                <Sliders className="h-3.5 w-3.5 text-white" />
                            </div>
                            {editingField ? "Edit Document Field" : "New Document Field"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingField
                                ? "Update field definition below."
                                : "Create a custom field that will appear on document forms."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        {/* Field Name */}
                        <div className="space-y-2">
                            <Label htmlFor="field-name" className="text-sm font-medium">
                                Field Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="field-name"
                                placeholder="e.g. Publisher, Edition, Language..."
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </div>

                        {/* Data Type */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">
                                Data Type <span className="text-destructive">*</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                {FIELD_TYPES.map((ft) => {
                                    const Icon = ft.icon;
                                    return (
                                        <button
                                            key={ft.value}
                                            type="button"
                                            onClick={() => setFormType(ft.value)}
                                            className={cn(
                                                "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                                                formType === ft.value
                                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                    : "border-muted hover:bg-muted/50 hover:border-muted-foreground/30"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                                                    formType === ft.value
                                                        ? "bg-primary text-white"
                                                        : "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                <Icon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium leading-tight">{ft.label}</p>
                                                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{ft.description}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Options (for select types) */}
                        {showOptionsField && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    Options <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Type an option and press Enter or Add..."
                                        value={newOption}
                                        onChange={(e) => setNewOption(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                addOption();
                                            }
                                        }}
                                    />
                                    <Button type="button" size="sm" variant="outline" onClick={addOption}>
                                        Add
                                    </Button>
                                </div>
                                {formOptions.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-muted/50 rounded-md">
                                        {formOptions.map((opt, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
                                                {opt}
                                                <button
                                                    type="button"
                                                    onClick={() => removeOption(i)}
                                                    className="ml-1 hover:text-destructive transition-colors"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Category Scope */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="field-category" className="text-sm font-medium">Category (optional)</Label>
                                <select
                                    id="field-category"
                                    value={formCategoryId}
                                    onChange={(e) => setFormCategoryId(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <option value="">All categories</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="field-sort" className="text-sm font-medium">Sort Order</Label>
                                <Input
                                    id="field-sort"
                                    type="number"
                                    min={0}
                                    value={formSortOrder}
                                    onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        {/* Required Toggle */}
                        <label className="flex items-center gap-3 p-3 rounded-lg border border-muted cursor-pointer hover:bg-muted/30 transition-colors">
                            <Checkbox
                                checked={formIsRequired}
                                onCheckedChange={(checked) => setFormIsRequired(checked === true)}
                            />
                            <div>
                                <p className="text-sm font-medium">Required Field</p>
                                <p className="text-xs text-muted-foreground">Users must fill this field when adding/editing a document.</p>
                            </div>
                        </label>
                    </div>

                    <DialogFooter className="gap-2 mt-4">
                        <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!formName.trim() || isSubmitting}
                            className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    {editingField ? "Save Changes" : "Save"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
