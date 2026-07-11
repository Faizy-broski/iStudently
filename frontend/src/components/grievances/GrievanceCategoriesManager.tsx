"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { grievancesApi, type GrievanceCategory } from "@/lib/api/grievances"

export function GrievanceCategoriesManager() {
  const t = useTranslations("grievances.categories")
  const [categories, setCategories] = useState<GrievanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)

  const load = () => {
    setLoading(true)
    grievancesApi.getCategories().then((res) => {
      if (res.success && res.data) setCategories(res.data)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await grievancesApi.createCategory(newName.trim())
      if (res.success) {
        setNewName("")
        toast.success(t("msg_added"))
        load()
      } else {
        toast.error(res.error || t("err_add_failed"))
      }
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string) => {
    const res = await grievancesApi.deleteCategory(id)
    if (res.success) {
      toast.success(t("msg_removed"))
      load()
    } else {
      toast.error(res.error || t("err_remove_failed"))
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder={t("new_category_placeholder")} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button onClick={handleAdd} disabled={adding || !newName.trim()} className="gap-2 shrink-0">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("btn_add")}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-1.5">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded-md border">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{c.name}</span>
                  {c.is_default && <Badge variant="outline" className="text-[10px]">{t("default_badge")}</Badge>}
                </div>
                {!c.is_default && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemove(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
