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
            toast.error('Please fill all required fields')
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
                toast.success(editingService ? 'Service updated' : 'Service created')
                mutate()
                resetForm()
            } else {
                toast.error(result.error || 'Operation failed')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to save')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this service?')) return

        try {
            const { createClient } = await import('@/lib/supabase/client')
            const token = (await createClient().auth.getSession()).data.session?.access_token
            
            const response = await fetch(`${API_BASE}/api/school-services/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            const result = await response.json()

            if (result.success) {
                toast.success('Service deleted')
                mutate()
            } else {
                toast.error(result.error || 'Delete failed')
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete')
        }
    }

    const formatCurrency = (amount: number) => {
        return `${amount?.toLocaleString() || 0}`
    }

    const getFrequencyLabel = (freq: string) => {
        const labels: Record<string, string> = {
            monthly: 'Monthly',
            quarterly: 'Quarterly',
            yearly: 'Yearly',
            one_time: 'One Time'
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
                    <h1 className="text-2xl font-bold">School Services</h1>
                    <p className="text-muted-foreground">
                        Configure optional services like Bus, Meals, Sports that students can subscribe to
                    </p>
                </div>
                <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
                    <IconPlus className="h-4 w-4 mr-2" />
                    Add Service
                </Button>
            </div>

            {/* Add/Edit Form */}
            {isAdding && (
                <Card className="border-2 border-primary">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{editingService ? 'Edit' : 'Add'} Service</CardTitle>
                                <CardDescription>Configure service details and pricing</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={resetForm}>
                                <IconX className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Service Name *</Label>
                                <Input
                                    placeholder="e.g., Bus Service, Meals, Sports"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label>Code *</Label>
                                <Input
                                    placeholder="e.g., BUS, MEAL, SPORT"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="col-span-2">
                                <Label>Description</Label>
                                <Input
                                    placeholder="Brief description of the service"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <Label>Service Type *</Label>
                                <Select
                                    value={formData.service_type}
                                    onValueChange={(v: any) => setFormData({ ...formData, service_type: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="recurring">Recurring</SelectItem>
                                        <SelectItem value="one_time">One Time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Charge Frequency *</Label>
                                <Select
                                    value={formData.charge_frequency}
                                    onValueChange={(v: any) => setFormData({ ...formData, charge_frequency: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="quarterly">Quarterly</SelectItem>
                                        <SelectItem value="yearly">Yearly</SelectItem>
                                        <SelectItem value="one_time">One Time</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Default Charge *</Label>
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
                                <Label>Display Order</Label>
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
                                <Label>Mandatory Service (all students must have it)</Label>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button onClick={handleSave}>
                                <IconDeviceFloppy className="h-4 w-4 mr-2" />
                                {editingService ? 'Update' : 'Save'} Service
                            </Button>
                            <Button variant="outline" onClick={resetForm}>
                                Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Services List */}
            <Card>
                <CardHeader>
                    <CardTitle>Configured Services</CardTitle>
                    <CardDescription>
                        {services?.length || 0} services configured
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
                                        <TableHead>Service</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Frequency</TableHead>
                                        <TableHead>Charge</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {services && services.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                                No services configured. Click "Add Service" to create one.
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
                                                        {service.is_active && <Badge variant="default">Active</Badge>}
                                                        {service.is_mandatory && <Badge variant="secondary">Mandatory</Badge>}
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
                    <CardTitle className="text-blue-900">💡 How Services Work</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-900 space-y-2">
                    <p>• Services are optional add-ons that students can subscribe to (Bus, Meals, Sports, etc.)</p>
                    <p>• When onboarding a student, you can select which services they need</p>
                    <p>• Service charges are automatically added to the student's monthly fee</p>
                    <p>• You can set different charges per grade level if needed</p>
                    <p>• Mandatory services are automatically assigned to all students</p>
                </CardContent>
            </Card>
        </div>
    )
}
