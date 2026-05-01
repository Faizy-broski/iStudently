'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { IconArrowLeft, IconPlus, IconTrash, IconEdit, IconDeviceFloppy, IconX } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import useSWR from 'swr'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface Service {
    id: string
    name: string
    code: string
    description?: string
    service_type: 'recurring' | 'one_time'
    charge_frequency: 'monthly' | 'quarterly' | 'yearly' | 'one_time'
    default_charge: number
    is_mandatory: boolean
    is_active: boolean
    display_order: number
}

export default function ServicesPage() {
    const { profile } = useAuth()
    const { selectedCampus } = useCampus()
    const schoolId = selectedCampus?.id || profile?.school_id || ''

    const [isAdding, setIsAdding] = useState(false)
    const [editingService, setEditingService] = useState<Service | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        service_type: 'recurring' as 'recurring' | 'one_time',
        charge_frequency: 'monthly' as 'monthly' | 'quarterly' | 'yearly' | 'one_time',
        default_charge: '',
        is_mandatory: false,
        display_order: 0
    })

    // Fetch services
    const { data: services, mutate, isLoading } = useSWR<Service[]>(
        schoolId ? `services-${schoolId}` : null,
        async () => {
            const res = await fetch(`${API_BASE}/api/school-services`, {
                headers: { 'Authorization': `Bearer ${(await import('@/lib/supabase/client')).createClient().auth.getSession().then(s => s.data.session?.access_token)}` }
            })
            const json = await res.json()
            return json.success ? json.data : []
        }
    )

    const resetForm = () => {
        setFormData({
            name: '',
            code: '',
            description: '',
            service_type: 'recurring',
            charge_frequency: 'monthly',
            default_charge: '',
            is_mandatory: false,
            display_order: 0
        })
        setIsAdding(false)
        setEditingService(null)
    }

    const handleEdit = (service: Service) => {
        setEditingService(service)
        setFormData({
            name: service.name,
            code: service.code,
            description: service.description || '',
            service_type: service.service_type,
            charge_frequency: service.charge_frequency,
            default_charge: service.default_charge.toString(),
            is_mandatory: service.is_mandatory,
            display_order: service.display_order
        })
        setIsAdding(true)
    }

    const handleSave = async () => {
        if (!formData.name || !formData.code || !formData.default_charge) {
            toast.error('يرجى تعبئة جميع الحقول المطلوبة')
            return
        }

        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const url = editingService
                ? `${API_BASE}/api/school-services/${editingService.id}`
                : `${API_BASE}/api/school-services`

            const method = editingService ? 'PUT' : 'POST'

            const response = await fetch(url, {
                method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    default_charge: parseFloat(formData.default_charge)
                })
            })

            const result = await response.json()

            if (result.success) {
                toast.success(editingService ? 'تم تحديث الخدمة' : 'تم إنشاء الخدمة')
                mutate()
                resetForm()
            } else {
                toast.error(result.error || 'فشلت العملية')
            }
        } catch (error: any) {
            toast.error(error.message || 'فشل الحفظ')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return

        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const response = await fetch(`${API_BASE}/api/school-services/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            const result = await response.json()

            if (result.success) {
                toast.success('تم حذف الخدمة')
                mutate()
            } else {
                toast.error(result.error || 'فشل الحذف')
            }
        } catch (error: any) {
            toast.error(error.message || 'فشل الحذف')
        }
    }

    const formatCurrency = (amount: number) => {
        return `${amount?.toLocaleString() || 0}`
    }

    const getFrequencyLabel = (freq: string) => {
        const labels: Record<string, string> = {
            monthly: 'شهري',
            quarterly: 'ربع سنوي',
            yearly: 'سنوي',
            one_time: 'مرة واحدة'
        }
        return labels[freq] || freq
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/fees/settings">
                        <IconArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">خدمات المدرسة</h1>
                    <p className="text-muted-foreground">
                        ضبط الخدمات الاختيارية مثل النقل والوجبات والرياضة التي يمكن للطلاب الاشتراك بها
                    </p>
                </div>
                <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
                    <IconPlus className="h-4 w-4 mr-2" />
                    إضافة خدمة
                </Button>
            </div>

            {/* Add/Edit Form */}
            {isAdding && (
                <Card className="border-2 border-primary">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{editingService ? 'تعديل' : 'إضافة'} خدمة</CardTitle>
                                <CardDescription>ضبط تفاصيل الخدمة وتسعيرها</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={resetForm}>
                                <IconX className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>اسم الخدمة *</Label>
                                <Input
                                    placeholder="e.g., Bus Service, Meals, Sports"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label>الرمز *</Label>
                                <Input
                                    placeholder="e.g., BUS, MEAL, SPORT"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="col-span-2">
                                <Label>الوصف</Label>
                                <Input
                                    placeholder="Brief description of the service"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label>نوع الخدمة *</Label>
                                <Select
                                    value={formData.service_type}
                                    onValueChange={(v: any) => setFormData({ ...formData, service_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="recurring">متكرر</SelectItem>
                                        <SelectItem value="one_time">مرة واحدة</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>تكرار التحصيل *</Label>
                                <Select
                                    value={formData.charge_frequency}
                                    onValueChange={(v: any) => setFormData({ ...formData, charge_frequency: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">شهري</SelectItem>
                                        <SelectItem value="quarterly">ربع سنوي</SelectItem>
                                        <SelectItem value="yearly">سنوي</SelectItem>
                                        <SelectItem value="one_time">مرة واحدة</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>الرسوم الافتراضية *</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={formData.default_charge}
                                    onChange={(e) => setFormData({ ...formData, default_charge: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label>ترتيب العرض</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.display_order}
                                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="col-span-2 flex items-center space-x-2">
                                <Switch
                                    checked={formData.is_mandatory}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_mandatory: checked })}
                                />
                                <Label>خدمة إلزامية (لجميع الطلاب)</Label>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button onClick={handleSave}>
                                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                {editingService ? 'تحديث' : 'حفظ'} الخدمة
                            </Button>
                            <Button variant="outline" onClick={resetForm}>
                                إلغاء
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Services List */}
            <Card>
                <CardHeader>
                    <CardTitle>الخدمات المُعدّة</CardTitle>
                    <CardDescription>
                        {services?.length || 0} خدمة مُعدّة
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full" />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الخدمة</TableHead>
                                        <TableHead>الرمز</TableHead>
                                        <TableHead>النوع</TableHead>
                                        <TableHead>التكرار</TableHead>
                                        <TableHead>الرسوم</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead className="text-right">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {services && services.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                لا توجد خدمات مُعدة. اضغط "إضافة خدمة" لإنشاء واحدة.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        services?.map((service) => (
                                            <TableRow key={service.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{service.name}</p>
                                                        {service.description && (
                                                            <p className="text-xs text-muted-foreground">{service.description}</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{service.code}</code>
                                                </TableCell>
                                                <TableCell className="capitalize">{service.service_type.replace('_', ' ')}</TableCell>
                                                <TableCell>{getFrequencyLabel(service.charge_frequency)}</TableCell>
                                                <TableCell className="font-semibold">{formatCurrency(service.default_charge)}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        {service.is_active && <Badge variant="default">نشط</Badge>}
                                                        {service.is_mandatory && <Badge variant="secondary">إلزامي</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex gap-1 justify-end">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(service)}
                                                        >
                                                            <IconEdit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(service.id)}
                                                        >
                                                            <IconTrash className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                    <CardTitle className="text-blue-900">💡 كيف تعمل الخدمات</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-2">
                    <p>• الخدمات إضافات اختيارية يمكن للطلاب الاشتراك بها (نقل، وجبات، رياضة، إلخ)</p>
                    <p>• عند تسجيل طالب يمكنك تحديد الخدمات التي يحتاجها</p>
                    <p>• تُضاف رسوم الخدمات تلقائيًا إلى الرسوم الشهرية للطالب</p>
                    <p>• يمكنك تحديد رسوم مختلفة لكل مرحلة عند الحاجة</p>
                    <p>• الخدمات الإلزامية تُسند تلقائيًا لجميع الطلاب</p>
                </CardContent>
            </Card>
        </div>
    )
}
