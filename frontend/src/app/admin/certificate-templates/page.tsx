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
  Copy,
  Award,
  UserCircle,
  Users,
  Briefcase,
  Tag,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getTemplates,
  deleteTemplate,
  duplicateTemplate,
  CertificateTemplate,
  CertificateRecipientType,
} from '@/lib/api/certificate-template';
import { CertificateCanvasRenderer } from '@/components/shared/CertificateCanvasRenderer';
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

const OCCASION_LABELS: Record<string, string> = {
  general: 'General',
  achievement: 'Achievement',
  appreciation: 'Appreciation',
  completion: 'Completion',
  graduation: 'Graduation',
  employee_of_month: 'Employee of the Month',
  sports_day: 'Sports Day',
  custom: 'Custom',
};

export default function CertificateTemplatesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CertificateRecipientType>('student');
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [occasionFilter, setOccasionFilter] = useState('all');

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTemplate(id);
      toast.success('Template duplicated — edit your copy below');
      fetchTemplates();
    } catch (error: any) {
      toast.error(error.message || 'Failed to duplicate template');
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

  const getRecipientIcon = (type: string) => {
    switch (type) {
      case 'student': return <UserCircle className="h-5 w-5" />;
      case 'teacher': return <Users className="h-5 w-5" />;
      case 'staff': return <Briefcase className="h-5 w-5" />;
      default: return <Award className="h-5 w-5" />;
    }
  };

  const filteredTemplates = templates.filter(
    (t) => t.recipient_type === activeTab && (occasionFilter === 'all' || t.occasion === occasionFilter)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Certificate Templates</h1>
          <p className="text-muted-foreground mt-1">
            Design and manage reusable A4 certificates for students, teachers, and staff
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={occasionFilter} onValueChange={setOccasionFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All occasions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All occasions</SelectItem>
              {Object.entries(OCCASION_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => router.push(`/admin/certificate-templates/builder?type=${activeTab}`)} className="gap-2">
            <Plus className="h-4 w-4" />
            Build New Template
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CertificateRecipientType)}>
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
            <Briefcase className="h-4 w-4" />
            Staff
          </TabsTrigger>
        </TabsList>

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
                    {getRecipientIcon(type)}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Templates Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first {type} certificate template to get started
                  </p>
                  <Button onClick={() => router.push(`/admin/certificate-templates/builder?type=${type}`)} className="gap-2">
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
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Tag className="h-3 w-3" />
                          {OCCASION_LABELS[template.occasion] ?? template.occasion ?? 'General'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {template.template_config.layout?.orientation || 'landscape'}
                        </Badge>
                      </div>
                      {template.description && (
                        <CardDescription className="mt-1.5 line-clamp-2">{template.description}</CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Real live-rendered thumbnail */}
                      <div
                        className="relative rounded-lg border overflow-hidden bg-gray-100 dark:bg-slate-900 flex items-center justify-center"
                        style={{ aspectRatio: `${template.template_config.layout.width} / ${template.template_config.layout.height}` }}
                      >
                        <CertificateCanvasRenderer
                          layout={template.template_config.layout}
                          design={template.template_config.design}
                          fields={template.template_config.fields}
                          scale={0.18}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => router.push(`/admin/certificate-templates/builder?type=${activeTab}&edit=${template.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => handleDuplicate(template.id)}>
                          <Copy className="h-4 w-4" />
                          Duplicate
                        </Button>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => setDeleteId(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

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
