"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, FolderOpen, Loader2, GripVertical } from "lucide-react";
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
    const { user } = useAuth();
    const [categories, setCategories] = useState<LibraryCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingCategory, setEditingCategory] = useState<LibraryCategory | null>(null);
    const [formName, setFormName] = useState("");
    const [formColor, setFormColor] = useState("#3B82F6");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadCategories();
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

    const openCreate = () => {
        setEditingCategory(null);
        setFormName("");
        setFormColor("#3B82F6");
        setShowDialog(true);
    };

    const openEdit = (cat: LibraryCategory) => {
        setEditingCategory(cat);
        setFormName(cat.name);
        setFormColor(cat.color_code || "#3B82F6");
        setShowDialog(true);
    };

    const handleSubmit = async () => {
        if (!user?.access_token || !formName.trim()) return;
        try {
            setIsSubmitting(true);
            if (editingCategory) {
                const res = await updateCategory(
                    editingCategory.id,
                    { name: formName.trim(), color_code: formColor },
                    user.access_token
                );
                if (res.success) {
                    toast.success("Category updated");
                } else {
                    toast.error(res.error || "Failed to update");
                    return;
                }
            } else {
                const res = await createCategory(
                    { name: formName.trim(), color_code: formColor },
                    user.access_token
                );
                if (res.success) {
                    toast.success("Category created");
                } else {
                    toast.error(res.error || "Failed to create");
                    return;
                }
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

    return (
        <>
            <div className="w-full space-y-1">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Categories
                    </h3>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={openCreate}>
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                </div>

                {/* All Documents */}
                <button
                    onClick={() => onSelectCategory(null)}
                    className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                        selectedCategoryId === null
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate">All Documents</span>
                    <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                        {categories.reduce((sum) => sum, categories.length)}
                    </Badge>
                </button>

                {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    categories.map((cat) => (
                        <div
                            key={cat.id}
                            className={cn(
                                "group flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                                selectedCategoryId === cat.id
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            onClick={() => onSelectCategory(cat.id)}
                        >
                            <div
                                className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10"
                                style={{ backgroundColor: cat.color_code || "#6B7280" }}
                            />
                            <span className="truncate flex-1">{cat.name}</span>
                            <div className="hidden group-hover:flex items-center gap-0.5">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5"
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
                                    className="h-5 w-5 text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(cat);
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}

                {!isLoading && categories.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                        No categories yet. Click + to create one.
                    </p>
                )}
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
