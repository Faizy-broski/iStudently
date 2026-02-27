'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    Plus,
    Pencil,
    Trash2,
    MoreHorizontal,
    FolderOpen,
    Loader2,
    Save,
    GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from "@/lib/api/library";
import { getGradeLevels } from "@/lib/api/academics";
import { LibraryCategory } from "@/types";
import { toast } from "sonner";

const PRESET_COLORS = [
    "#EF4444", "#F97316", "#F59E0B", "#EAB308",
    "#84CC16", "#22C55E", "#14B8A6", "#06B6D4",
    "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7",
    "#D946EF", "#EC4899", "#F43F5E", "#78716C",
];

const STAFF_ROLES = [
    { value: "student", label: "Student" },
    { value: "teacher", label: "Teacher" },
    { value: "parent", label: "Parent" },
];

interface GradeLevel {
    id: string;
    name: string;
}

export default function DocumentCategoriesPage() {
    const { user } = useAuth();
    const [categories, setCategories] = useState<LibraryCategory[]>([]);
    const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingCategory, setEditingCategory] = useState<LibraryCategory | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formTitle, setFormTitle] = useState("");
    const [formSortOrder, setFormSortOrder] = useState<number>(0);
    const [formColor, setFormColor] = useState("#3B82F6");
    const [formVisibleToRoles, setFormVisibleToRoles] = useState<string[]>([]);
    const [formGradeLevels, setFormGradeLevels] = useState<string[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        if (!user?.access_token) return;
        try {
            setIsLoading(true);
            const [catRes, gradeRes] = await Promise.all([
                getCategories(user.access_token),
                getGradeLevels(),
            ]);
            if (catRes.success && catRes.data) setCategories(catRes.data);
            if (gradeRes.success && gradeRes.data) setGradeLevels(gradeRes.data);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Failed to load data");
        } finally {
            setIsLoading(false);
        }
    };

    const openCreate = () => {
        setEditingCategory(null);
        setFormTitle("");
        setFormSortOrder(categories.length + 1);
        setFormColor("#3B82F6");
        setFormVisibleToRoles([]);
        setFormGradeLevels([]);
        setShowDialog(true);
    };

    const openEdit = (cat: LibraryCategory) => {
        setEditingCategory(cat);
        setFormTitle(cat.name);
        setFormSortOrder(cat.sort_order ?? 0);
        setFormColor(cat.color_code || "#3B82F6");
        setFormVisibleToRoles(cat.visible_to_roles || []);
        setFormGradeLevels(cat.visible_to_grade_levels || []);
        setShowDialog(true);
    };

    const handleSubmit = async () => {
        if (!user?.access_token || !formTitle.trim()) return;
        try {
            setIsSubmitting(true);
            const payload: Partial<LibraryCategory> = {
                name: formTitle.trim(),
                sort_order: formSortOrder,
                color_code: formColor,
                visible_to_roles: formVisibleToRoles,
                visible_to_grade_levels: formGradeLevels,
            };

            if (editingCategory) {
                const res = await updateCategory(editingCategory.id, payload, user.access_token);
                if (res.success) {
                    toast.success("Category updated");
                } else {
                    toast.error(res.error || "Failed to update");
                    return;
                }
            } else {
                const res = await createCategory(payload, user.access_token);
                if (res.success) {
                    toast.success("Category created");
                } else {
                    toast.error(res.error || "Failed to create");
                    return;
                }
            }
            setShowDialog(false);
            loadData();
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (cat: LibraryCategory) => {
        if (!user?.access_token) return;
        if (!confirm(`Delete category "${cat.name}"? Documents in this category won't be deleted.`)) return;
        try {
            const res = await deleteCategory(cat.id, user.access_token);
            if (res.success) {
                toast.success("Category deleted");
                loadData();
            } else {
                toast.error(res.error || "Failed to delete");
            }
        } catch {
            toast.error("Something went wrong");
        }
    };

    const toggleRole = (role: string) => {
        setFormVisibleToRoles((prev) =>
            prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
        );
    };

    const toggleGradeLevel = (id: string) => {
        setFormGradeLevels((prev) =>
            prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
        );
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center">
                            <FolderOpen className="h-5 w-5 text-white" />
                        </div>
                        Document Categories
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage document categories, set visibility by role and grade level.</p>
                </div>
                <Button
                    onClick={openCreate}
                    className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    New Category
                </Button>
            </div>

            {/* Categories Table */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">All Categories ({categories.length})</CardTitle>
                    <CardDescription>Click a category row to edit, or use the actions menu.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">No categories yet</p>
                            <p className="text-xs mt-1">Click &quot;New Category&quot; to create one.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="w-12 text-center">#</TableHead>
                                        <TableHead>Color</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Sort Order</TableHead>
                                        <TableHead>Visible to Roles</TableHead>
                                        <TableHead>Grade Levels</TableHead>
                                        <TableHead className="w-16 text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {categories
                                        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                                        .map((cat, i) => (
                                            <TableRow
                                                key={cat.id}
                                                className="cursor-pointer hover:bg-muted/30 transition-colors"
                                                onClick={() => openEdit(cat)}
                                            >
                                                <TableCell className="text-center text-muted-foreground text-xs font-mono">
                                                    {i + 1}
                                                </TableCell>
                                                <TableCell>
                                                    <div
                                                        className="h-6 w-6 rounded-md ring-1 ring-black/10"
                                                        style={{ backgroundColor: cat.color_code || "#6B7280" }}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{cat.name}</TableCell>
                                                <TableCell className="text-muted-foreground font-mono text-sm">
                                                    {cat.sort_order ?? 0}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(cat.visible_to_roles || []).length === 0 ? (
                                                            <span className="text-xs text-muted-foreground italic">All</span>
                                                        ) : (
                                                            cat.visible_to_roles.map((role) => (
                                                                <Badge key={role} variant="secondary" className="text-[10px] capitalize">
                                                                    {role}
                                                                </Badge>
                                                            ))
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(cat.visible_to_grade_levels || []).length === 0 ? (
                                                            <span className="text-xs text-muted-foreground italic">All</span>
                                                        ) : (
                                                            cat.visible_to_grade_levels.slice(0, 3).map((gl) => {
                                                                const grade = gradeLevels.find((g) => g.id === gl);
                                                                return (
                                                                    <Badge key={gl} variant="outline" className="text-[10px]">
                                                                        {grade?.name || gl}
                                                                    </Badge>
                                                                );
                                                            })
                                                        )}
                                                        {(cat.visible_to_grade_levels || []).length > 3 && (
                                                            <Badge variant="outline" className="text-[10px]">
                                                                +{cat.visible_to_grade_levels.length - 3}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(cat); }}>
                                                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(cat); }}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
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
                                <FolderOpen className="h-3.5 w-3.5 text-white" />
                            </div>
                            {editingCategory ? "Edit Document Category" : "New Document Category"}
                        </DialogTitle>
                        <DialogDescription>
                            {editingCategory
                                ? "Update category details below."
                                : "Define a new category for organizing library documents."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5">
                        {/* Title & Sort Order Row */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="cat-title" className="text-sm font-medium">
                                    Title <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="cat-title"
                                    placeholder="e.g. Youth Comics, Periodicals..."
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cat-sort" className="text-sm font-medium">Sort Order</Label>
                                <Input
                                    id="cat-sort"
                                    type="number"
                                    min={0}
                                    value={formSortOrder}
                                    onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        {/* Color */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Color</Label>
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

                        {/* Visible to Roles */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Visible To (Staff Roles)</Label>
                            <p className="text-xs text-muted-foreground">Leave empty to make visible to all roles.</p>
                            <div className="grid grid-cols-3 gap-3 mt-2">
                                {STAFF_ROLES.map((role) => (
                                    <label
                                        key={role.value}
                                        className={cn(
                                            "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                                            formVisibleToRoles.includes(role.value)
                                                ? "border-primary bg-primary/5"
                                                : "border-muted hover:bg-muted/50"
                                        )}
                                    >
                                        <Checkbox
                                            checked={formVisibleToRoles.includes(role.value)}
                                            onCheckedChange={() => toggleRole(role.value)}
                                        />
                                        <span className="text-sm font-medium">{role.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Limit to Grade Levels */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Limit to Grade Levels</Label>
                            <p className="text-xs text-muted-foreground">Leave empty to show for all grades.</p>
                            {gradeLevels.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-2">No grade levels configured.</p>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto">
                                    {gradeLevels.map((gl) => (
                                        <label
                                            key={gl.id}
                                            className={cn(
                                                "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-sm",
                                                formGradeLevels.includes(gl.id)
                                                    ? "border-primary bg-primary/5"
                                                    : "border-muted hover:bg-muted/50"
                                            )}
                                        >
                                            <Checkbox
                                                checked={formGradeLevels.includes(gl.id)}
                                                onCheckedChange={() => toggleGradeLevel(gl.id)}
                                            />
                                            {gl.name}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 mt-4">
                        <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!formTitle.trim() || isSubmitting}
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
                                    {editingCategory ? "Save Changes" : "Save"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
