'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconArrowLeft, IconPlus, IconPencil, IconTrash, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { API_URL } from '@/config/api'
import * as servicesApi from '@/lib/api/services'
import { getAuthToken } from '@/lib/api/schools'

const fetcher = async (url: string) => {
    const token = await getAuthToken()
    if (!token) throw new Error('Not authenticated')
    
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    return data.data
}

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
    grade_charges?: Array<{
        id: string
        grade_level_id: string
        charge_amount: number
        grade_level?: { id: string; name: string }
    }>
}

interface GradeLevel {
    id: string
    name: string
    level_order: number
}

export default function ServicesSettingsPage() {
    const campusContext = useCampus()
    const selectedCampus = campusContext?.selectedCampus
    const campusId = selectedCampus?.id || ''
    
    const { data: services, mutate: mutateServices } = useSWR<Service[]>(
        `${API_URL}/school-services?active=false${campusId ? `&campus_id=${campusId}` : ''}`, 
        fetcher
    )
    const { data: gradeLevels } = useSWR<GradeLevel[]>(`${API_URL}/academics/grade-levels`, fetcher)

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingService, setEditingService] = useState<Service | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [name, setName] = useState('')
    const [code, setCode] = useState('')
    const [description, setDescription] = useState('')
    const [serviceType, setServiceType] = useState<'recurring' | 'one_time'>('recurring')
    const [chargeFrequency, setChargeFrequency] = useState<'monthly' | 'quarterly' | 'yearly' | 'one_time'>('monthly')
    const [defaultCharge, setDefaultCharge] = useState(0)
    const [isMandatory, setIsMandatory] = useState(false)
    const [gradeCharges, setGradeCharges] = useState<Record<string, number>>({})

    const resetForm = () => {
        setName('')
        setCode('')
        setDescription('')
        setServiceType('recurring')
        setChargeFrequency('monthly')
        setDefaultCharge(0)
        setIsMandatory(false)
        setGradeCharges({})
        setEditingService(null)
    }

    const openEditDialog = (service: Service) => {
        setEditingService(service)
        setName(service.name)
        setCode(service.code)
        setDescription(service.description || '')
        setServiceType(service.service_type)
        setChargeFrequency(service.charge_frequency)
        setDefaultCharge(service.default_charge)
        setIsMandatory(service.is_mandatory)

        const charges: Record<string, number> = {}
        service.grade_charges?.forEach(gc => {
            charges[gc.grade_level_id] = gc.charge_amount
        })
        setGradeCharges(charges)

        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!name || !code) {
            toast.error('Name and code are required')
            return
        }

        setSaving(true)

        try {
            const serviceData = {
                name,
                code,
                description,
                service_type: serviceType,
                charge_frequency: chargeFrequency,
                default_charge: defaultCharge,
                is_mandatory: isMandatory,
                campus_id: campusId // Add campus ID for campus-specific service
            }

            let serviceId = editingService?.id
            let result

            if (editingService) {
                // Update
                result = await servicesApi.updateService(editingService.id, serviceData)
            } else {
                // Create
                result = await servicesApi.createService(serviceData)
                serviceId = result.data?.id
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to save service')
            }

            // Save grade charges
            if (serviceId && Object.keys(gradeCharges).length > 0) {
                const charges = Object.entries(gradeCharges)
                    .filter(([_, amount]) => amount > 0)
                    .map(([gradeId, amount]) => ({
                        grade_level_id: gradeId,
                        charge_amount: amount
                    }))

                await servicesApi.setGradeCharges(serviceId, charges)
            }

            mutateServices()
            setIsDialogOpen(false)
            resetForm()
            toast.success(editingService ? 'Service updated' : 'Service created')
        } catch (error: any) {
            toast.error(error.message)
        }
        setSaving(false)
    }

    const handleDelete = async (serviceId: string) => {
        if (!confirm('Are you sure you want to delete this service?')) return

        try {
            const result = await servicesApi.deleteService(serviceId)
            if (!result.success) {
                throw new Error(result.error || 'Failed to delete service')
            }
            mutateServices()
            toast.success('Service deleted')
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin/settings"><IconArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight dark:text-white">School Services</h1>
                        <p className="text-muted-foreground">Configure services like Bus, Meals, Lab, etc. with grade-level pricing</p>
                    </div>
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true) }}>
                    <IconPlus className="mr-2 h-4 w-4" />Add Service
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Service</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Default Charge</TableHead>
                                <TableHead>Mandatory</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {services?.map((service) => (
                                <TableRow key={service.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{service.name}</p>
                                            {service.description && (
                                                <p className="text-sm text-muted-foreground">{service.description}</p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{service.code}</Badge></TableCell>
                                    <TableCell className="capitalize">{service.charge_frequency}</TableCell>
                                    <TableCell>{formatCurrency(service.default_charge)}</TableCell>
                                    <TableCell>{service.is_mandatory ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>
                                        <Badge variant={service.is_active ? 'default' : 'secondary'}>
                                            {service.is_active ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(service)}>
                                            <IconPencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)}>
                                            <IconTrash className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!services || services.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No services configured. Add your first service to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open) }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
                        <DialogDescription>Configure service details and grade-specific pricing</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="details">
                        <TabsList>
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="pricing">Grade Pricing</TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Service Name *</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Bus Transport" />
                                </div>
                                <div>
                                    <Label>Code *</Label>
                                    <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., BUS" />
                                </div>
                            </div>

                            <div>
                                <Label>Description</Label>
                                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Service Type</Label>
                                    <Select value={serviceType} onValueChange={(v) => setServiceType(v as any)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="recurring">Recurring</SelectItem>
                                            <SelectItem value="one_time">One-Time</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Charge Frequency</Label>
                                    <Select value={chargeFrequency} onValueChange={(v) => setChargeFrequency(v as any)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="quarterly">Quarterly</SelectItem>
                                            <SelectItem value="yearly">Yearly</SelectItem>
                                            <SelectItem value="one_time">One-Time</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Default Charge ($)</Label>
                                    <Input type="number" step="0.01" value={defaultCharge} onChange={(e) => setDefaultCharge(parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={isMandatory} onCheckedChange={setIsMandatory} />
                                    <Label>Mandatory for all students</Label>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="pricing" className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Set different prices per grade level. Leave blank to use the default charge.
                            </p>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Grade Level</TableHead>
                                        <TableHead>Charge ($)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gradeLevels?.map((grade) => (
                                        <TableRow key={grade.id}>
                                            <TableCell>{grade.name}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder={`Default: ${formatCurrency(defaultCharge)}`}
                                                    value={gradeCharges[grade.id] || ''}
                                                    onChange={(e) => setGradeCharges({
                                                        ...gradeCharges,
                                                        [grade.id]: parseFloat(e.target.value) || 0
                                                    })}
                                                    className="w-32"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { resetForm(); setIsDialogOpen(false) }}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            <IconDeviceFloppy className="mr-2 h-4 w-4" />
                            {saving ? 'Saving...' : 'Save Service'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
