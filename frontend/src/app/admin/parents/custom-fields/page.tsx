"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, Settings2, ChevronDown, ChevronRight, GripVertical, FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomFieldCategory, CustomField } from "@/types";
import { customFieldsApi, CustomFieldDefinition, BranchSchool } from "@/lib/api/custom-fields";
import { useCampus } from "@/context/CampusContext";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getFieldOrders, getEffectiveFieldOrder, updateFieldRequired, DefaultFieldOrder } from '@/lib/utils/field-ordering';
import { getCategoryOrders, saveCategoryOrders } from '@/lib/api/custom-field-category-orders';
import { useTranslations } from "next-intl";
import { MergedFieldOrderList, type MergedFieldOrderListLabels } from "@/components/admin/custom-fields/MergedFieldOrderList";

// Default/Standard Fields for Parents
type DefaultFieldEntry = { label: string; id: string; sort_order: number; required: boolean };
const DEFAULT_FIELDS_BY_CATEGORY: Record<string, DefaultFieldEntry[]> = {
  personal: [
    { label: "First Name", id: "primaryFirstName", sort_order: 1, required: true },
    { label: "Last Name", id: "primaryLastName", sort_order: 2, required: true },
    { label: "CNIC", id: "primaryCNIC", sort_order: 3, required: true },
    { label: "Phone Number", id: "primaryPhone", sort_order: 4, required: true },
    { label: "Email Address", id: "primaryEmail", sort_order: 5, required: true },
  ],
  professional: [
    { label: "Occupation", id: "primaryOccupation", sort_order: 1, required: false },
    { label: "Workplace", id: "primaryWorkplace", sort_order: 2, required: false },
    { label: "Monthly Income", id: "primaryIncome", sort_order: 3, required: false },
  ],
  contact: [
    { label: "Home Address", id: "address", sort_order: 1, required: false },
    { label: "City", id: "city", sort_order: 2, required: false },
    { label: "State/Province", id: "state", sort_order: 3, required: false },
    { label: "ZIP/Postal Code", id: "zipCode", sort_order: 4, required: false },
    { label: "Country", id: "country", sort_order: 5, required: false },
  ],
  emergency: [
    { label: "Emergency Contact Name", id: "emergencyContactName", sort_order: 1, required: false },
    { label: "Relationship", id: "emergencyContactRelation", sort_order: 2, required: false },
    { label: "Phone", id: "emergencyContactPhone", sort_order: 3, required: false },
  ],
  system: [
    { label: "Username", id: "username", sort_order: 1, required: true },
    { label: "Password", id: "password", sort_order: 2, required: true },
  ],
};

type ExtendedCategory = CustomFieldCategory & { order: number };

export default function ParentCustomFieldsPage() {
  const { selectedCampus } = useCampus();
  const t = useTranslations("parents");
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDataLoadedRef = useRef(false);
  // Set synchronously right before any setCategories() call triggered by
  // loading data from the server, so the auto-save effect below can
  // deterministically skip that render's categories-change instead of
  // racing a setTimeout against React's effect flush order.
  const skipNextAutoSaveRef = useRef(false);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const categoriesRef = useRef(categories);
  const [isLoading, setIsLoading] = useState(true);
  const [branchSchools, setBranchSchools] = useState<BranchSchool[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [savedDefaultOrders, setSavedDefaultOrders] = useState<DefaultFieldOrder[]>([]);
  const [defaultFieldsByCategory, setDefaultFieldsByCategory] = useState<Record<string, DefaultFieldEntry[]>>(DEFAULT_FIELDS_BY_CATEGORY);

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
        const [fieldsResponse, branchesResponse, defaultOrdersResponse, categoryOrdersResponse] = await Promise.all([
          customFieldsApi.getFieldDefinitions('parent', campusId),
          customFieldsApi.getBranchSchools(),
          getFieldOrders('parent', undefined, campusId),
          getCategoryOrders('parent', campusId)
        ]);

        const savedCategoryOrderMap: Record<string, number> = {};
        if (categoryOrdersResponse.success && categoryOrdersResponse.data) {
          categoryOrdersResponse.data.forEach(c => { savedCategoryOrderMap[c.category_id] = c.category_order; });
        }

        // Load saved default field orders if any
        if (defaultOrdersResponse.success && defaultOrdersResponse.data) {
          setSavedDefaultOrders(defaultOrdersResponse.data);

          // Apply saved orders to default fields
          const updatedDefaults: Record<string, DefaultFieldEntry[]> = {};
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
            if (!(field.category_id in categoryOrderMap) && field.category_order !== undefined) {
              categoryOrderMap[field.category_id] = field.category_order;
            }
          });

          // Explicitly saved category orders (custom_field_category_orders) always
          // win over the legacy per-field category_order fallback above.
          Object.assign(categoryOrderMap, savedCategoryOrderMap);

          const mergedCategories = standardCategories.map(stdCat => ({
            ...stdCat,
            fields: (fieldsByCategory[stdCat.id] || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
            order: categoryOrderMap[stdCat.id] ?? stdCat.order,
          }));

          const customCategoryIds = Object.keys(fieldsByCategory).filter(id => !STANDARD_CATEGORIES.includes(id));
          customCategoryIds.forEach((catId, idx) => {
            const firstField = fieldsResponse.data!.find(f => f.category_id === catId);
            if (firstField) {
              mergedCategories.push({
                id: catId,
                name: firstField.category_name,
                fields: fieldsByCategory[catId].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
                order: categoryOrderMap[catId] ?? (standardCategories.length + idx + 1)
              });
            }
          });

          // Sort by order
          mergedCategories.sort((a, b) => a.order - b.order);

          skipNextAutoSaveRef.current = true;
          setCategories(mergedCategories);
          const withFields = new Set(mergedCategories.filter(c => c.fields.length > 0).map(c => c.id));
          setExpandedCategories(withFields);
        } else {
          skipNextAutoSaveRef.current = true;
          setCategories(standardCategories.map(cat => ({
            ...cat,
            order: savedCategoryOrderMap[cat.id] ?? cat.order,
          })).sort((a, b) => a.order - b.order));
        }

        if (branchesResponse.success && branchesResponse.data) {
          setBranchSchools(branchesResponse.data);
        }
      } catch (error) {
        console.error('Error loading custom fields:', error);
        toast.error(t("customFieldsPage.toasts.failedLoad"));
      } finally {
        setIsLoading(false);
        isDataLoadedRef.current = true;
        console.log('[CF:parent] isDataLoadedRef → true (initial load done)');
      }
    };
    isDataLoadedRef.current = false;
    console.log('[CF:parent] loadData start — isDataLoadedRef → false');
    loadData();
  }, [selectedCampus?.id]);

  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  useEffect(() => {
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      console.log('[CF:parent] auto-save skipped — this categories change came from loading data, not a user edit');
      return;
    }
    if (!isDataLoadedRef.current) {
      console.log('[CF:parent] auto-save skipped — data not loaded yet');
      return;
    }
    const snapshot = categories.flatMap(c => c.fields.map(f => `${f.id}:${f.label}`));
    console.log('[CF:parent] categories changed → scheduling auto-save in 1500ms | fields:', snapshot);
    if (isSavingRef.current) {
      console.log('[CF:parent] save in progress — marking pendingSave');
      pendingSaveRef.current = true;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { handleSaveTemplate(); }, 1500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [categories]);

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

        const reordered = arrayMove(items, oldIndex, newIndex).map((cat, idx) => ({ ...cat, order: idx + 1 }));

        saveCategoryOrders(
          'parent',
          reordered.map(cat => ({ category_id: cat.id, category_order: cat.order })),
          selectedCampus?.id
        ).then(res => {
          if (!res.success) {
            console.error('[CF:parent] Failed to save category order', res.error);
            toast.error(t("customFieldsPage.toasts.failedSave"));
          }
        }).catch(err => {
          console.error('[CF:parent] Failed to save category order', err);
          toast.error(t("customFieldsPage.toasts.failedSave"));
        });

        return reordered;
      });
    }
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error(t("customFieldsPage.toasts.categoryNameEmpty"));
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
    toast.success(t("customFieldsPage.toasts.categoryAdded"));
  };

  const deleteCategory = (categoryId: string) => {
    if (STANDARD_CATEGORIES.includes(categoryId)) {
      toast.error(t("customFieldsPage.toasts.cannotDeleteStandard"));
      return;
    }

    setCategories(categories.filter(c => c.id !== categoryId));
    toast.success(t("customFieldsPage.toasts.categoryDeleted"));
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
    const field = categories.find(c => c.id === categoryId)?.fields.find(f => f.id === fieldId);
    console.log(`[CF:parent] removeCustomField`, { categoryId, fieldId, label: field?.label, isTemp: fieldId.startsWith('field-') });
    setCategories(categories.map((cat) =>
      cat.id === categoryId ? { ...cat, fields: cat.fields.filter((field) => field.id !== fieldId) } : cat
    ));
  };

  const rebuildCategoriesFromApi = (current: ExtendedCategory[], apiFields: CustomFieldDefinition[]): ExtendedCategory[] => {
    const existingRealIds = new Set<string>();
    current.forEach(cat => cat.fields.forEach(f => { if (!f.id.startsWith('field-')) existingRealIds.add(f.id); }));
    const newIdByLabelAndCat: Record<string, string> = {};
    apiFields.forEach(f => {
      if (!existingRealIds.has(f.id)) newIdByLabelAndCat[`${f.category_id}::${f.label}`] = f.id;
    });
    console.log(`[CF:parent] rebuildCategoriesFromApi`, { currentFieldCount: current.reduce((n, c) => n + c.fields.length, 0), apiFieldCount: apiFields.length, newMappings: newIdByLabelAndCat });
    const result = current.map(cat => ({
      ...cat,
      fields: cat.fields.map(f => {
        if (!f.id.startsWith('field-')) return f;
        const realId = newIdByLabelAndCat[`${cat.id}::${f.label}`];
        if (realId) console.log(`[CF:parent] resolved temp id ${f.id} → ${realId}`);
        else console.warn(`[CF:parent] no match for temp id=${f.id} label="${f.label}"`);
        return realId ? { ...f, id: realId } : f;
      }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    }));
    console.log(`[CF:parent] rebuild result fieldCount=${result.reduce((n, c) => n + c.fields.length, 0)}`);
    return result;
  };

  const handleSaveTemplate = async () => {
    console.log(`[CF:parent] handleSaveTemplate called | isSaving=${isSavingRef.current}`);
    if (isSavingRef.current) {
      console.warn('[CF:parent] save skipped — marking pendingSave');
      pendingSaveRef.current = true;
      return;
    }
    pendingSaveRef.current = false;
    isSavingRef.current = true;
    setSaveStatus('saving');
    try {
      const campusId = selectedCampus?.id;
      const existingResponse = await customFieldsApi.getFieldDefinitions('parent', campusId);
      const existingIds = new Set((existingResponse.data || []).map(f => f.id));
      const currentIds = new Set<string>();
      let newFieldsCreated = false;

      const allFields: { categoryId: string; categoryName: string; field: CustomField }[] = [];
      categoriesRef.current.forEach(cat => {
        cat.fields.forEach(field => {
          if (field.label.trim()) {
            allFields.push({ categoryId: cat.id, categoryName: cat.name, field });
            if (!field.id.startsWith('field-')) currentIds.add(field.id);
          }
        });
      });

      console.log(`[CF:parent] save snapshot`, {
        existingIdsInDB: [...existingIds],
        currentIdsInUI: [...currentIds],
        toDelete: [...existingIds].filter(id => !currentIds.has(id)),
      });

      for (const { categoryId, categoryName, field } of allFields) {
        if (existingIds.has(field.id)) {
          await customFieldsApi.updateFieldDefinition(field.id, {
            label: field.label, type: field.type, options: field.options,
            required: field.required, sort_order: field.sort_order,
            campus_scope: field.campus_scope, applicable_school_ids: field.applicable_school_ids,
          }, campusId);
        } else {
          await customFieldsApi.createFieldDefinition({
            entity_type: 'parent', category_id: categoryId, category_name: categoryName,
            label: field.label, type: field.type, options: field.options,
            required: field.required, sort_order: field.sort_order,
            campus_scope: field.campus_scope, applicable_school_ids: field.applicable_school_ids,
          }, campusId);
          console.log(`[CF:parent] created field tempId=${field.id} label="${field.label}"`);
          newFieldsCreated = true;
        }
      }

      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          console.log(`[CF:parent] deleting field id=${id}`);
          const deleteResult = await customFieldsApi.deleteFieldDefinition(id, campusId);
          console.log(`[CF:parent] delete result for ${id}:`, deleteResult);
        }
      }

      if (newFieldsCreated) {
        console.log('[CF:parent] reloading from API to resolve temp IDs...');
        const refreshed = await customFieldsApi.getFieldDefinitions('parent', campusId);
        console.log('[CF:parent] reload response:', { success: refreshed.success, count: refreshed.data?.length, fields: refreshed.data?.map(f => ({ id: f.id, label: f.label, isActive: f.is_active })) });
        if (refreshed.success && refreshed.data) {
          setCategories(prev => rebuildCategoriesFromApi(prev, refreshed.data!));
        }
      }

      console.log('[CF:parent] save complete');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('[CF:parent] save error:', error);
      toast.error(t("customFieldsPage.toasts.failedSave"));
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current) {
        console.log('[CF:parent] pendingSave detected — running follow-up save');
        pendingSaveRef.current = false;
        saveTimeoutRef.current = setTimeout(() => handleSaveTemplate(), 0);
      }
    }
  };

  const refreshDefaultFieldOrders = async () => {
    const campusId = selectedCampus?.id;
    const response = await getFieldOrders('parent', undefined, campusId);
    if (response.success && response.data) {
      setSavedDefaultOrders(response.data);

      const updatedDefaults: Record<string, DefaultFieldEntry[]> = {};
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
  };

  const handleDefaultRequiredToggle = async (
    categoryId: string,
    item: { id?: string; label: string; sort_order: number },
    checked: boolean
  ) => {
    const fieldKey = item.id ?? item.label;
    const campusId = selectedCampus?.id;
    const applyLocal = (required: boolean) => {
      setDefaultFieldsByCategory(prev => ({
        ...prev,
        [categoryId]: (prev[categoryId] || []).map(f =>
          (f.id ?? f.label) === fieldKey ? { ...f, required } : f
        ),
      }));
    };
    applyLocal(checked);
    try {
      const res = await updateFieldRequired('parent', categoryId, fieldKey, checked, item.sort_order, campusId);
      if (!res.success) {
        applyLocal(!checked);
        toast.error(res.error || t("customFieldsPage.toasts.failedSave"));
      }
    } catch {
      applyLocal(!checked);
      toast.error(t("customFieldsPage.toasts.failedSave"));
    }
  };

  const refreshCustomFieldOrders = async () => {
    const campusId = selectedCampus?.id;
    const res = await customFieldsApi.getFieldDefinitions('parent', campusId);
    if (res.success && res.data) {
      const sortOrderById = new Map(res.data.map(f => [f.id, f.sort_order]));
      setCategories(prev => prev.map(cat => ({
        ...cat,
        fields: cat.fields.map(f => sortOrderById.has(f.id) ? { ...f, sort_order: sortOrderById.get(f.id)! } : f)
      })));
    }
  };

  const handleOrderSaved = async () => {
    await Promise.all([refreshDefaultFieldOrders(), refreshCustomFieldOrders()]);
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
        <span className="ml-2 text-gray-600 text-sm">{t("loading")}</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Compact Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[#022172] dark:text-white">{t("customFields")}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("defineCustomFields")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /><span>{t("saving")}</span></>}
            {saveStatus === 'saved' && <span className="text-green-600">✓ {t("save")}</span>}
            {saveStatus === 'error' && <span className="text-red-500">{t("customFieldsPage.toasts.failedSave")}</span>}
          </div>
          <Button onClick={() => setShowAddCategory(true)} variant="outline" size="sm">
            <FolderPlus className="mr-1 h-3 w-3" />
            {t("customFieldsPage.addCategory")}
          </Button>
          <Button onClick={handleSaveTemplate} disabled={saveStatus === 'saving'} size="sm" className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white">
            <Save className="mr-1 h-3 w-3" />
            {saveStatus === 'saving' ? t("saving") : t("save")}
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
                placeholder={t("customFieldsPage.placeholders.categoryName")}
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
              />
              <Button onClick={addNewCategory} size="sm">{t("add")}</Button>
              <Button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} variant="outline" size="sm">{t("cancel")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compact Info */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-2 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs text-blue-800 dark:text-blue-300">{t.rich("customFieldsPage.info", { strong: (chunks) => <strong>{chunks}</strong> })}</span>
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
                campusId={selectedCampus?.id}
                onOrderSaved={handleOrderSaved}
                onDefaultRequiredToggle={(item, checked) => handleDefaultRequiredToggle(category.id, item, checked)}
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
  campusId,
  onOrderSaved,
  onDefaultRequiredToggle
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
  defaultFields: DefaultFieldEntry[];
  campusId?: string;
  onOrderSaved: () => void;
  onDefaultRequiredToggle: (item: { id?: string; label: string; sort_order: number }, checked: boolean) => void;
}) {
  const fieldLabels: MergedFieldOrderListLabels = {
    th_label: "Label",
    th_type: "Type",
    th_scope: "Scope",
    th_options: "Options",
    th_req: "Req",
    btn_save_order: "Save Order",
    field_label_placeholder: "Field label...",
    field_options_placeholder: "Male, Female, Other",
    scope_this: "This Only",
    scope_selected: "Selected",
    scope_all: "All",
    select_campuses: "Select Campuses",
    no_fields: 'No custom fields yet. Click "Add Field" to create one.',
    default_badge: "Default",
    type_text: "Text",
    type_long_text: "Long Text",
    type_number: "Number",
    type_date: "Date",
    type_checkbox: "Checkbox",
    type_select: "Select",
    type_multi_select: "Multi-Select",
    type_file: "File",
  };

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
          <MergedFieldOrderList
            entityType="parent"
            categoryId={category.id}
            campusId={campusId}
            defaultFields={defaultFields}
            customFields={category.fields}
            branchSchools={branchSchools}
            labels={fieldLabels}
            onUpdateField={(fieldId, updates) => onUpdateField(category.id, fieldId, updates)}
            onRemoveField={(fieldId) => onRemoveField(category.id, fieldId)}
            toggleCampusSelection={(fieldId, schoolId, checked) => toggleCampusSelection(category.id, fieldId, schoolId, checked)}
            onOrderSaved={onOrderSaved}
            onDefaultRequiredToggle={onDefaultRequiredToggle}
          />
        </CardContent>
      )}
    </Card>
  );
}
