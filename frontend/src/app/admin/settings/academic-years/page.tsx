"use client"


import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Plus, Edit, Calendar, CheckCircle, Loader2, Building2, School as SchoolIcon } from "lucide-react"
import * as academicsApi from "@/lib/api/academics"
import * as schoolsApi from "@/lib/api/schools"
import { School } from "@/lib/api/schools"
import { useAuth } from "@/context/AuthContext"

export default function AcademicYearsPage() {
  const { user } = useAuth()
  const [academicYears, setAcademicYears] = useState<academicsApi.AcademicYear[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // School State
  const [schools, setSchools] = useState<School[]>([])
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false)
  const [schoolFormData, setSchoolFormData] = useState<{
    name: string;
    slug: string;
    contact_email: string;
    parent_school_id?: string;
  }>({ name: '', slug: '', contact_email: '' })

  const [editingYear, setEditingYear] = useState<academicsApi.AcademicYear | null>(null)

  // Form state
  const [formData, setFormData] = useState<academicsApi.CreateAcademicYearDTO>({
    name: "",
    start_date: "",
    end_date: "",
    is_current: false,
    is_active: true
  })

  useEffect(() => {
    loadAcademicYears()
    loadSchools()
  }, [])

  const loadAcademicYears = async () => {
    try {
      setLoading(true)
      const data = await academicsApi.getAcademicYears()
      setAcademicYears(data)
    } catch (error: any) {
      toast.error(error.message || "Failed to load academic years")
    } finally {
      setLoading(false)
    }
  }

  const loadSchools = async () => {
    try {
      setLoadingSchools(true)
      const data = await schoolsApi.getMySchools()
      setSchools(data)
    } catch (error: any) {
      // toast.error("Failed to load schools") // Optional: suppress if not critical
      console.error(error)
    } finally {
      setLoadingSchools(false)
    }
  }

  const handleSwitchSchool = async (schoolId: string) => {
    try {
      const school = await schoolsApi.switchSchoolContext(schoolId)
      toast.success(`Switched to ${school.name}`)
      // Reload page or force refresh to update context
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message || "Failed to switch school")
    }
  }

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await schoolsApi.createSchool(schoolFormData)
      toast.success("School created successfully")
      setIsSchoolDialogOpen(false)
      loadSchools()
    } catch (error: any) {
      toast.error(error.message || "Failed to create school")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingYear) {
        await academicsApi.updateAcademicYear(editingYear.id, formData)
        toast.success("Academic year updated successfully")
      } else {
        await academicsApi.createAcademicYear(formData)
        toast.success("Academic year created successfully")
      }
      setIsDialogOpen(false)
      resetForm()
      loadAcademicYears()
    } catch (error: any) {
      toast.error(error.message || "Failed to save academic year")
    }
  }

  const handleEdit = (year: academicsApi.AcademicYear) => {
    setEditingYear(year)
    setFormData({
      name: year.name,
      start_date: year.start_date.split('T')[0],
      end_date: year.end_date.split('T')[0],
      is_current: year.is_current,
      is_active: year.is_active
    })
    setIsDialogOpen(true)
  }

  const handleSetCurrent = async (id: string) => {
    try {
      await academicsApi.updateAcademicYear(id, { is_current: true })
      toast.success("Academic year set as current")
      loadAcademicYears()
    } catch (error: any) {
      toast.error(error.message || "Failed to set current year")
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      start_date: "",
      end_date: "",
      is_current: false,
      is_active: true
    })
    setEditingYear(null)
  }

  const currentYear = academicYears.find(year => year.is_current)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
          School Configuration
        </h1>
        <p className="text-muted-foreground mt-2">Manage your schools and academic sessions</p>
      </div>

      <Tabs defaultValue="academic-years" className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-1">
          <TabsTrigger value="academic-years">Academic Years</TabsTrigger>
          {/* <TabsTrigger value="schools">My Schools</TabsTrigger> */}
        </TabsList>

        <TabsContent value="academic-years" className="space-y-6 mt-6">
          {/* Current Year Card */}
          {currentYear && (
            <Card className="border-2 border-[#022172]">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-muted-foreground">Current Academic Year</span>
                    </div>
                    <h3 className="text-2xl font-bold text-[#022172]">{currentYear.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(currentYear.start_date).toLocaleDateString()} - {new Date(currentYear.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="h-16 w-16 rounded-full bg-gradient-blue flex items-center justify-center">
                    <Calendar className="h-8 w-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Years</p>
                    <h3 className="text-2xl font-bold">{academicYears.length}</h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-blue flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Years</p>
                    <h3 className="text-2xl font-bold">
                      {academicYears.filter(y => y.is_active).length}
                    </h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-teal flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Past Years</p>
                    <h3 className="text-2xl font-bold">
                      {academicYears.filter(y => !y.is_active).length}
                    </h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-gradient-orange flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Academic Years Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Academic Years List</CardTitle>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open)
                if (!open) resetForm()
              }}>
                <DialogTrigger asChild>
                  <Button
                    style={{ background: 'var(--gradient-blue)' }}
                    className="text-white hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Academic Year
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingYear ? "Edit Academic Year" : "Add New Academic Year"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label>Academic Year Name *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., 2025-2026"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Start Date *</Label>
                          <Input
                            type="date"
                            value={formData.start_date}
                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>End Date *</Label>
                          <Input
                            type="date"
                            value={formData.end_date}
                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_current}
                            onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">Set as current year</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm">Active</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        style={{ background: 'var(--gradient-blue)' }}
                        className="text-white hover:opacity-90 transition-opacity"
                      >
                        {editingYear ? "Update" : "Create"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[#57A3CC]/10 to-[#022172]/10">
                        <TableHead>Academic Year</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {academicYears.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No academic years found
                          </TableCell>
                        </TableRow>
                      ) : (
                        academicYears.map((year) => {
                          const startDate = new Date(year.start_date)
                          const endDate = new Date(year.end_date)
                          const durationMonths = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30))

                          return (
                            <TableRow key={year.id} className="hover:bg-muted/50">
                              <TableCell className="font-medium">{year.name}</TableCell>
                              <TableCell>{startDate.toLocaleDateString()}</TableCell>
                              <TableCell>{endDate.toLocaleDateString()}</TableCell>
                              <TableCell>{durationMonths} months</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {year.is_current && (
                                    <Badge variant="default" className="bg-green-600">
                                      Current
                                    </Badge>
                                  )}
                                  <Badge variant={year.is_active ? "default" : "secondary"}>
                                    {year.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {!year.is_current && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSetCurrent(year.id)}
                                    >
                                      Set Current
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(year)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Schools Tab - Commented out because admins can have school campuses */}
        {/* <TabsContent value="schools" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>My Schools</CardTitle>
                <CardDescription>
                  Schools you have access to. Switch between them or add new ones.
                </CardDescription>
              </div>
              <Dialog open={isSchoolDialogOpen} onOpenChange={setIsSchoolDialogOpen}>
                <DialogTrigger asChild>
                  <Button style={{ background: 'var(--gradient-blue)' }} className="text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add New School
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New School</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateSchool} className="space-y-4">
                    <div>
                      <Label>School Name</Label>
                      <Input
                        value={schoolFormData.name}
                        onChange={(e) => setSchoolFormData({ ...schoolFormData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Slug (Unique ID)</Label>
                      <Input
                        value={schoolFormData.slug}
                        onChange={(e) => setSchoolFormData({ ...schoolFormData, slug: e.target.value })}
                        placeholder="e.g. elementary-branch"
                        required
                      />
                    </div>
                    <div>
                      <Label>Contact Email</Label>
                      <Input
                        value={schoolFormData.contact_email}
                        onChange={(e) => setSchoolFormData({ ...schoolFormData, contact_email: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Parent School (Optional)</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={schoolFormData.parent_school_id || ''}
                        onChange={(e) => setSchoolFormData({ ...schoolFormData, parent_school_id: e.target.value || undefined })}
                      >
                        <option value="">None (Independent School)</option>
                        {schools.map(school => (
                          <option key={school.id} value={school.id}>
                            {school.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Select a parent school to create this as a branch.
                      </p>
                    </div>
                    <Button type="submit" className="w-full">Create School</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingSchools ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {schools.map(school => (
                    <Card key={school.id} className="cursor-pointer hover:border-blue-500 transition-all">
                      <CardHeader className="flex flex-row items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{school.name}</CardTitle>
                          <CardDescription>{school.slug}</CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between items-center mt-2">
                          <Badge variant={school.status === 'active' ? 'default' : 'destructive'}>
                            {school.status}
                          </Badge>
                          {user?.school_id !== school.id && (
                            <Button size="sm" variant="outline" onClick={() => handleSwitchSchool(school.id)}>
                              Switch to this
                            </Button>
                          )}
                          {user?.school_id === school.id && (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              Current
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent> */}
      </Tabs>
    </div>
  )
}
