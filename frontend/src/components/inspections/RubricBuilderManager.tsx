"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus, Pencil, Trash2, Layers, AlertTriangle, Sparkles } from "lucide-react"
import {
  getActiveRubric, ensureDefaultTemplate, createCategory, updateCategory, deleteCategory,
  createCriterion, updateCriterion, deleteCriterion,
  type RubricTemplate, type RubricCategory, type RubricCriterion,
} from "@/lib/api/inspection-rubric"

export function RubricBuilderManager() {
  const t = useTranslations("inspections.rubrics")

  const [template, setTemplate] = useState<RubricTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingDefault, setCreatingDefault] = useState(false)

  const [catOpen, setCatOpen] = useState(false)
  const [catEditing, setCatEditing] = useState<RubricCategory | null>(null)
  const [catForm, setCatForm] = useState({ name: "", weight: "" })
  const [catSaving, setCatSaving] = useState(false)

  const [critOpen, setCritOpen] = useState(false)
  const [critCategoryId, setCritCategoryId] = useState<string | null>(null)
  const [critEditing, setCritEditing] = useState<RubricCriterion | null>(null)
  const [critForm, setCritForm] = useState({ name: "", description: "" })
  const [critSaving, setCritSaving] = useState(false)

  const load = () => {
    setLoading(true)
    getActiveRubric().then((res) => {
      if (res.error) toast.error(res.error)
      setTemplate(res.data)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleCreateDefault = async () => {
    setCreatingDefault(true)
    try {
      const res = await ensureDefaultTemplate()
      if (res.error) toast.error(res.error)
      else { toast.success(t("msg_default_created")); load() }
    } finally { setCreatingDefault(false) }
  }

  const openCreateCategory = () => {
    setCatEditing(null)
    setCatForm({ name: "", weight: "" })
    setCatOpen(true)
  }
  const openEditCategory = (c: RubricCategory) => {
    setCatEditing(c)
    setCatForm({ name: c.name, weight: String(c.weight) })
    setCatOpen(true)
  }
  const handleSaveCategory = async () => {
    if (!template || !catForm.name.trim()) return
    setCatSaving(true)
    try {
      const weight = catForm.weight.trim() ? Number(catForm.weight) : 0
      const res = catEditing
        ? await updateCategory(catEditing.id, { name: catForm.name.trim(), weight })
        : await createCategory(template.id, { name: catForm.name.trim(), weight, sort_order: template.categories.length })
      if (res.error) toast.error(res.error)
      else { toast.success(t("msg_category_saved")); setCatOpen(false); load() }
    } finally { setCatSaving(false) }
  }
  const handleDeleteCategory = async (id: string) => {
    const res = await deleteCategory(id)
    if (res.error) toast.error(res.error)
    else { toast.success(t("msg_category_deleted")); load() }
  }

  const openCreateCriterion = (categoryId: string) => {
    setCritCategoryId(categoryId)
    setCritEditing(null)
    setCritForm({ name: "", description: "" })
    setCritOpen(true)
  }
  const openEditCriterion = (categoryId: string, crit: RubricCriterion) => {
    setCritCategoryId(categoryId)
    setCritEditing(crit)
    setCritForm({ name: crit.name, description: crit.description || "" })
    setCritOpen(true)
  }
  const handleSaveCriterion = async () => {
    if (!critCategoryId || !critForm.name.trim()) return
    setCritSaving(true)
    try {
      const category = template?.categories.find((c) => c.id === critCategoryId)
      const res = critEditing
        ? await updateCriterion(critEditing.id, { name: critForm.name.trim(), description: critForm.description.trim() || undefined })
        : await createCriterion(critCategoryId, {
            name: critForm.name.trim(),
            description: critForm.description.trim() || undefined,
            sort_order: category?.criteria.length ?? 0,
          })
      if (res.error) toast.error(res.error)
      else { toast.success(t("msg_criterion_saved")); setCritOpen(false); load() }
    } finally { setCritSaving(false) }
  }
  const handleDeleteCriterion = async (id: string) => {
    const res = await deleteCriterion(id)
    if (res.error) toast.error(res.error)
    else { toast.success(t("msg_criterion_deleted")); load() }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  if (!template) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t("no_rubric_title")}</CardTitle>
          <CardDescription>{t("no_rubric_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateDefault} disabled={creatingDefault} className="gap-2">
            {creatingDefault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t("btn_create_default")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const totalWeight = template.categories.reduce((sum, c) => sum + Number(c.weight), 0)

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{t("total_weight_label")}:</span>
            <Badge variant={totalWeight === 100 ? "secondary" : "outline"} className={totalWeight !== 100 ? "text-amber-700 border-amber-300" : ""}>
              {totalWeight}%
            </Badge>
            {totalWeight !== 100 && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" /> {t("weight_warning")}
              </span>
            )}
          </div>
        </div>
        <Button size="sm" onClick={openCreateCategory} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("btn_add_category")}
        </Button>
      </div>

      {template.categories.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">{t("no_categories")}</p>
      ) : (
        <div className="space-y-4">
          {template.categories.map((cat) => (
            <Card key={cat.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#022172]" />
                  <CardTitle className="text-base">{cat.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{cat.weight}%</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCategory(cat)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {cat.criteria.length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">{t("no_criteria")}</p>
                ) : (
                  cat.criteria.map((crit) => (
                    <div key={crit.id} className="flex items-center justify-between p-2 rounded-md border text-sm">
                      <span>{crit.name}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditCriterion(cat.id, crit)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteCriterion(crit.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => openCreateCriterion(cat.id)}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("btn_add_criterion")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{catEditing ? t("dialog_edit_category") : t("dialog_new_category")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t("field_name")}</Label>
              <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("field_weight")}</Label>
              <Input type="number" min={0} max={100} value={catForm.weight} onChange={(e) => setCatForm({ ...catForm, weight: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCategory} disabled={catSaving || !catForm.name.trim()} className="gap-2">
              {catSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("btn_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={critOpen} onOpenChange={setCritOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{critEditing ? t("dialog_edit_criterion") : t("dialog_new_criterion")}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>{t("field_name")}</Label>
              <Input value={critForm.name} onChange={(e) => setCritForm({ ...critForm, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("field_description")}</Label>
              <Textarea rows={2} value={critForm.description} onChange={(e) => setCritForm({ ...critForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCriterion} disabled={critSaving || !critForm.name.trim()} className="gap-2">
              {critSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("btn_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
