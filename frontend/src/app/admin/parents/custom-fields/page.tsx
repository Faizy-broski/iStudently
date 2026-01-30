"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Save, Settings2, ChevronDown, ChevronRight, Building2, GripVertical, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { CustomFieldCategory, CustomField, CustomFieldType, CampusScope } from "@/types";
import { customFieldsApi, CustomFieldDefinition, BranchSchool } from "@/lib/api/custom-fields";
import { useCampus } from "@/context/CampusContext";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getFieldOrders, saveFieldOrders, getEffectiveFieldOrder, DefaultFieldOrder } from '@/lib/utils/field-ordering';

// Default/Standard Fields for Parents
const DEFAULT_FIELDS_BY_CATEGORY: Record<string, Array<{label: string, sort_order: number}>> = {
  personal: [
    { label: "First Name", sort_order: 1 },
    { label: "Last Name", sort_order: 2 },
    { label: "CNIC", sort_order: 3 },
    { label: "Phone Number", sort_order: 4 },
    { label: "Email Address", sort_order: 5 },
  ],
  professional: [
    { label: "Occupation", sort_order: 1 },
    { label: "Workplace", sort_order: 2 },
    { label: "Monthly Income", sort_order: 3 },
  ],
  contact: [
    { label: "Home Address", sort_order: 1 },
    { label: "City", sort_order: 2 },
    { label: "State/Province", sort_order: 3 },
    { label: "ZIP/Postal Code", sort_order: 4 },
    { label: "Country", sort_order: 5 },
  ],
  emergency: [
    { label: "Emergency Contact Name", sort_order: 1 },
    { label: "Relationship", sort_order: 2 },
    { label: "Phone", sort_order: 3 },
  ],
  system: [
    { label: "Username", sort_order: 1 },
    { label: "Password", sort_order: 2 },
  ],
};

type ExtendedCategory = CustomFieldCategory & { order: number };

export default function ParentCustomFieldsPage() {
  const { selectedCampus } = useCampus();
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [branchSchools, setBranchSchools] = useState<BranchSchool[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [savedDefaultOrders, setSavedDefaultOrders] = useState<DefaultFieldOrder[]>([]);
  const [defaultFieldsByCategory, setDefaultFieldsByCategory] = useState<Record<string, Array<{label: string, sort_order: number}>>>(DEFAULT_FIELDS_BY_CATEGORY);

  const STANDARD_CATEGORIES = ['personal', 'professional', 'contact', 'emergency', 'system'];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Pass campus_id to get campus-specific custom fields
        const campusId = selectedCampus?.id;
        const [fieldsResponse, branchesResponse, defaultOrdersResponse] = await Promise.all([
          customFieldsApi.getFieldDefinitions('parent', campusId),
          customFieldsApi.getBranchSchools(),
          getFieldOrders('parent')
        ]);

        // Load saved default field orders if any
        if (defaultOrdersResponse.success && defaultOrdersResponse.data) {
          setSavedDefaultOrders(defaultOrdersResponse.data);
          
          // Apply saved orders to default fields
          const updatedDefaults: Record<string, Array<{label: string, sort_order: number}>> = {};
          Object.keys(DEFAULT_FIELDS_BY_CATEGORY).forEach(categoryId => {
            const effective = getEffectiveFieldOrder(
              defaultOrdersResponse.data!,
              categoryId,
              DEFAULT_FIELDS_BY_CATEGORY[categoryId]
            );
            updatedDefaults[categoryId] = effective;
          });
          setDefaultFieldsByCategory(updatedDefaults);
        }

        const standardCategories: ExtendedCategory[] = [
          { id: 'personal', name: 'Personal Information', fields: [], order: 1 },
          { id: 'professional', name: 'Professional Details', fields: [], order: 2 },
          { id: 'contact', name: 'Contact Information', fields: [], order: 3 },
          { id: 'emergency', name: 'Emergency Contact', fields: [], order: 4 },
          { id: 'system', name: 'System & Login', fields: [], order: 5 },
        ];

        if (fieldsResponse.success && fieldsResponse.data) {
          const fieldsByCategory: Record<string, CustomField[]> = {};
          const categoryOrderMap: Record<string, number> = {};

          fieldsResponse.data.forEach((field: CustomFieldDefinition) => {
            const customField: CustomField = {
              id: field.id,
              label: field.label,
              type: field.type,
              value: '',
              options: field.options,
              required: field.required,
              sort_order: field.sort_order,
              campus_scope: field.campus_scope,
              applicable_school_ids: field.applicable_school_ids
            };

            if (!fieldsByCategory[field.category_id]) {
              fieldsByCategory[field.category_id] = [];
            }
            fieldsByCategory[field.category_id].push(customField);
            
            // Track category order from database
            if (!categoryOrderMap[field.category_id] && field.category_order !== undefined) {
              categoryOrderMap[field.category_id] = field.category_order;
            }
          });

          const mergedCategories = standardCategories.map(stdCat => ({
            ...stdCat,
            fields: (fieldsByCategory[stdCat.id] || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
            order: categoryOrderMap[stdCat.id] || stdCat.order,
          }));

          const customCategoryIds = Object.keys(fieldsByCategory).filter(id => !STANDARD_CATEGORIES.includes(id));
          customCategoryIds.forEach((catId, idx) => {
            const firstField = fieldsResponse.data!.find(f => f.category_id === catId);
            if (firstField) {
              mergedCategories.push({
                id: catId,
                name: firstField.category_name,
                fields: fieldsByCategory[catId].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
                order: categoryOrderMap[catId] || (standardCategories.length + idx + 1)
              });
            }
          });

          // Sort by order
          mergedCategories.sort((a, b) => a.order - b.order);

          setCategories(mergedCategories);
          const withFields = new Set(mergedCategories.filter(c => c.fields.length > 0).map(c => c.id));
          setExpandedCategories(withFields);
        } else {
          setCategories(standardCategories);
        }

        if (branchesResponse.success && branchesResponse.data) {
          setBranchSchools(branchesResponse.data);
        }
      } catch (error) {
        console.error('Error loading custom fields:', error);
        toast.error('Failed to load custom fields');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [selectedCampus?.id]); // Reload when campus changes

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const reordered = arrayMove(items, oldIndex, newIndex);
        // Update order values
        return reordered.map((cat, idx) => ({ ...cat, order: idx + 1 }));
      });
    }
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name cannot be empty');
      return;
    }
    
    const categoryId = `custom_${Date.now()}`;
    const newCategory: ExtendedCategory = {
      id: categoryId,
      name: newCategoryName,
      fields: [],
      order: categories.length + 1
    };
    
    setCategories([...categories, newCategory]);
    setExpandedCategories(prev => new Set(prev).add(categoryId));
    setNewCategoryName('');
    setShowAddCategory(false);
    toast.success('New category added');
  };

  const deleteCategory = (categoryId: string) => {
    if (STANDARD_CATEGORIES.includes(categoryId)) {
      toast.error('Cannot delete standard categories');
      return;
    }
    
    setCategories(categories.filter(c => c.id !== categoryId));
    toast.success('Category deleted');
  };

  const addFieldToCategory = (categoryId: string) => {
    const categoryFields = categories.find(c => c.id === categoryId)?.fields || [];
    const maxSortOrder = Math.max(0, ...categoryFields.map(f => f.sort_order || 0));

    const newField: CustomField = {
      id: `field-${Date.now()}`,
      label: "",
      type: "text",
      value: "",
      required: false,
      sort_order: maxSortOrder + 1,
      campus_scope: 'this_campus',
      applicable_school_ids: []
    };
    setCategories(categories.map((cat) =>
      cat.id === categoryId ? { ...cat, fields: [...cat.fields, newField] } : cat
    ));
    setExpandedCategories(prev => new Set(prev).add(categoryId));
  };

  const updateCustomField = (categoryId: string, fieldId: string, updates: Partial<CustomField>) => {
    setCategories(categories.map((cat) =>
      cat.id === categoryId
        ? { ...cat, fields: cat.fields.map((field) => field.id === fieldId ? { ...field, ...updates } : field) }
        : cat
    ));
  };

  const removeCustomField = (categoryId: string, fieldId: string) => {
    setCategories(categories.map((cat) =>
      cat.id === categoryId ? { ...cat, fields: cat.fields.filter((field) => field.id !== fieldId) } : cat
    ));
  };

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      // Pass campus_id to get/create campus-specific fields
      const campusId = selectedCampus?.id;
      const existingResponse = await customFieldsApi.getFieldDefinitions('parent', campusId);
      const existingIds = new Set((existingResponse.data || []).map(f => f.id));
      const currentIds = new Set<string>();

      const allFields: { categoryId: string; categoryName: string; categoryOrder: number; field: CustomField }[] = [];
      categories.forEach(cat => {
        cat.fields.forEach(field => {
          if (field.label.trim()) {
            allFields.push({ 
              categoryId: cat.id, 
              categoryName: cat.name, 
              categoryOrder: cat.order,
              field 
            });
            // Track IDs of fields currently in the UI (excluding new temporary IDs)
            if (!field.id.startsWith('field-')) {
              currentIds.add(field.id);
            }
          }
        });
      });

      for (const { categoryId, categoryName, categoryOrder, field } of allFields) {
        if (existingIds.has(field.id)) {
          await customFieldsApi.updateFieldDefinition(field.id, {
            label: field.label, type: field.type, options: field.options,
            required: field.required, sort_order: field.sort_order,
            category_order: categoryOrder,
            campus_scope: field.campus_scope, applicable_school_ids: field.applicable_school_ids
          });
        } else {
          // Create new field with campus_id
          await customFieldsApi.createFieldDefinition({
            entity_type: 'parent', category_id: categoryId, category_name: categoryName,
            label: field.label, type: field.type, options: field.options,
            required: field.required, sort_order: field.sort_order,
            category_order: categoryOrder,
            campus_scope: field.campus_scope, applicable_school_ids: field.applicable_school_ids
          }, campusId);
        }
      }

      // Delete fields that are in DB but no longer in the UI
      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          await customFieldsApi.deleteFieldDefinition(id);
        }
      }
      toast.success("Custom fields saved!");
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDefaultFieldDragEnd = (categoryId: string, event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const fields = defaultFieldsByCategory[categoryId] || [];
      const oldIndex = fields.findIndex((field) => field.label === active.id);
      const newIndex = fields.findIndex((field) => field.label === over.id);
      
      const reordered = arrayMove(fields, oldIndex, newIndex);
      // Update sort_order values based on new position
      const updatedFields = reordered.map((field, idx) => ({ ...field, sort_order: idx + 1 }));
      
      setDefaultFieldsByCategory({
        ...defaultFieldsByCategory,
        [categoryId]: updatedFields
      });
    }
  };

  const saveDefaultFieldOrder = async (categoryId: string) => {
    try {
      const fields = defaultFieldsByCategory[categoryId] || [];
      const fieldOrders = fields.map(f => ({
        field_label: f.label,
        sort_order: f.sort_order
      }));

      const result = await saveFieldOrders('parent', categoryId, fieldOrders);
      
      if (result.success) {
        toast.success(`Default field order saved for ${categoryId}`);
        // Reload saved orders and re-apply them
        const response = await getFieldOrders('parent');
        if (response.success && response.data) {
          setSavedDefaultOrders(response.data);
          
          // Re-apply saved orders to all categories
          const updatedDefaults: Record<string, Array<{label: string, sort_order: number}>> = {};
          Object.keys(DEFAULT_FIELDS_BY_CATEGORY).forEach(catId => {
            const effective = getEffectiveFieldOrder(
              response.data!,
              catId,
              DEFAULT_FIELDS_BY_CATEGORY[catId]
            );
            updatedDefaults[catId] = effective;
          });
          setDefaultFieldsByCategory(updatedDefaults);
        }
      } else {
        toast.error(result.message || 'Failed to save field order');
      }
    } catch (error) {
      console.error('Error saving default field order:', error);
      toast.error('Failed to save field order');
    }
  };

  const toggleCampusSelection = (categoryId: string, fieldId: string, schoolId: string, checked: boolean) => {
    const field = categories.find(c => c.id === categoryId)?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const currentIds = field.applicable_school_ids || [];
    const newIds = checked
      ? [...currentIds, schoolId]
      : currentIds.filter(id => id !== schoolId);
    updateCustomField(categoryId, fieldId, { applicable_school_ids: newIds });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#022172]"></div>
        <span className="ml-2 text-gray-600 text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Compact Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[#022172] dark:text-white">Parent Custom Fields</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Define custom fields for parent forms</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowAddCategory(true)} 
            variant="outline" 
            size="sm"
          >
            <FolderPlus className="mr-1 h-3 w-3" />
            Add Category
          </Button>
          <Button onClick={handleSaveTemplate} disabled={isSaving} size="sm" className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white">
            <Save className="mr-1 h-3 w-3" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Add Category Dialog */}
      {showAddCategory && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name..."
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
              />
              <Button onClick={addNewCategory} size="sm">Add</Button>
              <Button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} variant="outline" size="sm">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compact Info */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-2 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs text-blue-800 dark:text-blue-300">Drag categories to reorder. Default fields shown in gray. Set custom field <strong>Sort Order</strong> to position between default fields.</span>
      </div>

      {/* Categories - Draggable */}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={categories.map(c => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {categories.map((category) => (
              <SortableCategoryItem
                key={category.id}
                category={category}
                expanded={expandedCategories.has(category.id)}
                onToggle={toggleCategory}
                onAddField={addFieldToCategory}
                onUpdateField={updateCustomField}
                onRemoveField={removeCustomField}
                onDeleteCategory={deleteCategory}
                branchSchools={branchSchools}
                toggleCampusSelection={toggleCampusSelection}
                isStandard={STANDARD_CATEGORIES.includes(category.id)}
                defaultFields={defaultFieldsByCategory[category.id] || []}
                onDefaultFieldDragEnd={(event) => handleDefaultFieldDragEnd(category.id, event)}
                onSaveDefaultFieldOrder={() => saveDefaultFieldOrder(category.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// Sortable Category Component
function SortableCategoryItem({ 
  category, 
  expanded, 
  onToggle, 
  onAddField, 
  onUpdateField, 
  onRemoveField,
  onDeleteCategory,
  branchSchools,
  toggleCampusSelection,
  isStandard,
  defaultFields,
  onDefaultFieldDragEnd,
  onSaveDefaultFieldOrder
}: {
  category: ExtendedCategory;
  expanded: boolean;
  onToggle: (id: string) => void;
  onAddField: (id: string) => void;
  onUpdateField: (catId: string, fieldId: string, updates: Partial<CustomField>) => void;
  onRemoveField: (catId: string, fieldId: string) => void;
  onDeleteCategory: (id: string) => void;
  branchSchools: BranchSchool[];
  toggleCampusSelection: (categoryId: string, fieldId: string, schoolId: string, checked: boolean) => void;
  isStandard: boolean;
  defaultFields: Array<{label: string, sort_order: number}>;
  onDefaultFieldDragEnd: (event: DragEndEvent) => void;
  onSaveDefaultFieldOrder: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  // Sensors for default field drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className="border-gray-200 dark:border-gray-700">
      {/* Category Header */}
      <div className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700">
        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => onToggle(category.id)}>
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
          <span className="font-medium text-sm text-[#022172] dark:text-gray-100">{category.name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">({category.fields.length} custom)</span>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onAddField(category.id); }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Field
          </Button>
          {!isStandard && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-red-500 hover:text-red-700"
              onClick={(e) => { e.stopPropagation(); onDeleteCategory(category.id); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <CardContent className="pt-0 pb-2 px-2">
          {/* Default Fields - Now Draggable */}
          {defaultFields.length > 0 && (
            <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">Default Fields - Drag to Reorder:</div>
                <Button
                  size="sm"
                  onClick={onSaveDefaultFieldOrder}
                  className="h-6 px-2 text-xs bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save Order
                </Button>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDefaultFieldDragEnd}
              >
                <SortableContext
                  items={defaultFields.map(f => f.label)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {defaultFields.map((field, idx) => (
                      <SortableDefaultField key={field.label} field={field} index={idx} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Custom Fields */}
          {category.fields.length > 0 ? (
            <div className="border dark:border-gray-700 rounded-md overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-200">
                <div className="col-span-3">Label</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-1">Order</div>
                <div className="col-span-2">Scope</div>
                <div className="col-span-2">Options</div>
                <div className="col-span-1">Req</div>
                <div className="col-span-1"></div>
              </div>

              {/* Field Rows */}
              {category.fields.map((field) => (
                <div key={field.id} className="grid grid-cols-12 gap-1 px-2 py-1 border-t dark:border-gray-700 items-center text-xs">
                  <div className="col-span-3">
                    <Input
                      value={field.label}
                      onChange={(e) => onUpdateField(category.id, field.id, { label: e.target.value })}
                      placeholder="Field label..."
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Select value={field.type} onValueChange={(v) => onUpdateField(category.id, field.id, { type: v as CustomFieldType })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="long-text">Long Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                        <SelectItem value="multi-select">Multi-Select</SelectItem>
                        <SelectItem value="file">File</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="0"
                      value={field.sort_order || 0}
                      onChange={(e) => onUpdateField(category.id, field.id, { sort_order: parseInt(e.target.value) || 0 })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-2 flex gap-1">
                    <Select
                      value={field.campus_scope || 'this_campus'}
                      onValueChange={(v) => onUpdateField(category.id, field.id, {
                        campus_scope: v as CampusScope,
                        applicable_school_ids: v === 'selected_campuses' ? (field.applicable_school_ids || []) : []
                      })}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="this_campus">This Only</SelectItem>
                        {branchSchools.length > 0 && (
                          <SelectItem value="selected_campuses">Selected</SelectItem>
                        )}
                        <SelectItem value="all_campuses">All</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.campus_scope === 'selected_campuses' && branchSchools.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 px-1">
                            <Building2 className="h-3 w-3" />
                            <span className="text-[10px] ml-1">{field.applicable_school_ids?.length || 0}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          <div className="space-y-2">
                            <span className="text-xs font-semibold dark:text-gray-200">Select Campuses</span>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {branchSchools.map(school => (
                                <label key={school.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded dark:text-gray-200">
                                  <Checkbox
                                    checked={field.applicable_school_ids?.includes(school.id) || false}
                                    onCheckedChange={(checked) => toggleCampusSelection(category.id, field.id, school.id, checked as boolean)}
                                  />
                                  {school.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  <div className="col-span-2">
                    {(field.type === "select" || field.type === "multi-select") ? (
                      <Input
                        defaultValue={field.options?.join(", ") || ""}
                        onBlur={(e) => onUpdateField(category.id, field.id, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                        placeholder="Male, Female, Other"
                        className="h-7 text-xs"
                      />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Checkbox
                      checked={field.required || false}
                      onCheckedChange={(checked) => onUpdateField(category.id, field.id, { required: checked as boolean })}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      onClick={() => onRemoveField(category.id, field.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-3 text-xs text-gray-400 dark:text-gray-500 border dark:border-gray-700 border-dashed rounded">
              No custom fields yet. Click "Add Field" to create one.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Sortable Default Field Component
function SortableDefaultField({ field, index }: { field: { label: string; sort_order: number }; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.label });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-600 text-xs"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing flex-shrink-0">
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold flex items-center justify-center">
        {index + 1}
      </span>
      <span className="flex-1 font-medium text-gray-700 dark:text-gray-200">{field.label}</span>
      <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">Order: {field.sort_order}</span>
    </div>
  );
}
