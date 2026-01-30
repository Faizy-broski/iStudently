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
import { Switch } from '@/components/ui/switch';
import {
  Save,
  Eye,
  Plus,
  Trash2,
  GripVertical,
  Type,
  Image as ImageIcon,
  QrCode,
  Palette,
  Layout,
} from 'lucide-react';
import {
  createTemplate,
  updateTemplate,
  getTemplateById,
  previewTemplate,
  getAvailableTokens,
  TemplateConfig,
  TemplateField,
} from '@/lib/api/id-card-template';
import { toast } from 'sonner';
import Image from 'next/image';
import QRCode from 'react-qr-code';

interface DraggableField {
  id: string;
  label: string;
  token: string;
  type: 'text' | 'image';
  position: { x: number; y: number };
  size: { width: number; height: number };
  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    align?: string;
  };
}

export default function TemplateBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userType = (searchParams?.get('type') || 'student') as 'student' | 'teacher' | 'staff';
  const editId = searchParams?.get('edit');

  // Template metadata
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  // Layout settings
  const [layout, setLayout] = useState({
    width: 300,
    height: 480,
    orientation: 'portrait' as 'portrait' | 'landscape',
  });

  // Design settings
  const [design, setDesign] = useState({
    backgroundColor: '#ffffff',
    borderColor: userType === 'student' ? '#3b82f6' : userType === 'teacher' ? '#10b981' : '#f59e0b',
    borderWidth: 3,
    borderRadius: 12,
    backgroundImage: '',
  });

  // QR Code settings
  const [qrCode, setQrCode] = useState({
    enabled: true,
    position: { x: 100, y: 420 },
    size: 100,
    data: '{{student_id}}',
  });

  // Fields
  const [fields, setFields] = useState<DraggableField[]>([]);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Load available tokens
  useEffect(() => {
    loadTokens();
    if (editId) {
      loadTemplate(editId);
    } else {
      // Add default fields for new template
      addDefaultFields();
    }
  }, [editId, userType]);

  const loadTokens = async () => {
    try {
      const response = await getAvailableTokens(userType) as { tokens: TemplateField[] };
      // Convert array to Record<string, string>
      const tokensRecord = response.tokens.reduce((acc, field) => {
        acc[field.token] = field.label;
        return acc;
      }, {} as Record<string, string>);
      setAvailableTokens(tokensRecord);
    } catch (error: any) {
      toast.error('Failed to load available fields');
    }
  };

  const loadTemplate = async (id: string) => {
    try {
      const response = await getTemplateById(id) as { template: any };
      const template = response.template;
      
      setTemplateName(template.name);
      setTemplateDescription(template.description || '');
      setLayout(template.template_config.layout);
      setDesign(template.template_config.design);
      setFields(template.template_config.fields);
      
      if (template.template_config.qrCode) {
        setQrCode(template.template_config.qrCode);
      }
    } catch (error: any) {
      toast.error('Failed to load template');
    }
  };

  const addDefaultFields = () => {
    const defaults: DraggableField[] = [
      {
        id: 'campus_header',
        label: 'Campus Name',
        token: '{{campus_name}}',
        type: 'text',
        position: { x: 20, y: 20 },
        size: { width: 260, height: 25 },
        style: { fontSize: 16, fontWeight: 'bold', color: design.borderColor, align: 'center' },
      },
      {
        id: 'name',
        label: 'Full Name',
        token: '{{first_name}} {{last_name}}',
        type: 'text',
        position: { x: 20, y: 180 },
        size: { width: 260, height: 30 },
        style: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', align: 'center' },
      },
      {
        id: 'photo',
        label: 'Profile Photo',
        token: '{{photo_url}}',
        type: 'image',
        position: { x: 90, y: 60 },
        size: { width: 120, height: 120 },
      },
    ];
    setFields(defaults);
  };

  const addField = () => {
    const newField: DraggableField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      token: '{{first_name}}',
      type: 'text',
      position: { x: 20, y: 220 },
      size: { width: 260, height: 20 },
      style: { fontSize: 14, fontWeight: 'normal', color: '#4b5563', align: 'left' },
    };
    setFields([...fields, newField]);
    setSelectedField(newField.id);
  };

  const updateField = (id: string, updates: Partial<DraggableField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    const field = fields.find(f => f.id === fieldId);
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
    const x = Math.max(0, Math.min(layout.width - 50, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(layout.height - 20, e.clientY - rect.top - dragOffset.y));

    updateField(selectedField, { position: { x: Math.round(x), y: Math.round(y) } });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handlePreview = async () => {
    try {
      const config: TemplateConfig = {
        fields,
        layout,
        design,
        qrCode,
      };

      const response = await previewTemplate({
        template_config: config,
        user_type: userType,
      });

      setPreviewData(response.sample_data);
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
      const config: TemplateConfig = {
        fields,
        layout,
        design,
        qrCode,
      };

      if (editId) {
        await updateTemplate(editId, {
          name: templateName,
          description: templateDescription,
          template_config: config,
        });
        toast.success('Template updated successfully');
      } else {
        await createTemplate({
          name: templateName,
          description: templateDescription,
          user_type: userType,
          template_config: config,
        });
        toast.success('Template created successfully');
      }

      router.push('/admin/id-card-templates');
    } catch (error: any) {
      toast.error('Save failed: ' + error.message);
    }
  };

  const selectedFieldData = fields.find(f => f.id === selectedField);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ID Card Template Builder</h1>
          <p className="text-muted-foreground mt-1">
            Design a custom {userType} ID card template
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
          {/* Template Info */}
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
                  placeholder="e.g., Blue Student Card"
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
                <Label>User Type</Label>
                <Input value={userType} disabled className="capitalize" />
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Settings */}
          <Tabs defaultValue="fields" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="qr">QR Code</TabsTrigger>
            </TabsList>

            {/* Fields Tab */}
            <TabsContent value="fields" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Fields</CardTitle>
                    <Button size="sm" onClick={addField} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Field
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
                        <div className="flex items-center gap-2">
                          {field.type === 'image' ? (
                            <ImageIcon className="h-4 w-4" />
                          ) : (
                            <Type className="h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">{field.label}</span>
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
                            onChange={(e) =>
                              updateField(selectedField!, { label: e.target.value })
                            }
                          />
                        </div>

                        <div>
                          <Label>Token/Field</Label>
                          <Select
                            value={selectedFieldData.token}
                            onValueChange={(v) => updateField(selectedField!, { token: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(availableTokens).map(([token, label]) => (
                                <SelectItem key={token} value={token}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Type</Label>
                          <Select
                            value={selectedFieldData.type}
                            onValueChange={(v: 'text' | 'image') =>
                              updateField(selectedField!, { type: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="image">Image</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Width</Label>
                            <Input
                              type="number"
                              value={selectedFieldData.size.width}
                              onChange={(e) =>
                                updateField(selectedField!, {
                                  size: { ...selectedFieldData.size, width: +e.target.value },
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Height</Label>
                            <Input
                              type="number"
                              value={selectedFieldData.size.height}
                              onChange={(e) =>
                                updateField(selectedField!, {
                                  size: { ...selectedFieldData.size, height: +e.target.value },
                                })
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
                                  value={selectedFieldData.style?.fontSize || 14}
                                  onChange={(e) =>
                                    updateField(selectedField!, {
                                      style: {
                                        ...selectedFieldData.style,
                                        fontSize: +e.target.value,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Font Weight</Label>
                                <Select
                                  value={selectedFieldData.style?.fontWeight || 'normal'}
                                  onValueChange={(v) =>
                                    updateField(selectedField!, {
                                      style: { ...selectedFieldData.style, fontWeight: v },
                                    })
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
                              <Label>Text Color</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  value={selectedFieldData.style?.color || '#000000'}
                                  onChange={(e) =>
                                    updateField(selectedField!, {
                                      style: { ...selectedFieldData.style, color: e.target.value },
                                    })
                                  }
                                  className="w-16 h-10"
                                />
                                <Input
                                  value={selectedFieldData.style?.color || '#000000'}
                                  onChange={(e) =>
                                    updateField(selectedField!, {
                                      style: { ...selectedFieldData.style, color: e.target.value },
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Text Align</Label>
                              <Select
                                value={selectedFieldData.style?.align || 'left'}
                                onValueChange={(v) =>
                                  updateField(selectedField!, {
                                    style: { ...selectedFieldData.style, align: v },
                                  })
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
                    Card Design
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Width (px)</Label>
                      <Input
                        type="number"
                        value={layout.width}
                        onChange={(e) => setLayout({ ...layout, width: +e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Height (px)</Label>
                      <Input
                        type="number"
                        value={layout.height}
                        onChange={(e) => setLayout({ ...layout, height: +e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Orientation</Label>
                    <Select
                      value={layout.orientation}
                      onValueChange={(v: 'portrait' | 'landscape') =>
                        setLayout({ ...layout, orientation: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Portrait</SelectItem>
                        <SelectItem value="landscape">Landscape</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Background Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={design.backgroundColor}
                        onChange={(e) =>
                          setDesign({ ...design, backgroundColor: e.target.value })
                        }
                        className="w-16 h-10"
                      />
                      <Input
                        value={design.backgroundColor}
                        onChange={(e) =>
                          setDesign({ ...design, backgroundColor: e.target.value })
                        }
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

                  <div>
                    <Label>Background Image URL (optional)</Label>
                    <Input
                      value={design.backgroundImage}
                      onChange={(e) => setDesign({ ...design, backgroundImage: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* QR Code Tab */}
            <TabsContent value="qr" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    QR Code Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Enable QR Code</Label>
                    <Switch
                      checked={qrCode.enabled}
                      onCheckedChange={(checked) =>
                        setQrCode({ ...qrCode, enabled: checked })
                      }
                    />
                  </div>

                  {qrCode.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>X Position</Label>
                          <Input
                            type="number"
                            value={qrCode.position.x}
                            onChange={(e) =>
                              setQrCode({
                                ...qrCode,
                                position: { ...qrCode.position, x: +e.target.value },
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Y Position</Label>
                          <Input
                            type="number"
                            value={qrCode.position.y}
                            onChange={(e) =>
                              setQrCode({
                                ...qrCode,
                                position: { ...qrCode.position, y: +e.target.value },
                              })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Size (px)</Label>
                        <Input
                          type="number"
                          value={qrCode.size}
                          onChange={(e) => setQrCode({ ...qrCode, size: +e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>QR Code Data (use tokens)</Label>
                        <Input
                          value={qrCode.data}
                          onChange={(e) => setQrCode({ ...qrCode, data: e.target.value })}
                          placeholder="{{student_id}}"
                        />
                      </div>
                    </>
                  )}
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
                Live Preview
                <span className="text-sm text-muted-foreground font-normal ml-auto">
                  Drag fields to position them
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center items-center min-h-[600px] bg-gray-50">
              <div
                ref={canvasRef}
                className="relative shadow-2xl cursor-crosshair"
                style={{
                  width: `${layout.width}px`,
                  height: `${layout.height}px`,
                  backgroundColor: design.backgroundColor,
                  borderColor: design.borderColor,
                  borderWidth: `${design.borderWidth}px`,
                  borderStyle: 'solid',
                  borderRadius: `${design.borderRadius}px`,
                  backgroundImage: design.backgroundImage
                    ? `url(${design.backgroundImage})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Render fields */}
                {fields.map((field) => {
                  const isSelected = selectedField === field.id;
                  const displayValue = previewData?.[field.token.replace(/[{}]/g, '')] || field.token;

                  if (field.type === 'image') {
                    return (
                      <div
                        key={field.id}
                        className={`absolute cursor-move border-2 ${
                          isSelected ? 'border-blue-500' : 'border-transparent'
                        }`}
                        style={{
                          left: `${field.position.x}px`,
                          top: `${field.position.y}px`,
                          width: `${field.size.width}px`,
                          height: `${field.size.height}px`,
                        }}
                        onMouseDown={(e) => handleMouseDown(e, field.id)}
                      >
                        {displayValue && displayValue.startsWith('http') ? (
                          <Image
                            src={displayValue}
                            alt={field.label}
                            width={field.size.width}
                            height={field.size.height}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 rounded flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        {isSelected && (
                          <GripVertical className="absolute -top-2 -right-2 h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={field.id}
                      className={`absolute cursor-move border-2 ${
                        isSelected ? 'border-blue-500' : 'border-transparent'
                      }`}
                      style={{
                        left: `${field.position.x}px`,
                        top: `${field.position.y}px`,
                        width: `${field.size.width}px`,
                        height: `${field.size.height}px`,
                        fontSize: field.style?.fontSize ? `${field.style.fontSize}px` : '14px',
                        fontWeight: field.style?.fontWeight || 'normal',
                        color: field.style?.color || '#000000',
                        textAlign: (field.style?.align as any) || 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent:
                          field.style?.align === 'center'
                            ? 'center'
                            : field.style?.align === 'right'
                            ? 'flex-end'
                            : 'flex-start',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, field.id)}
                    >
                      {displayValue}
                      {isSelected && (
                        <GripVertical className="absolute -top-2 -right-2 h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  );
                })}

                {/* QR Code */}
                {qrCode.enabled && (
                  <div
                    className="absolute"
                    style={{
                      left: `${qrCode.position.x}px`,
                      top: `${qrCode.position.y}px`,
                    }}
                  >
                    <QRCode
                      value={previewData ? qrCode.data : 'SAMPLE-QR-CODE'}
                      size={qrCode.size}
                      level="M"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
