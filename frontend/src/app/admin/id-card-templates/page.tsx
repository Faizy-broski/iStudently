'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  CreditCard,
  UserCircle,
  Users,
} from 'lucide-react';
import {
  getTemplates,
  deleteTemplate,
  setActiveTemplate,
  IdCardTemplate,
} from '@/lib/api/id-card-template';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function IdCardTemplatesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'staff'>('student');
  const [templates, setTemplates] = useState<IdCardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, [activeTab]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await getTemplates(activeTab);
      setTemplates(response.templates || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await setActiveTemplate(id);
      toast.success('Template activated successfully');
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.message || 'Failed to activate template');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteTemplate(deleteId);
      toast.success('Template deleted successfully');
      setDeleteId(null);
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const getUserTypeIcon = (type: string) => {
    switch (type) {
      case 'student':
        return <UserCircle className="h-5 w-5" />;
      case 'teacher':
        return <Users className="h-5 w-5" />;
      case 'staff':
        return <CreditCard className="h-5 w-5" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const filteredTemplates = templates.filter((t) => t.user_type === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ID Card Templates</h1>
          <p className="text-muted-foreground mt-1">
            Design customizable ID cards for students, teachers, and staff
          </p>
        </div>
        <Button
          onClick={() => router.push(`/admin/id-card-templates/builder?type=${activeTab}`)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Build New Template
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="student" className="gap-2">
            <UserCircle className="h-4 w-4" />
            Students
          </TabsTrigger>
          <TabsTrigger value="teacher" className="gap-2">
            <Users className="h-4 w-4" />
            Teachers
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Staff
          </TabsTrigger>
        </TabsList>

        {/* Content for all tabs */}
        {(['student', 'teacher', 'staff'] as const).map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-4">Loading templates...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    {getUserTypeIcon(type)}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first {type} ID card template to get started
                  </p>
                  <Button
                    onClick={() =>
                      router.push(`/admin/id-card-templates/builder?type=${type}`)
                    }
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Build Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <Card key={template.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {template.name}
                            {template.is_active && (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Active
                              </Badge>
                            )}
                          </CardTitle>
                          {template.description && (
                            <CardDescription className="mt-1.5 line-clamp-2">
                              {template.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Template Info */}
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fields:</span>
                          <span className="font-medium">
                            {template.template_config.fields?.length || 0} fields
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Layout:</span>
                          <span className="font-medium capitalize">
                            {template.template_config.layout?.orientation || 'portrait'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">QR Code:</span>
                          <span className="font-medium">
                            {template.template_config.qrCode?.enabled ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>

                      {/* Preview */}
                      <div
                        className="relative rounded-lg border-2 overflow-hidden"
                        style={{
                          aspectRatio: '2/3',
                          borderColor:
                            template.template_config.design?.borderColor || '#3b82f6',
                          backgroundColor:
                            template.template_config.design?.backgroundColor || '#ffffff',
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CreditCard className="h-12 w-12 text-muted-foreground/20" />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() =>
                            router.push(`/admin/id-card-templates/preview/${template.id}`)
                          }
                        >
                          <Eye className="h-4 w-4" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() =>
                            router.push(`/admin/id-card-templates/builder?type=${activeTab}&edit=${template.id}`)
                          }
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        {!template.is_active && (
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => handleActivate(template.id)}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Activate
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          className={template.is_active ? 'flex-1' : 'flex-1'}
                          onClick={() => setDeleteId(template.id)}
                          disabled={template.is_active}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
