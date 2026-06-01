"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  LetterTemplate,
  TemplateContext,
  getLetterTemplates,
  createLetterTemplate,
  updateLetterTemplate,
  deleteLetterTemplate,
} from "@/lib/api/letter-templates";

interface TemplateSelectorProps {
  /** Which feature context: 'print_letters' | 'email' */
  context: TemplateContext;
  /** Campus ID for scoping templates */
  campusId?: string;
  /** Called when admin selects a template — passes the HTML content */
  onLoad: (content: string) => void;
  /** Called to get the current editor content when saving */
  getCurrentContent: () => string;
  /** Label shown in the section header, e.g. "TEMPLATES - PRINT LETTERS" */
  label?: string;
}

type TemplateAction = "n/a" | "add" | "update" | "delete";

/**
 * TemplateSelector — mirrors the RosarioSIS Templates plugin pattern.
 *
 * Shows a labeled card section with:
 *  • A dropdown listing saved templates
 *  • An action dropdown: Add / Update / Delete
 *
 * Selecting a template fires `onLoad(content)` so the parent can inject it
 * into the editor. Save / Update / Delete actions use `getCurrentContent()`
 * to read the editor state.
 */
export default function TemplateSelector({
  context,
  campusId,
  onLoad,
  getCurrentContent,
  label,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [action, setAction] = useState<TemplateAction>("n/a");

  // Dialog state for "Add New" (asks for name)
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [saving, setSaving] = useState(false);

  const sectionLabel = label ?? `TEMPLATES - ${context.replace(/_/g, " ").toUpperCase()}`;

  // ── Fetch templates ────────────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLetterTemplates(context, campusId);
      if (res.success && res.data) {
        setTemplates(res.data);
      }
    } catch {
      // silently ignore; user will see empty dropdown
    } finally {
      setLoading(false);
    }
  }, [context, campusId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Handle template selection ──────────────────────────────────────────────
  const handleSelectTemplate = (id: string) => {
    setSelectedId(id);
    setAction("n/a");
    const template = templates.find((t) => t.id === id);
    if (template) {
      onLoad(template.content);
    }
  };

  // ── Handle action execution ────────────────────────────────────────────────
  const handleActionChange = (value: TemplateAction) => {
    setAction(value);

    if (value === "add") {
      setNewTemplateName("");
      setAddDialogOpen(true);
    } else if (value === "update") {
      handleUpdate();
    } else if (value === "delete") {
      handleDelete();
    }
  };

  const handleSaveNew = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    setSaving(true);
    try {
      const content = getCurrentContent();
      const res = await createLetterTemplate({
        name: newTemplateName.trim(),
        context,
        content,
        campus_id: campusId,
      });
      if (res.success && res.data) {
        toast.success(`Template "${res.data.name}" saved`);
        setTemplates((prev) => [...prev, res.data!]);
        setSelectedId(res.data.id);
        setAddDialogOpen(false);
        setNewTemplateName("");
      } else {
        toast.error(res.error || "Failed to save template");
      }
    } finally {
      setSaving(false);
      setAction("n/a");
    }
  };

  const handleUpdate = async () => {
    if (!selectedId) {
      toast.error("Please select a template to update");
      setAction("n/a");
      return;
    }
    setSaving(true);
    try {
      const content = getCurrentContent();
      const res = await updateLetterTemplate(selectedId, {
        content,
        campus_id: campusId,
      });
      if (res.success && res.data) {
        toast.success(`Template "${res.data.name}" updated`);
        setTemplates((prev) =>
          prev.map((t) => (t.id === selectedId ? res.data! : t))
        );
      } else {
        toast.error(res.error || "Failed to update template");
      }
    } finally {
      setSaving(false);
      setAction("n/a");
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {
      toast.error("Please select a template to delete");
      setAction("n/a");
      return;
    }
    const template = templates.find((t) => t.id === selectedId);
    if (!window.confirm(`Delete template "${template?.name}"? This cannot be undone.`)) {
      setAction("n/a");
      return;
    }
    setSaving(true);
    try {
      const res = await deleteLetterTemplate(selectedId, campusId);
      if (res.success) {
        toast.success("Template deleted");
        setTemplates((prev) => prev.filter((t) => t.id !== selectedId));
        setSelectedId("");
      } else {
        toast.error(res.error || "Failed to delete template");
      }
    } finally {
      setSaving(false);
      setAction("n/a");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="border rounded-lg p-4 space-y-3">
        {/* Section header */}
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          <FileText className="h-4 w-4" />
          {sectionLabel}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Template dropdown */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Template</Label>
            <Select
              value={selectedId}
              onValueChange={handleSelectTemplate}
              disabled={loading || saving}
            >
              <SelectTrigger>
                {loading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading…
                  </span>
                ) : (
                  <SelectValue placeholder="— Select a template —" />
                )}
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                    No templates saved yet
                  </div>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.is_global && (
                        <span className="ml-1 text-xs text-muted-foreground">(global)</span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Action dropdown */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Action</Label>
            <Select
              value={action}
              onValueChange={(v) => handleActionChange(v as TemplateAction)}
              disabled={saving}
            >
              <SelectTrigger>
                {saving ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving…
                  </span>
                ) : (
                  <SelectValue />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="n/a">N/A</SelectItem>
                <SelectItem value="add">Add New Template</SelectItem>
                <SelectItem value="update" disabled={!selectedId}>
                  Update Selected Template
                </SelectItem>
                <SelectItem value="delete" disabled={!selectedId}>
                  Delete Selected Template
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Dialog: Name new template */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as New Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g. Welcome Letter"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveNew()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setAction("n/a");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNew} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
