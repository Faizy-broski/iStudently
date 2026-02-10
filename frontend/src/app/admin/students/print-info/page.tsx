"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Printer, 
  FileText, 
  Users, 
  Search, 
  CheckSquare, 
  Square, 
  Loader2,
  Building2
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useCampus } from "@/context/CampusContext";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { getStudents, getStudentsPrintInfo, PrintInfoResponse, Student } from "@/lib/api/students";
import { getFieldDefinitions, CustomFieldDefinition } from "@/lib/api/custom-fields";
import { StudentInfoPrintReport } from "@/components/admin";

// Standard categories that are always available
const STANDARD_CATEGORIES = [
  { id: 'personal', name: 'Personal Information', description: 'Name, photo, contact details' },
  { id: 'academic', name: 'Academic Information', description: 'Grade, section, admission date' },
  { id: 'medical', name: 'Medical Information', description: 'Blood group, allergies, medical notes' },
  { id: 'family', name: 'Family & Emergency', description: 'Parent info, emergency contacts' },
  { id: 'system', name: 'System Information', description: 'Student ID, username, status' },
];

export default function PrintStudentInfoPage() {
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;
  
  // State for filters
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // State for selections
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['personal', 'academic']);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  
  // State for data
  const [students, setStudents] = useState<Student[]>([]);
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [printData, setPrintData] = useState<PrintInfoResponse | null>(null);
  
  // Hooks for academics data
  const { gradeLevels } = useGradeLevels();
  const { sections } = useSections();
  
  // Filter sections by selected grade level
  const filteredSections = useMemo(() => {
    if (!selectedGradeLevel) return sections;
    return sections.filter(s => s.grade_level_id === selectedGradeLevel);
  }, [sections, selectedGradeLevel]);
  
  // Print ref for hidden print area
  const printRef = useRef<HTMLDivElement>(null);
  
  // Load custom field categories
  useEffect(() => {
    const loadCustomCategories = async () => {
      try {
        const response = await getFieldDefinitions('student', selectedCampus?.id);
        if (response.success && response.data) {
          // Extract unique custom categories
          const categoryMap = new Map<string, string>();
          response.data.forEach((field: CustomFieldDefinition) => {
            if (field.category_id && field.category_name && 
                !STANDARD_CATEGORIES.find(sc => sc.id === field.category_id)) {
              categoryMap.set(field.category_id, field.category_name);
            }
          });
          setCustomCategories(Array.from(categoryMap.entries()).map(([id, name]) => ({ id, name })));
        }
      } catch (error) {
        console.error('Failed to load custom categories:', error);
      }
    };
    
    loadCustomCategories();
  }, [selectedCampus?.id]);
  
  // Load students when filters change
  useEffect(() => {
    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const response = await getStudents({
          page: 1,
          limit: 500, // Load more for selection
          search: searchQuery || undefined,
          grade_level: selectedGradeLevel || undefined,
          campus_id: selectedCampus?.id
        });
        
        if (response.success && response.data) {
          setStudents(response.data);
        }
      } catch (error) {
        console.error('Failed to load students:', error);
        toast.error('Failed to load students');
      } finally {
        setLoadingStudents(false);
      }
    };
    
    const debounceTimer = setTimeout(loadStudents, 300);
    return () => clearTimeout(debounceTimer);
  }, [selectedGradeLevel, selectedSection, searchQuery, selectedCampus?.id]);
  
  // Filter students by section (client-side since we already have the data)
  const filteredStudents = useMemo(() => {
    if (!selectedSection) return students;
    return students.filter(s => {
      // Check if student has section info
      const studentWithSection = s as Student & { section_id?: string };
      return studentWithSection.section_id === selectedSection;
    });
  }, [students, selectedSection]);
  
  // Handle category selection
  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };
  
  // Handle student selection
  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };
  
  // Select all/none students
  const toggleAllStudents = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };
  
  // Generate and print directly
  const handleGeneratePrint = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student');
      return;
    }
    
    if (selectedCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }
    
    setLoading(true);
    try {
      const response = await getStudentsPrintInfo({
        studentIds: selectedStudentIds,
        categoryIds: selectedCategories,
        campusId: selectedCampus?.id
      });
      
      if (response.success && response.data) {
        setPrintData(response.data);
        // Wait for state update and DOM render, then print
        setTimeout(() => {
          window.print();
          toast.success('Print dialog opened');
        }, 100);
      } else {
        toast.error(response.error || 'Failed to generate print data');
      }
    } catch (error) {
      console.error('Failed to generate print data:', error);
      toast.error('Failed to generate print data');
    } finally {
      setLoading(false);
    }
  };
  
  // Get student display name
  const getStudentName = (student: Student) => {
    const profile = student.profile;
    if (!profile) return student.student_number;
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || student.student_number;
  };
  
  return (
    <>
      {/* Hidden print area - only visible when printing */}
      {printData && (
        <div className="hidden print:block" ref={printRef}>
          <StudentInfoPrintReport 
            data={printData} 
            selectedCategories={selectedCategories}
          />
        </div>
      )}
      
      {/* Main UI - hidden when printing */}
      <div className="container mx-auto py-6 space-y-6 print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/admin/students" className="hover:text-foreground">
              Students
            </Link>
            <span>/</span>
            <span>Print Student Info</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Print Student Information</h1>
          <p className="text-muted-foreground">
            Select categories and students to generate a printable report
          </p>
        </div>
        {selectedCampus && (
          <Badge variant="outline" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {selectedCampus.name}
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Category Selection */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Select Categories
            </CardTitle>
            <CardDescription>
              Choose which information categories to include in the report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-y-auto pr-4 space-y-4">
              {/* Standard Categories */}
              <div>
                <h4 className="font-medium mb-3 text-sm text-muted-foreground">Standard Categories</h4>
                <div className="space-y-3">
                  {STANDARD_CATEGORIES.map((category) => (
                    <div key={category.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`cat-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onCheckedChange={() => toggleCategory(category.id)}
                      />
                      <div className="grid gap-1 leading-none">
                        <Label
                          htmlFor={`cat-${category.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {category.name}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Custom Categories */}
              {customCategories.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3 text-sm text-muted-foreground">Custom Categories</h4>
                    <div className="space-y-3">
                      {customCategories.map((category) => (
                        <div key={category.id} className="flex items-start space-x-3">
                          <Checkbox
                            id={`cat-${category.id}`}
                            checked={selectedCategories.includes(category.id)}
                            onCheckedChange={() => toggleCategory(category.id)}
                          />
                          <Label
                            htmlFor={`cat-${category.id}`}
                            className="font-medium cursor-pointer"
                          >
                            {category.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Badge variant="secondary" className="w-full justify-center py-2">
                {selectedCategories.length} categories selected
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        {/* Right Panel - Student Selection */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Students
            </CardTitle>
            <CardDescription>
              Filter and select students to include in the report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <div className="w-full sm:w-48">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Grade Level</Label>
                <Select 
                  value={selectedGradeLevel} 
                  onValueChange={(value) => {
                    setSelectedGradeLevel(value === "all" ? "" : value);
                    setSelectedSection("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {gradeLevels.map((grade) => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full sm:w-48">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Section</Label>
                <Select 
                  value={selectedSection} 
                  onValueChange={(value) => setSelectedSection(value === "all" ? "" : value)}
                  disabled={!selectedGradeLevel}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {filteredSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Select All / None */}
            <div className="flex items-center justify-between py-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAllStudents}
                className="text-sm"
              >
                {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square className="mr-2 h-4 w-4" />
                    Select All ({filteredStudents.length})
                  </>
                )}
              </Button>
              <Badge variant="outline">
                {selectedStudentIds.length} of {filteredStudents.length} selected
              </Badge>
            </div>
            
            {/* Student List */}
            <div className="h-80 overflow-y-auto">
              {loadingStudents ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2" />
                  <p>No students found</p>
                  <p className="text-xs">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedStudentIds.includes(student.id)
                          ? 'bg-primary/5 border-primary/20'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleStudent(student.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedStudentIds.includes(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                        <div>
                          <p className="font-medium">{getStudentName(student)}</p>
                          <p className="text-sm text-muted-foreground">
                            {student.student_number} • {student.grade_level || 'No Grade'}
                          </p>
                        </div>
                      </div>
                      {student.profile?.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Action Bar */}
      <Card className="bg-muted/30">
        <CardContent className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedStudentIds.length}</span> students and{' '}
            <span className="font-medium text-foreground">{selectedCategories.length}</span> categories selected
          </div>
          <Button 
            onClick={handleGeneratePrint}
            disabled={loading || selectedStudentIds.length === 0 || selectedCategories.length === 0}
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Print Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      </div>
      
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
