"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Building2, Calendar, CheckCircle2, ChevronRight, Loader2, School } from "lucide-react"
import { createCampus, getSetupStatus } from "@/lib/api/setup-status"
import { createAcademicYear } from "@/lib/api/academics"

type Step = "welcome" | "campus" | "academic-year" | "complete"

export default function SetupPage() {
    const router = useRouter()
    const { profile, loading: authLoading } = useAuth()

    const [currentStep, setCurrentStep] = useState<Step>("welcome")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [checkingStatus, setCheckingStatus] = useState(true)

    // Campus form state
    const [campusName, setCampusName] = useState("")
    const [campusAddress, setCampusAddress] = useState("")
    const [campusEmail, setCampusEmail] = useState("")
    const [campusPhone, setCampusPhone] = useState("")

    // Academic year form state
    const [yearName, setYearName] = useState("")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    // Check if setup is already complete
    useEffect(() => {
        const checkStatus = async () => {
            if (authLoading) return

            try {
                const status = await getSetupStatus()
                if (status.isComplete) {
                    // Already complete, redirect to dashboard
                    router.replace("/admin/dashboard")
                    return
                }

                // Skip to appropriate step if partially complete
                if (status.hasCampuses && !status.hasAcademicYear) {
                    setCurrentStep("academic-year")
                } else if (!status.hasCampuses) {
                    setCurrentStep("welcome")
                }
            } catch (error) {
                console.error("Error checking setup status:", error)
            } finally {
                setCheckingStatus(false)
            }
        }

        checkStatus()
    }, [authLoading, router])

    // Suggest default year name based on current date
    useEffect(() => {
        const now = new Date()
        const year = now.getFullYear()
        const suggestedName = now.getMonth() >= 8
            ? `${year}-${year + 1}`
            : `${year - 1}-${year}`
        setYearName(suggestedName)

        // Set default dates
        const startYear = now.getMonth() >= 8 ? year : year - 1
        setStartDate(`${startYear}-09-01`)
        setEndDate(`${startYear + 1}-06-30`)
    }, [])

    const handleCreateCampus = async () => {
        if (!campusName.trim()) {
            toast.error("Please enter a campus name")
            return
        }

        setIsSubmitting(true)
        try {
            await createCampus({
                name: campusName,
                address: campusAddress || undefined,
                contact_email: campusEmail || undefined,
                phone: campusPhone || undefined
            })
            toast.success("Campus created successfully!")
            setCurrentStep("academic-year")
        } catch (error) {
            console.error("Error creating campus:", error)
            toast.error("Failed to create campus. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCreateAcademicYear = async () => {
        if (!yearName.trim() || !startDate || !endDate) {
            toast.error("Please fill in all required fields")
            return
        }

        setIsSubmitting(true)
        try {
            await createAcademicYear({
                name: yearName,
                start_date: startDate,
                end_date: endDate,
                is_current: true
            })
            toast.success("Academic year created successfully!")
            setCurrentStep("complete")
        } catch (error) {
            console.error("Error creating academic year:", error)
            toast.error("Failed to create academic year. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleComplete = () => {
        router.push("/admin/dashboard")
    }

    if (authLoading || checkingStatus) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-[#022172]" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    const steps = [
        { id: "welcome", label: "Welcome", icon: School },
        { id: "campus", label: "Campus", icon: Building2 },
        { id: "academic-year", label: "Academic Year", icon: Calendar },
        { id: "complete", label: "Complete", icon: CheckCircle2 }
    ]

    const currentStepIndex = steps.findIndex(s => s.id === currentStep)

    return (
        <div className="space-y-8">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2">
                {steps.map((step, index) => {
                    const Icon = step.icon
                    const isActive = step.id === currentStep
                    const isComplete = index < currentStepIndex

                    return (
                        <div key={step.id} className="flex items-center">
                            <div className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                ${isActive ? "bg-[#022172] text-white" : ""}
                ${isComplete ? "bg-green-100 text-green-700" : ""}
                ${!isActive && !isComplete ? "bg-gray-100 text-gray-400" : ""}
              `}>
                                <Icon className="h-4 w-4" />
                                <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                            </div>
                            {index < steps.length - 1 && (
                                <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Step Content */}
            {currentStep === "welcome" && (
                <Card className="max-w-2xl mx-auto">
                    <CardHeader className="text-center pb-2">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-linear-to-br from-[#57A3CC] to-[#022172] flex items-center justify-center">
                            <School className="h-8 w-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl dark:text-white">Welcome to iStudent.ly!</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Let&apos;s set up your school in just a few steps. You&apos;ll need to create
                            at least one campus and one academic year to get started.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4 mb-6">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50">
                                <Building2 className="h-5 w-5 text-[#022172] mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-900">Step 1: Create a Campus</p>
                                    <p className="text-sm text-gray-600">
                                        A campus is a physical location of your school. You can add more later.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50">
                                <Calendar className="h-5 w-5 text-[#022172] mt-0.5" />
                                <div>
                                    <p className="font-medium text-gray-900">Step 2: Set Up Academic Year</p>
                                    <p className="text-sm text-gray-600">
                                        Define your current academic year with start and end dates.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={() => setCurrentStep("campus")}
                            className="w-full bg-[#022172] hover:bg-[#022172]/90"
                        >
                            Get Started
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </CardContent>
                </Card>
            )}

            {currentStep === "campus" && (
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-[#022172]" />
                            Create Your First Campus
                        </CardTitle>
                        <CardDescription>
                            Enter the details for your school&apos;s main campus. You can add more campuses later.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="campusName">Campus Name *</Label>
                            <Input
                                id="campusName"
                                placeholder="e.g., Main Campus, Downtown Branch"
                                value={campusName}
                                onChange={(e) => setCampusName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="campusAddress">Address</Label>
                            <Textarea
                                id="campusAddress"
                                placeholder="Enter the campus address"
                                value={campusAddress}
                                onChange={(e) => setCampusAddress(e.target.value)}
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="campusEmail">Contact Email</Label>
                                <Input
                                    id="campusEmail"
                                    type="email"
                                    placeholder="campus@school.com"
                                    value={campusEmail}
                                    onChange={(e) => setCampusEmail(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="campusPhone">Phone Number</Label>
                                <Input
                                    id="campusPhone"
                                    type="tel"
                                    placeholder="+1 234 567 8900"
                                    value={campusPhone}
                                    onChange={(e) => setCampusPhone(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setCurrentStep("welcome")}
                                disabled={isSubmitting}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleCreateCampus}
                                disabled={isSubmitting || !campusName.trim()}
                                className="flex-1 bg-[#022172] hover:bg-[#022172]/90"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        Create Campus
                                        <ChevronRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {currentStep === "academic-year" && (
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-[#022172]" />
                            Set Up Academic Year
                        </CardTitle>
                        <CardDescription>
                            Define your current academic year. This will be used for student enrollments and scheduling.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="yearName">Academic Year Name *</Label>
                            <Input
                                id="yearName"
                                placeholder="e.g., 2024-2025"
                                value={yearName}
                                onChange={(e) => setYearName(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date *</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date *</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => setCurrentStep("campus")}
                                disabled={isSubmitting}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleCreateAcademicYear}
                                disabled={isSubmitting || !yearName.trim() || !startDate || !endDate}
                                className="flex-1 bg-[#022172] hover:bg-[#022172]/90"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        Create Academic Year
                                        <ChevronRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {currentStep === "complete" && (
                <Card className="max-w-2xl mx-auto">
                    <CardHeader className="text-center pb-2">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                        <CardTitle className="text-2xl text-green-700 dark:text-white">Setup Complete!</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Your school is now ready to use. You can start adding students, teachers, and more.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="bg-green-50 rounded-lg p-4 mb-6">
                            <h3 className="font-medium text-green-800 mb-2">What&apos;s Next?</h3>
                            <ul className="text-sm text-green-700 space-y-1">
                                <li>• Add teachers and staff to your school</li>
                                <li>• Create classes and sections</li>
                                <li>• Enroll students</li>
                                <li>• Set up your timetable</li>
                            </ul>
                        </div>
                        <Button
                            onClick={handleComplete}
                            className="w-full bg-[#022172] hover:bg-[#022172]/90"
                        >
                            Go to Dashboard
                            <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
