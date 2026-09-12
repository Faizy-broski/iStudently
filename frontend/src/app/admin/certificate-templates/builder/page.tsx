'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Save,
  Eye,
  Plus,
  Trash2,
  Type,
  Image as ImageIcon,
  Palette,
  Layout,
  Search,
  UserSquare2,
  Building2,
  Table2,
} from 'lucide-react';
import {
  createTemplate,
  updateTemplate,
  getTemplateById,
  previewTemplate,
  getAvailableTokens,
  CertificateTemplateConfig,
  CertificateTemplateField,
  CertificateTemplateTableConfig,
  CertificateRecipientType,
} from '@/lib/api/certificate-template';
import { CertificateCanvasRenderer } from '@/components/shared/CertificateCanvasRenderer';
import { ImageDropzone } from '@/components/shared/ImageDropzone';
import { FontFamilySelect } from '@/components/shared/FontFamilySelect';
import { useLoadDesignFonts } from '@/config/design-fonts';
import { CERTIFICATE_RECIPIENT_TYPES } from '@/config/certificateRecipientTypes';
import { useCampus } from '@/context/CampusContext';
import { toast } from 'sonner';

interface AvailableToken {
  token: string;
  label: string;
}

const OCCASION_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'appreciation', label: 'Appreciation' },
  { value: 'completion', label: 'Completion' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'employee_of_month', label: 'Employee of the Month' },
  { value: 'sports_day', label: 'Sports Day' },
  { value: 'custom', label: 'Custom' },
];

// A4 @96dpi
const A4 = { portrait: { width: 794, height: 1123 }, landscape: { width: 1123, height: 794 } };

export default function CertificateTemplateBuilderPage() {
  useLoadDesignFonts();
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipientType = (searchParams?.get('type') || 'student') as CertificateRecipientType;
  const editId = searchParams?.get('edit');

  // Read the real school logo from the campus context (same source as the sidebar logo)
  const campusCtx = useCampus();
  const schoolLogo = campusCtx?.selectedCampus?.logo_url ?? '';
  const schoolName = campusCtx?.selectedCampus?.name ?? '';

  // Template metadata
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateOccasion, setTemplateOccasion] = useState('general');

  // Layout — defaults to A4 landscape (the conventional certificate orientation)
  const [layout, setLayout] = useState({ ...A4.landscape, orientation: 'landscape' as 'portrait' | 'landscape' });

  const [design, setDesign] = useState({
    backgroundColor: '#ffffff',
    borderColor: '#d97706',
    borderWidth: 6,
    borderRadius: 4,
    backgroundImage: '',
  });

  const [fields, setFields] = useState<CertificateTemplateField[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<AvailableToken[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, any> | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');

  const canvasRef = useRef<HTMLDivElement>(null);

  // Keep the live preview canvas showing the real school logo (same as sidebar) at all times.
  // This runs on mount and whenever the campus logo changes, merging the school_logo into
  // whatever previewData is already set (e.g. after a backend Preview fetch).
  useEffect(() => {
    setPreviewData((prev) => ({
      ...(prev || {}),
      school_logo: schoolLogo,
      school_name: schoolName,
      campus_name: schoolName,
    }));
  }, [schoolLogo, schoolName]);

  useEffect(() => {
    loadTokens();
    if (editId) {
      loadTemplate(editId);
    } else {
      addDefaultFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, recipientType]);

  const loadTokens = async () => {
    try {
      const response = await getAvailableTokens(recipientType);
      setAvailableTokens(response.tokens);
    } catch (error: any) {
      toast.error('Failed to load available fields');
    }
  };

  const loadTemplate = async (id: string) => {
    try {
      const response = await getTemplateById(id);
      const template = response.template;

      setTemplateName(template.name);
      setTemplateDescription(template.description || '');
      setTemplateOccasion(template.occasion || 'general');
      setLayout(template.template_config.layout as any);
      setDesign(template.template_config.design as any);
      setFields(template.template_config.fields);
    } catch (error: any) {
      toast.error('Failed to load template');
    }
  };

  const addDefaultFields = () => {
    const defaults: CertificateTemplateField[] = [
      {
        id: 'title',
        label: 'Title',
        token: 'Certificate of Achievement',
        type: 'text',
        position: { x: 161, y: 150 },
        size: { width: 800, height: 50 },
        style: { fontSize: 36, fontWeight: 'bold', color: design.borderColor, align: 'center' },
      },
      {
        id: 'name',
        label: 'Recipient Name',
        token: '{{first_name}} {{last_name}}',
        type: 'text',
        position: { x: 161, y: 260 },
        size: { width: 800, height: 55 },
        style: { fontSize: 40, fontWeight: 'bold', color: '#1f2937', align: 'center' },
      },
      {
        id: 'logo',
        label: 'School Logo',
        token: '{{school_logo}}',
        type: 'image',
        position: { x: 481, y: 50 },
        size: { width: 80, height: 80 },
      },
    ];
    setFields(defaults);
  };

  const openFieldSelector = () => {
    setFieldSearchQuery('');
    setShowFieldSelector(true);
  };

  const addFieldFromToken = (token: AvailableToken) => {
    const isImage = token.token.includes('photo') || token.token.includes('logo') || token.token.includes('image');
    const newField: CertificateTemplateField = {
      id: `field_${Date.now()}`,
      label: token.label,
      token: token.token,
      type: isImage ? 'image' : 'text',
      position: { x: 40, y: 100 + fields.length * 30 },
      size: isImage ? { width: 100, height: 100 } : { width: 300, height: 24 },
      style: isImage ? undefined : { fontSize: 16, fontWeight: 'normal', color: '#374151', align: 'left' },
    };
    setFields([...fields, newField]);
    setSelectedField(newField.id);
    setShowFieldSelector(false);
  };

  const addQuickField = (kind: 'logo' | 'photo') => {
    const isLogo = kind === 'logo';
    const newField: CertificateTemplateField = {
      id: `field_${Date.now()}`,
      label: isLogo ? 'School Logo' : 'Recipient Photo',
      token: isLogo ? '{{school_logo}}' : '{{photo_url}}',
      type: 'image',
      position: { x: isLogo ? (layout.width - 80) / 2 : 40, y: 40 },
      size: { width: isLogo ? 80 : 120, height: isLogo ? 80 : 120 },
    };
    setFields([...fields, newField]);
    setSelectedField(newField.id);
  };

  // Free text box — the "Text/Token(s)" field already accepts plain typed text with no
  // tokens at all, but there was no one-click way to drop a blank one onto the canvas the
  // way there is for Logo/Photo.
  const addTextField = () => {
    const newField: CertificateTemplateField = {
      id: `field_${Date.now()}`,
      label: 'Text',
      token: 'Double-click to edit this text',
      type: 'text',
      position: { x: 40, y: 100 + fields.length * 10 },
      size: { width: 300, height: 30 },
      style: { fontSize: 16, fontWeight: 'normal', color: '#374151', align: 'left' },
    };
    setFields([...fields, newField]);
    setSelectedField(newField.id);
  };

  const addTableField = () => {
    const newField: CertificateTemplateField = {
      id: `field_${Date.now()}`,
      label: 'Table',
      token: '',
      type: 'table',
      position: { x: 40, y: 100 + fields.length * 10 },
      size: { width: 400, height: 120 },
      table: {
        columns: [{ id: 'col_1', label: 'Column 1' }, { id: 'col_2', label: 'Column 2' }],
        rows: [
          ['', ''],
          ['', ''],
        ],
        showHeader: true,
        dataSource: 'manual',
        headerBg: '#f3f4f6',
        fontSize: 12,
      },
    };
    setFields([...fields, newField]);
    setSelectedField(newField.id);
  };

  // ── Table field editing helpers ─────────────────────────────────────────
  const updateTable = (updates: Partial<CertificateTemplateTableConfig>) => {
    if (!selectedField) return;
    const current = fields.find((f) => f.id === selectedField)?.table;
    if (!current) return;
    updateField(selectedField, { table: { ...current, ...updates } });
  };

  const addTableColumn = () => {
    const table = fields.find((f) => f.id === selectedField)?.table;
    if (!table) return;
    const nextIndex = table.columns.length + 1;
    updateTable({
      columns: [...table.columns, { id: `col_${Date.now()}`, label: `Column ${nextIndex}` }],
      rows: table.rows.map((row) => [...row, '']),
    });
  };

  const removeTableColumn = (colIndex: number) => {
    const table = fields.find((f) => f.id === selectedField)?.table;
    if (!table || table.columns.length <= 1) return;
    updateTable({
      columns: table.columns.filter((_, i) => i !== colIndex),
      rows: table.rows.map((row) => row.filter((_, i) => i !== colIndex)),
    });
  };

  const addTableRow = () => {
    const table = fields.find((f) => f.id === selectedField)?.table;
    if (!table) return;
    updateTable({ rows: [...table.rows, table.columns.map(() => '')] });
  };

  const removeTableRow = (rowIndex: number) => {
    const table = fields.find((f) => f.id === selectedField)?.table;
    if (!table || table.rows.length <= 1) return;
    updateTable({ rows: table.rows.filter((_, i) => i !== rowIndex) });
  };

  const filteredTokens = availableTokens.filter(
    (token) =>
      token.label.toLowerCase().includes(fieldSearchQuery.toLowerCase()) ||
      token.token.toLowerCase().includes(fieldSearchQuery.toLowerCase())
  );

  const updateField = (id: string, updates: Partial<CertificateTemplateField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const deleteField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - field.position.x;
    const offsetY = e.clientY - rect.top - field.position.y;

    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
    setSelectedField(fieldId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedField) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(layout.width - 20, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(layout.height - 20, e.clientY - rect.top - dragOffset.y));

    updateField(selectedField, { position: { x: Math.round(x), y: Math.round(y) } });
  };

  const handleMouseUp = () => setIsDragging(false);

  const toggleOrientation = (orientation: 'portrait' | 'landscape') => {
    const nextDims = A4[orientation];
    // Portrait/landscape are transposed (794x1123 vs 1123x794), so a bare
    // dimension swap leaves every field's x/y/width/height sized for the old
    // canvas — anything placed toward the right edge in landscape (including
    // the default title/name fields) ends up clipped off a narrower portrait
    // canvas. Rescale each field proportionally so the layout stays intact.
    const scaleX = nextDims.width / layout.width;
    const scaleY = nextDims.height / layout.height;
    setFields((prev) =>
      prev.map((f) => ({
        ...f,
        position: { x: Math.round(f.position.x * scaleX), y: Math.round(f.position.y * scaleY) },
        size: { width: Math.round(f.size.width * scaleX), height: Math.round(f.size.height * scaleY) },
      }))
    );
    setLayout({ ...nextDims, orientation });
  };

  const handlePreview = async () => {
    try {
      const config: CertificateTemplateConfig = { fields, layout, design };
      const response = await previewTemplate({ template_config: config, recipient_type: recipientType });
      // Always prefer the sidebar's real campus logo over whatever the backend sample sends,
      // so the preview matches what will actually appear on the printed certificate.
      setPreviewData({
        ...response.sample_data,
        ...(schoolLogo ? { school_logo: schoolLogo } : {}),
        ...(schoolName ? { school_name: schoolName, campus_name: schoolName } : {}),
      });
      toast.success('Preview updated with sample data');
    } catch (error: any) {
      toast.error('Preview failed: ' + error.message);
    }
  };

  const handleSave = async () => {
    if (!templateName) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      const config: CertificateTemplateConfig = { fields, layout, design };

      if (editId) {
        await updateTemplate(editId, {
          name: templateName,
          description: templateDescription,
          occasion: templateOccasion,
          template_config: config,
        });
        toast.success('Template updated successfully');
      } else {
        await createTemplate({
          name: templateName,
          description: templateDescription,
          recipient_type: recipientType,
          occasion: templateOccasion,
          template_config: config,
        });
        toast.success('Template created successfully');
      }

      router.push('/admin/certificate-templates');
    } catch (error: any) {
      toast.error('Save failed: ' + error.message);
    }
  };

  const selectedFieldData = fields.find((f) => f.id === selectedField);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Certificate Template Builder</h1>
          <p className="text-muted-foreground mt-1">
            Design a custom {recipientType} certificate — drag fields, upload images, and save as a reusable template
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handlePreview} className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Settings */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Template Name*</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Gold Achievement Certificate"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div>
                <Label>Occasion</Label>
                <Select value={templateOccasion} onValueChange={setTemplateOccasion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCASION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recipient Type</Label>
                {editId ? (
                  // Immutable once a template exists — updateTemplate never accepts a
                  // recipient_type change (the tokens already chosen would stop matching).
                  <Input
                    value={CERTIFICATE_RECIPIENT_TYPES.find((t) => t.value === recipientType)?.label || recipientType}
                    disabled
                  />
                ) : (
                  <Select
                    value={recipientType}
                    onValueChange={(v) => router.replace(`/admin/certificate-templates/builder?type=${v}`)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CERTIFICATE_RECIPIENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="fields" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
            </TabsList>

            {/* Fields Tab */}
            <TabsContent value="fields" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Fields</CardTitle>
                    <Button size="sm" onClick={openFieldSelector} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Field
                    </Button>
                  </div>
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => addQuickField('logo')}>
                      <Building2 className="h-3.5 w-3.5" />
                      Add Logo
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={() => addQuickField('photo')}>
                      <UserSquare2 className="h-3.5 w-3.5" />
                      Add Photo
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={addTextField}>
                      <Type className="h-3.5 w-3.5" />
                      Add Text
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" onClick={addTableField}>
                      <Table2 className="h-3.5 w-3.5" />
                      Add Table
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className={`p-3 rounded border cursor-pointer hover:bg-accent ${
                        selectedField === field.id ? 'border-primary bg-accent' : ''
                      }`}
                      onClick={() => setSelectedField(field.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {field.type === 'image' ? (
                            <ImageIcon className="h-4 w-4 shrink-0" />
                          ) : field.type === 'table' ? (
                            <Table2 className="h-4 w-4 shrink-0" />
                          ) : (
                            <Type className="h-4 w-4 shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">{field.label}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(field.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {selectedFieldData && (
                    <Card className="mt-4">
                      <CardHeader>
                        <CardTitle className="text-sm">Edit Field</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label>Label</Label>
                          <Input
                            value={selectedFieldData.label}
                            onChange={(e) => updateField(selectedField!, { label: e.target.value })}
                          />
                        </div>

                        <div>
                          <Label>Type</Label>
                          {selectedFieldData.type === 'table' ? (
                            // Tables are a distinct shape (columns/rows, not a token) — created
                            // via the "Add Table" quick action rather than switched into here.
                            <Input value="Table" disabled />
                          ) : (
                            <Select
                              value={selectedFieldData.type}
                              onValueChange={(v: 'text' | 'image') => updateField(selectedField!, { type: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="image">Image</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {selectedFieldData.type === 'table' ? (
                          <div className="space-y-3">
                            <div>
                              <Label>Data Source</Label>
                              <Select
                                value={selectedFieldData.table?.dataSource || 'manual'}
                                onValueChange={(v: 'manual' | 'student_grades') => updateTable({ dataSource: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manual">Manual (type it yourself)</SelectItem>
                                  <SelectItem value="student_grades" disabled={recipientType !== 'student'}>
                                    Auto: Subjects &amp; Grades{recipientType !== 'student' ? ' (students only)' : ''}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedFieldData.table?.showHeader ?? true}
                                onCheckedChange={(v) => updateTable({ showHeader: !!v })}
                              />
                              <Label className="!mt-0">Show header row</Label>
                            </div>

                            {selectedFieldData.table?.dataSource === 'student_grades' ? (
                              <p className="text-xs text-muted-foreground">
                                This table fills in automatically with each student&apos;s subjects and grades for
                                the current term when certificates are generated — nothing to type here.
                              </p>
                            ) : (
                              <>
                                <div className="space-y-1.5">
                                  <Label>Columns</Label>
                                  {selectedFieldData.table?.columns.map((col, ci) => (
                                    <div key={col.id} className="flex gap-2">
                                      <Input
                                        value={col.label}
                                        onChange={(e) => {
                                          const columns = selectedFieldData.table!.columns.map((c, i) =>
                                            i === ci ? { ...c, label: e.target.value } : c
                                          );
                                          updateTable({ columns });
                                        }}
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={selectedFieldData.table!.columns.length <= 1}
                                        onClick={() => removeTableColumn(ci)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="outline" className="gap-1.5" onClick={addTableColumn}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Column
                                  </Button>
                                </div>

                                <div className="space-y-1.5">
                                  <Label>Rows</Label>
                                  {selectedFieldData.table?.rows.map((row, ri) => (
                                    <div key={ri} className="flex gap-2">
                                      {row.map((cell, ci) => (
                                        <Input
                                          key={ci}
                                          value={cell}
                                          placeholder={selectedFieldData.table!.columns[ci]?.label}
                                          onChange={(e) => {
                                            const rows = selectedFieldData.table!.rows.map((r, i) =>
                                              i === ri ? r.map((c, j) => (j === ci ? e.target.value : c)) : r
                                            );
                                            updateTable({ rows });
                                          }}
                                        />
                                      ))}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={selectedFieldData.table!.rows.length <= 1}
                                        onClick={() => removeTableRow(ri)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button size="sm" variant="outline" className="gap-1.5" onClick={addTableRow}>
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Row
                                  </Button>
                                  <p className="text-xs text-muted-foreground">
                                    Cells can include tokens too, e.g. {'{{first_name}}'}
                                  </p>
                                </div>
                              </>
                            )}

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label>Font Size</Label>
                                <Input
                                  type="number"
                                  value={selectedFieldData.table?.fontSize ?? 12}
                                  onChange={(e) => updateTable({ fontSize: +e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>Header Color</Label>
                                <Input
                                  type="color"
                                  value={selectedFieldData.table?.headerBg || '#f3f4f6'}
                                  onChange={(e) => updateTable({ headerBg: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        ) : selectedFieldData.type === 'text' ? (
                          <div>
                            <Label>Text / Token(s)</Label>
                            <Textarea
                              value={selectedFieldData.token}
                              onChange={(e) => updateField(selectedField!, { token: e.target.value })}
                              placeholder="Type text and/or insert tokens like {{first_name}}"
                              rows={3}
                            />
                            <Select
                              value=""
                              onValueChange={(v) =>
                                updateField(selectedField!, { token: `${selectedFieldData.token}${v}` })
                              }
                            >
                              <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Insert a token…" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {availableTokens.map((token) => (
                                  <SelectItem key={token.token} value={token.token}>
                                    {token.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Image Source</Label>
                            <Select
                              value={selectedFieldData.token.match(/^\{\{.*\}\}$/) ? selectedFieldData.token : '__upload__'}
                              onValueChange={(v) => {
                                if (v === '__upload__') return;
                                updateField(selectedField!, { token: v });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Bind to a token, or upload a fixed image below" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectItem value="__upload__">Fixed uploaded image</SelectItem>
                                {availableTokens
                                  .filter((t) => t.token.includes('photo') || t.token.includes('logo'))
                                  .map((token) => (
                                    <SelectItem key={token.token} value={token.token}>
                                      {token.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            {!selectedFieldData.token.match(/^\{\{.*\}\}$/) && (
                              <ImageDropzone
                                value={selectedFieldData.token.startsWith('http') || selectedFieldData.token.startsWith('data:') ? selectedFieldData.token : ''}
                                onChange={(url) => updateField(selectedField!, { token: url })}
                                aspectRatio="1/1"
                                hint="e.g. a seal or signature graphic"
                              />
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Width</Label>
                            <Input
                              type="number"
                              value={selectedFieldData.size.width}
                              onChange={(e) =>
                                updateField(selectedField!, { size: { ...selectedFieldData.size, width: +e.target.value } })
                              }
                            />
                          </div>
                          <div>
                            <Label>Height</Label>
                            <Input
                              type="number"
                              value={selectedFieldData.size.height}
                              onChange={(e) =>
                                updateField(selectedField!, { size: { ...selectedFieldData.size, height: +e.target.value } })
                              }
                            />
                          </div>
                        </div>

                        {selectedFieldData.type === 'text' && (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label>Font Size</Label>
                                <Input
                                  type="number"
                                  value={selectedFieldData.style?.fontSize || 16}
                                  onChange={(e) =>
                                    updateField(selectedField!, {
                                      style: { ...selectedFieldData.style, fontSize: +e.target.value },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Font Weight</Label>
                                <Select
                                  value={selectedFieldData.style?.fontWeight || 'normal'}
                                  onValueChange={(v) =>
                                    updateField(selectedField!, { style: { ...selectedFieldData.style, fontWeight: v } })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="bold">Bold</SelectItem>
                                    <SelectItem value="lighter">Light</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div>
                              <Label>Font Family</Label>
                              <FontFamilySelect
                                value={selectedFieldData.style?.fontFamily}
                                onValueChange={(v) =>
                                  updateField(selectedField!, {
                                    style: {
                                      ...selectedFieldData.style,
                                      fontFamily: v === 'default' ? undefined : v,
                                    },
                                  })
                                }
                              />
                            </div>

                            <div>
                              <Label>Text Color</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  value={selectedFieldData.style?.color || '#000000'}
                                  onChange={(e) =>
                                    updateField(selectedField!, { style: { ...selectedFieldData.style, color: e.target.value } })
                                  }
                                  className="w-16 h-10"
                                />
                                <Input
                                  value={selectedFieldData.style?.color || '#000000'}
                                  onChange={(e) =>
                                    updateField(selectedField!, { style: { ...selectedFieldData.style, color: e.target.value } })
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Text Align</Label>
                              <Select
                                value={selectedFieldData.style?.align || 'left'}
                                onValueChange={(v) =>
                                  updateField(selectedField!, { style: { ...selectedFieldData.style, align: v } })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="left">Left</SelectItem>
                                  <SelectItem value="center">Center</SelectItem>
                                  <SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Design Tab */}
            <TabsContent value="design" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Certificate Design
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Paper Size &amp; Orientation</Label>
                    <Select value={layout.orientation} onValueChange={(v: 'portrait' | 'landscape') => toggleOrientation(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landscape">A4 Landscape</SelectItem>
                        <SelectItem value="portrait">A4 Portrait</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={design.backgroundColor}
                        onChange={(e) => setDesign({ ...design, backgroundColor: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        value={design.backgroundColor}
                        onChange={(e) => setDesign({ ...design, backgroundColor: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Border Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={design.borderColor}
                        onChange={(e) => setDesign({ ...design, borderColor: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        value={design.borderColor}
                        onChange={(e) => setDesign({ ...design, borderColor: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Border Width (px)</Label>
                      <Input
                        type="number"
                        value={design.borderWidth}
                        onChange={(e) => setDesign({ ...design, borderWidth: +e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Border Radius (px)</Label>
                      <Input
                        type="number"
                        value={design.borderRadius}
                        onChange={(e) => setDesign({ ...design, borderRadius: +e.target.value })}
                      />
                    </div>
                  </div>

                  <ImageDropzone
                    label="Background Image (optional, full-bleed)"
                    value={design.backgroundImage}
                    onChange={(url) => setDesign({ ...design, backgroundImage: url })}
                    aspectRatio={layout.orientation === 'landscape' ? '1123/794' : '794/1123'}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Canvas Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Live Preview — A4 {layout.orientation}
                <span className="text-sm text-muted-foreground font-normal ml-auto">
                  Drag fields to position them
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-h-[600px] bg-gray-50 dark:bg-slate-900 overflow-auto p-8">
              {/* Rendered at 1:1 scale (not CSS-scaled) so the drag math in handleMouseMove,
                  which reads unscaled layout.width/height, lines up with the mouse position.
                  Plain block + margin:auto (not flex justify-center) so that when the canvas is
                  wider than the panel, auto-margins collapse to 0 and it scrolls fully into view
                  instead of a flex-centered item silently clipping the overflow on one side. */}
              <div style={{ width: layout.width, margin: '0 auto' }}>
                <CertificateCanvasRenderer
                  layout={layout}
                  design={design}
                  fields={fields}
                  data={previewData || undefined}
                  selectedFieldId={selectedField}
                  interactive
                  canvasRef={canvasRef}
                  onFieldMouseDown={handleMouseDown}
                  onCanvasMouseMove={handleMouseMove}
                  onCanvasMouseUp={handleMouseUp}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Field Selector Dialog */}
      <Dialog open={showFieldSelector} onOpenChange={setShowFieldSelector}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select a Field to Add</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search fields..."
                value={fieldSearchQuery}
                onChange={(e) => setFieldSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-1">
                {filteredTokens.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No fields found</p>
                ) : (
                  filteredTokens.map((token) => (
                    <button
                      key={token.token}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
                      onClick={() => addFieldFromToken(token)}
                    >
                      {token.token.includes('photo') || token.token.includes('logo') || token.token.includes('image') ? (
                        <ImageIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      ) : (
                        <Type className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{token.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{token.token}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground text-center">{availableTokens.length} fields available</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
