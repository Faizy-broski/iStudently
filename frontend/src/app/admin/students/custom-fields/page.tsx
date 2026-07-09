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
import { getFieldOrders, getEffectiveFieldOrder, DefaultFieldOrder } from '@/lib/utils/field-ordering';
import { useTranslations } from "next-intl";
import { MergedFieldOrderList, type MergedFieldOrderListLabels } from "@/components/admin/custom-fields/MergedFieldOrderList";

// Default/Standard Fields for Students
const DEFAULT_FIELDS_BY_CATEGORY: Record<string, Array<{label: string, sort_order: number}>> = {
  personal: [
    { label: 'First Name', sort_order: 1 },
    { label: "Father's Name", sort_order: 2 },
    { label: "Grandfather's Name", sort_order: 3 },
    { label: 'Surname', sort_order: 4 },
    { label: 'Date of Birth', sort_order: 5 },
    { label: 'Gender', sort_order: 6 },
    { label: 'Student Photo', sort_order: 7 },
    { label: 'Address', sort_order: 8 },
    { label: 'Email', sort_order: 9 },
    { label: 'Phone Number', sort_order: 10 },
  ],
  academic: [
    { label: 'Grade Level', sort_order: 1 },
    { label: 'Section', sort_order: 2 },
    { label: 'Admission Date', sort_order: 3 },
    { label: 'Previous School History', sort_order: 4 },
  ],
  medical: [
    { label: 'Blood Group', sort_order: 1 },
    { label: 'Has Allergies?', sort_order: 2 },
    { label: 'Allergies List', sort_order: 3 },
    { label: 'Medical Notes', sort_order: 4 },
  ],
  family: [
    { label: 'Link to Parent', sort_order: 1 },
    { label: 'Relationship Type', sort_order: 2 },
    { label: 'Emergency Contacts', sort_order: 3 },
  ],
  system: [
    { label: 'Username', sort_order: 1 },
    { label: 'Password', sort_order: 2 },
  ],
};

const STANDARD_FIELD_KEYS: Record<string, string> = {
  'First Name': 'first_name',
  "Father's Name": 'father_name',
  "Grandfather's Name": 'grandfather_name',
  'Surname': 'surname',
  'Date of Birth': 'dob',
  'Gender': 'gender',
  'Student Photo': 'photo',
  'Address': 'address',
  'Email': 'email',
  'Phone Number': 'phone',
  'Grade Level': 'grade',
  'Section': 'section',
  'Admission Date': 'admission_date',
  'Previous School History': 'prev_school',
  'Blood Group': 'blood_group',
  'Has Allergies?': 'has_allergies',
  'Allergies List': 'allergies_list',
  'Medical Notes': 'medical_notes',
  'Link to Parent': 'link_parent',
  'Relationship Type': 'relation_type',
  'Emergency Contacts': 'emergency_contacts',
  'Username': 'username',
  'Password': 'password'
};

type ExtendedCategory = CustomFieldCategory & { order: number };

export default function CustomFieldsPage() {
  const t = useTranslations("school.students.custom_fields");
  const tCommon = useTranslations("common");
  const { selectedCampus } = useCampus();
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDataLoadedRef = useRef(false);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);       // change happened while save was running
  const categoriesRef = useRef(categories);   // always holds latest categories (avoids stale closure)
  const [isLoading, setIsLoading] = useState(true);
  const [branchSchools, setBranchSchools] = useState<BranchSchool[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [savedDefaultOrders, setSavedDefaultOrders] = useState<DefaultFieldOrder[]>([]);
  const [defaultFieldsByCategory, setDefaultFieldsByCategory] = useState<Record<string, Array<{label: string, sort_order: number}>>>(DEFAULT_FIELDS_BY_CATEGORY);

  const STANDARD_CATEGORIES = ['personal', 'academic', 'medical', 'family', 'system'];

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
        const campusId = selectedCampus?.id;
        const [fieldsResponse, branchesResponse, defaultOrdersResponse] = await Promise.all([
          customFieldsApi.getFieldDefinitions('student', campusId),
          customFieldsApi.getBranchSchools(),
          getFieldOrders('student')
        ]);

        if (defaultOrdersResponse.success && defaultOrdersResponse.data) {
          setSavedDefaultOrders(defaultOrdersResponse.data);

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
          { id: 'personal', name: t("cat_personal"), fields: [], order: 1 },
          { id: 'academic', name: t("cat_academic"), fields: [], order: 2 },
          { id: 'medical', name: t("cat_medical"), fields: [], order: 3 },
          { id: 'family', name: t("cat_family"), fields: [], order: 4 },
          { id: 'system', name: t("cat_system"), fields: [], order: 5 },
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

            if (!categoryOrderMap[field.category_id] && field.category_order !== undefined) {
              categoryOrderMap[field.category_id] = field.category_order;
            }
          });

          const mergedCategories = standardCategories.map(stdCat => ({
            ...stdCat,
            order: categoryOrderMap[stdCat.id] || stdCat.order,
            fields: (fieldsByCategory[stdCat.id] || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
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
        toast.error(tCommon("error_occurred"));
      } finally {
        setIsLoading(false);
        setTimeout(() => {
          isDataLoadedRef.current = true;
          console.log('[CF:student] isDataLoadedRef → true (initial load done)');
        }, 0);
      }
    };
    isDataLoadedRef.current = false;
    console.log('[CF:student] loadData start — isDataLoadedRef → false');
    loadData();
  }, [selectedCampus?.id]);

  // Keep categoriesRef in sync so handleSaveTemplate always reads fresh data
  useEffect(() => { categoriesRef.current = categories; }, [categories]);

  // Auto-save: debounced 1.5 s after any categories change
  useEffect(() => {
    if (!isDataLoadedRef.current) {
      console.log('[CF:student] auto-save skipped — data not loaded yet');
      return;
    }
    const snapshot = categories.flatMap(c => c.fields.map(f => `${f.id}:${f.label}`));
    console.log('[CF:student] categories changed → scheduling auto-save in 1500ms | fields:', snapshot);
    if (isSavingRef.current) {
      // Save already running — mark that another pass is needed after it finishes
      console.log('[CF:student] save in progress — marking pendingSave for after completion');
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

        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((cat, idx) => ({ ...cat, order: idx + 1 }));
      });
    }
  };

  const addNewCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error(tCommon("fill_required_fields"));
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
    toast.success(tCommon("success"));
  };

  const deleteCategory = (categoryId: string) => {
    if (STANDARD_CATEGORIES.includes(categoryId)) {
      toast.error(tCommon("error"));
      return;
    }

    setCategories(categories.filter(c => c.id !== categoryId));
    toast.success(tCommon("success"));
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
    console.log(`[CF:student] removeCustomField`, { categoryId, fieldId, label: field?.label, isTemp: fieldId.startsWith('field-') });
    setCategories(categories.map((cat) =>
      cat.id === categoryId ? { ...cat, fields: cat.fields.filter((field) => field.id !== fieldId) } : cat
    ));
  };

  // Only resolves temp IDs → real DB UUIDs; never overwrites fields the user removed
  const rebuildCategoriesFromApi = (current: ExtendedCategory[], apiFields: CustomFieldDefinition[]): ExtendedCategory[] => {
    const existingRealIds = new Set<string>();
    current.forEach(cat => cat.fields.forEach(f => { if (!f.id.startsWith('field-')) existingRealIds.add(f.id); }));

    const newIdByLabelAndCat: Record<string, string> = {};
    apiFields.forEach(f => {
      if (!existingRealIds.has(f.id)) {
        newIdByLabelAndCat[`${f.category_id}::${f.label}`] = f.id;
      }
    });

    console.log(`[CF:student] rebuildCategoriesFromApi`, {
      currentFieldCount: current.reduce((n, c) => n + c.fields.length, 0),
      apiFieldCount: apiFields.length,
      existingRealIds: [...existingRealIds],
      newMappings: newIdByLabelAndCat,
    });

    const result = current.map(cat => ({
      ...cat,
      fields: cat.fields.map(f => {
        if (!f.id.startsWith('field-')) return f;
        const realId = newIdByLabelAndCat[`${cat.id}::${f.label}`];
        if (realId) console.log(`[CF:student] resolved temp id ${f.id} → ${realId} (label="${f.label}")`);
        else console.warn(`[CF:student] no DB match for temp field id=${f.id} label="${f.label}" cat=${cat.id}`);
        return realId ? { ...f, id: realId } : f;
      }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    }));

    console.log(`[CF:student] rebuildCategoriesFromApi result fieldCount=${result.reduce((n, c) => n + c.fields.length, 0)}`);
    return result;
  };

  const handleSaveTemplate = async () => {
    console.log(`[CF:student] handleSaveTemplate called | isSaving=${isSavingRef.current}`);
    if (isSavingRef.current) {
      console.warn('[CF:student] save skipped — already saving; marking pendingSave');
      pendingSaveRef.current = true;
      return;
    }
    pendingSaveRef.current = false;
    isSavingRef.current = true;
    setSaveStatus('saving');
    try {
      const campusId = selectedCampus?.id;
      const existingResponse = await customFieldsApi.getFieldDefinitions('student', campusId);
      const existingIds = new Set((existingResponse.data || []).map(f => f.id));
      const currentIds = new Set<string>();
      let newFieldsCreated = false;

      // Use categoriesRef.current — always the latest, not the stale closure
      const allFields: { categoryId: string; categoryName: string; categoryOrder: number; field: CustomField }[] = [];
      categoriesRef.current.forEach(cat => {
        cat.fields.forEach(field => {
          if (field.label.trim()) {
            allFields.push({ categoryId: cat.id, categoryName: cat.name, categoryOrder: cat.order, field });
            if (!field.id.startsWith('field-')) currentIds.add(field.id);
          }
        });
      });

      console.log(`[CF:student] save snapshot`, {
        existingIdsInDB: [...existingIds],
        currentIdsInUI: [...currentIds],
        toCreate: allFields.filter(f => !existingIds.has(f.field.id)).map(f => ({ id: f.field.id, label: f.field.label })),
        toUpdate: allFields.filter(f => existingIds.has(f.field.id)).map(f => ({ id: f.field.id, label: f.field.label })),
        toDelete: [...existingIds].filter(id => !currentIds.has(id)),
      });

      for (const { categoryId, categoryName, categoryOrder, field } of allFields) {
        if (existingIds.has(field.id)) {
          await customFieldsApi.updateFieldDefinition(field.id, {
            label: field.label, type: field.type, options: field.options,
            required: field.required, sort_order: field.sort_order,
            category_order: categoryOrder,
            campus_scope: field.campus_scope, applicable_school_ids: field.applicable_school_ids,
          }, campusId);
        } else {
          await customFieldsApi.createFieldDefinition({
            entity_type: 'student', category_id: categoryId, category_name: categoryName,
            label: field.label, type: field.type, options: field.options,
            required: field.required, sort_order: field.sort_order,
            category_order: categoryOrder,
            campus_scope: field.campus_scope, applicable_school_ids: field.applicable_school_ids,
          }, campusId);
          console.log(`[CF:student] created field tempId=${field.id} label="${field.label}"`);
          newFieldsCreated = true;
        }
      }

      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          console.log(`[CF:student] deleting field id=${id}`);
          const deleteResult = await customFieldsApi.deleteFieldDefinition(id, campusId);
          console.log(`[CF:student] delete result for ${id}:`, deleteResult);
        }
      }

      if (newFieldsCreated) {
        console.log('[CF:student] reloading from API to resolve temp IDs...');
        const refreshed = await customFieldsApi.getFieldDefinitions('student', campusId);
        console.log('[CF:student] reload response:', { success: refreshed.success, count: refreshed.data?.length, fields: refreshed.data?.map(f => ({ id: f.id, label: f.label, category: f.category_id, isActive: f.is_active })) });
        if (refreshed.success && refreshed.data) {
          setCategories(prev => rebuildCategoriesFromApi(prev, refreshed.data!));
        }
      }

      console.log('[CF:student] save complete');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('[CF:student] save error:', error);
      toast.error(tCommon("error_occurred"));
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      isSavingRef.current = false;
      // If changes arrived while this save was running, do another pass immediately
      if (pendingSaveRef.current) {
        console.log('[CF:student] pendingSave detected after completion — running follow-up save');
        pendingSaveRef.current = false;
        saveTimeoutRef.current = setTimeout(() => handleSaveTemplate(), 0);
      }
    }
  };

  // Refresh default-field order cache after a merged order save
  const refreshDefaultFieldOrders = async () => {
    const response = await getFieldOrders('student');
    if (response.success && response.data) {
      setSavedDefaultOrders(response.data);

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
  };

  // Refresh custom fields' sort_order after a merged order save (id-matched, doesn't clobber other local edits)
  const refreshCustomFieldOrders = async () => {
    const campusId = selectedCampus?.id;
    const res = await customFieldsApi.getFieldDefinitions('student', campusId);
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
        <Loader2 className="h-6 w-6 animate-spin text-[#022172]" />
        <span className="ml-2 text-gray-600 text-sm">{tCommon("loading")}</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[#022172] dark:text-white">{t("title")}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-save status indicator */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /><span>{t("saving")}</span></>}
            {saveStatus === 'saved' && <span className="text-green-600">✓ {t("save")}</span>}
            {saveStatus === 'error' && <span className="text-red-500">{tCommon("error_occurred")}</span>}
          </div>
          <Button onClick={() => setShowAddCategory(true)} variant="outline" size="sm">
            <FolderPlus className="mr-1 h-3 w-3 rtl:ml-1 rtl:mr-0" />
            {t("add_category")}
          </Button>
          <Button onClick={handleSaveTemplate} disabled={saveStatus === 'saving'} size="sm" className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white">
            <Save className="mr-1 h-3 w-3 rtl:ml-1 rtl:mr-0" />
            {saveStatus === 'saving' ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      {showAddCategory && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t("category_name_placeholder")}
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
              />
              <Button onClick={addNewCategory} size="sm">{tCommon("add")}</Button>
              <Button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }} variant="outline" size="sm">{tCommon("cancel")}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-2 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs text-blue-800 dark:text-blue-300">{t("info_reorder")}</span>
      </div>

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
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

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
  onOrderSaved
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
  campusId?: string;
  onOrderSaved: () => void;
}) {
  const t = useTranslations("school.students.custom_fields");
  const tFields = useTranslations("school.students.custom_fields.standard_fields");

  const fieldLabels: MergedFieldOrderListLabels = {
    th_label: t("th_label"),
    th_type: t("th_type"),
    th_scope: t("th_scope"),
    th_options: t("th_options"),
    th_req: t("th_req"),
    btn_save_order: t("btn_save_order"),
    field_label_placeholder: t("field_label_placeholder"),
    field_options_placeholder: t("field_options_placeholder"),
    scope_this: t("scope_this"),
    scope_selected: t("scope_selected"),
    scope_all: t("scope_all"),
    select_campuses: t("select_campuses"),
    no_fields: t("no_custom_fields"),
    default_badge: t("default_fields"),
    type_text: t("type_text", { defaultValue: "Text" }),
    type_long_text: t("type_long_text", { defaultValue: "Long Text" }),
    type_number: t("type_number", { defaultValue: "Number" }),
    type_date: t("type_date", { defaultValue: "Date" }),
    type_checkbox: t("type_checkbox", { defaultValue: "Checkbox" }),
    type_select: t("type_select", { defaultValue: "Select" }),
    type_multi_select: t("type_multi_select", { defaultValue: "Multi-Select" }),
    type_file: t("type_file", { defaultValue: "File" }),
  };

  const translateDefaultLabel = (label: string) =>
    tFields.has(STANDARD_FIELD_KEYS[label]) ? tFields(STANDARD_FIELD_KEYS[label]) : label;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

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
      <div className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700">
        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => onToggle(category.id)}>
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500 rtl:rotate-180" />
          )}
          <span className="font-medium text-sm text-[#022172] dark:text-gray-100">{category.name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{t("custom_count", { count: category.fields.length })}</span>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onAddField(category.id); }}
          >
            <Plus className="h-3 w-3 mr-1 rtl:ml-1 rtl:mr-0" />
            {t("add_field")}
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

      {expanded && (
        <CardContent className="pt-0 pb-2 px-2">
          <MergedFieldOrderList
            entityType="student"
            categoryId={category.id}
            campusId={campusId}
            defaultFields={defaultFields}
            customFields={category.fields}
            branchSchools={branchSchools}
            labels={fieldLabels}
            translateDefaultLabel={translateDefaultLabel}
            onUpdateField={(fieldId, updates) => onUpdateField(category.id, fieldId, updates)}
            onRemoveField={(fieldId) => onRemoveField(category.id, fieldId)}
            toggleCampusSelection={(fieldId, schoolId, checked) => toggleCampusSelection(category.id, fieldId, schoolId, checked)}
            onOrderSaved={onOrderSaved}
          />
        </CardContent>
      )}
    </Card>
  );
}
