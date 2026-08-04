"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, FolderOpen, Loader2, Globe, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from "@/lib/api/library";
import { LibraryCategory } from "@/types";
import { toast } from "sonner";

const PRESET_COLORS = [
    "#EF4444", "#F97316", "#F59E0B", "#EAB308",
    "#84CC16", "#22C55E", "#14B8A6", "#06B6D4",
    "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7",
    "#D946EF", "#EC4899", "#F43F5E", "#78716C",
];

const MAX_FEATURED = 10;

interface CategorySidebarProps {
    selectedCategoryId: string | null;
    onSelectCategory: (categoryId: string | null) => void;
    onCategoriesChange?: (categories: LibraryCategory[]) => void;
}

export function CategorySidebar({
    selectedCategoryId,
    onSelectCategory,
    onCategoriesChange,
}: CategorySidebarProps) {
    const { user, profile } = useAuth();
    const isSuperAdmin = profile?.role === "super_admin";
    const [categories, setCategories] = useState<LibraryCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingCategory, setEditingCategory] = useState<LibraryCategory | null>(null);
    const [formName, setFormName] = useState("");
    const [formColor, setFormColor] = useState("#3B82F6");
    const [formParentId, setFormParentId] = useState<string | null>(null);
    const [formIsGlobal, setFormIsGlobal] = useState(false);
    const [formIsFeatured, setFormIsFeatured] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadCategories = async () => {
        if (!user?.access_token) return;
        try {
            setIsLoading(true);
            const response = await getCategories(user.access_token);
            if (response.success && response.data) {
                setCategories(response.data);
                onCategoriesChange?.(response.data);
            }
        } catch (error) {
            console.error("Error loading categories:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Categories returned by the API are already "mine + every global one" —
    // so a non-global row in the list is always ours, and only a global row
    // needs the read-only treatment for anyone but super_admin.
    const isReadOnly = (cat: LibraryCategory) => cat.is_global && !isSuperAdmin;

    // Only top-level categories can be picked as a parent — keeps the
    // hierarchy at exactly two levels (category → subcategory).
    const topLevelCategories = categories.filter((c) => !c.parent_category_id);
    const childrenOf = (parentId: string) => categories.filter((c) => c.parent_category_id === parentId);
    const featuredCount = categories.filter((c) => c.is_featured).length;

    const openCreate = (parentId: string | null = null) => {
        setEditingCategory(null);
        setFormName("");
        setFormColor("#3B82F6");
        setFormParentId(parentId);
        setFormIsGlobal(false);
        setFormIsFeatured(false);
        setShowDialog(true);
    };

    const openEdit = (cat: LibraryCategory) => {
        setEditingCategory(cat);
        setFormName(cat.name);
        setFormColor(cat.color_code || "#3B82F6");
        setFormParentId(cat.parent_category_id);
        setFormIsGlobal(cat.is_global);
        setFormIsFeatured(cat.is_featured);
        setShowDialog(true);
    };

    const handleSubmit = async () => {
        if (!user?.access_token || !formName.trim()) return;
        try {
            setIsSubmitting(true);
            const payload: Partial<LibraryCategory> = {
                name: formName.trim(),
                color_code: formColor,
                parent_category_id: formParentId,
                ...(isSuperAdmin ? { is_global: formIsGlobal, is_featured: formIsGlobal && formIsFeatured } : {}),
            };
            const res = editingCategory
                ? await updateCategory(editingCategory.id, payload, user.access_token)
                : await createCategory(payload, user.access_token);

            if (res.success) {
                toast.success(editingCategory ? "Category updated" : "Category created");
            } else {
                toast.error(res.error || "Failed to save category");
                return;
            }
            setShowDialog(false);
            loadCategories();
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (cat: LibraryCategory) => {
        if (!user?.access_token) return;
        if (!confirm(`Delete category "${cat.name}"? Books in this category won't be deleted.`)) return;
        try {
            const res = await deleteCategory(cat.id, user.access_token);
            if (res.success) {
                toast.success("Category deleted");
                if (selectedCategoryId === cat.id) onSelectCategory(null);
                loadCategories();
            } else {
                toast.error(res.error || "Failed to delete");
            }
        } catch (error) {
            toast.error("Something went wrong");
        }
    };

    const CategoryChip = ({ cat, isChild = false }: { cat: LibraryCategory; isChild?: boolean }) => {
        const readOnly = isReadOnly(cat);
        return (
            <div
                className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer border",
                    isChild && "ml-4",
                    selectedCategoryId === cat.id
                        ? "bg-primary/10 text-primary border-primary/30 font-medium"
                        : "bg-background text-muted-foreground hover:bg-muted border-border"
                )}
                onClick={() => onSelectCategory(cat.id)}
            >
                <div
                    className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10"
                    style={{ backgroundColor: cat.color_code || "#6B7280" }}
                />
                <span className="whitespace-nowrap max-w-[150px] truncate">{cat.name}</span>
                {cat.is_global && (
                    <Globe className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Global category" />
                )}
                {cat.is_featured && (
                    <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" />
                )}
                {!readOnly && (
                    <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                        {!isChild && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 rounded-full"
                                title="Add subcategory"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openCreate(cat.id);
                                }}
                            >
                                <Plus className="h-3 w-3" />
                            </Button>
                        )}
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 rounded-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                openEdit(cat);
                            }}
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 rounded-full text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(cat);
                            }}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Categories
                    </h3>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => openCreate()}>
                        <Plus className="h-4 w-4 mr-2" /> New Category
                    </Button>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2 items-center">
                        {/* All Documents */}
                        <button
                            onClick={() => onSelectCategory(null)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors border",
                                selectedCategoryId === null
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground hover:bg-muted border-border"
                            )}
                        >
                            <FolderOpen className="h-4 w-4 shrink-0" />
                            <span className="whitespace-nowrap">All Documents</span>
                            <Badge variant="secondary" className={cn("ml-1 text-xs h-5 px-1.5", selectedCategoryId === null ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/20" : "")}>
                                {categories.length}
                            </Badge>
                        </button>

                        {isLoading && (
                            <div className="flex items-center justify-center py-2 px-4">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>

                    {!isLoading && (
                        <div className="flex flex-col gap-1.5">
                            {topLevelCategories.map((cat) => (
                                <div key={cat.id} className="flex flex-col gap-1.5">
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <CategoryChip cat={cat} />
                                    </div>
                                    {childrenOf(cat.id).length > 0 && (
                                        <div className="flex flex-wrap gap-2 items-center">
                                            {childrenOf(cat.id).map((child) => (
                                                <CategoryChip key={child.id} cat={child} isChild />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && categories.length === 0 && (
                        <p className="text-xs text-muted-foreground ml-2">
                            No categories yet. Click New Category to create one.
                        </p>
                    )}
                </div>
            </div>

            {/* Create / Edit dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
                        <DialogDescription>
                            {editingCategory ? "Update category name and color." : "Create a new document category."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                placeholder="e.g. Youth Comics, Literature..."
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Parent category</label>
                            <select
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                value={formParentId ?? ""}
                                onChange={(e) => setFormParentId(e.target.value || null)}
                            >
                                <option value="">No parent (top-level category)</option>
                                {topLevelCategories
                                    .filter((c) => c.id !== editingCategory?.id)
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Color</label>
                            <div className="grid grid-cols-8 gap-2">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={cn(
                                            "h-7 w-7 rounded-full transition-all ring-offset-2",
                                            formColor === color
                                                ? "ring-2 ring-primary scale-110"
                                                : "hover:scale-105 ring-1 ring-black/10"
                                        )}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormColor(color)}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <Input
                                    type="color"
                                    value={formColor}
                                    onChange={(e) => setFormColor(e.target.value)}
                                    className="h-8 w-12 p-0.5 cursor-pointer"
                                />
                                <Input
                                    value={formColor}
                                    onChange={(e) => setFormColor(e.target.value)}
                                    className="h-8 font-mono text-xs"
                                    placeholder="#000000"
                                />
                            </div>
                        </div>

                        {isSuperAdmin && (
                            <div className="space-y-3 rounded-md border border-dashed p-3">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <Checkbox
                                        checked={formIsGlobal}
                                        onCheckedChange={(v) => {
                                            setFormIsGlobal(!!v);
                                            if (!v) setFormIsFeatured(false);
                                        }}
                                    />
                                    Make global (visible to every school)
                                </label>
                                {formIsGlobal && (
                                    <label
                                        className={cn(
                                            "flex items-center gap-2 text-sm ml-6",
                                            !formIsFeatured && featuredCount >= MAX_FEATURED
                                                ? "opacity-50 cursor-not-allowed"
                                                : "cursor-pointer"
                                        )}
                                    >
                                        <Checkbox
                                            checked={formIsFeatured}
                                            disabled={!formIsFeatured && featuredCount >= MAX_FEATURED}
                                            onCheckedChange={(v) => setFormIsFeatured(!!v)}
                                        />
                                        Feature on the e-library homepage ({featuredCount}/{MAX_FEATURED} featured)
                                    </label>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
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
                            ) : editingCategory ? (
                                "Save Changes"
                            ) : (
                                "Create Category"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
