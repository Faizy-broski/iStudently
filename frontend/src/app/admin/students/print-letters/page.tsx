"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  Mail, 
  Users, 
  Search, 
  CheckSquare, 
  Square, 
  Loader2,
  Building2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useCampus } from "@/context/CampusContext";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { getStudents, Student } from "@/lib/api/students";

// Available placeholder fields for mail merge
const PLACEHOLDER_FIELDS = [
  { id: '__FIRST_NAME__', label: 'First Name', category: 'Personal' },
  { id: '__FATHER_NAME__', label: "Father's Name", category: 'Personal' },
  { id: '__GRANDFATHER_NAME__', label: "Grandfather's Name", category: 'Personal' },
  { id: '__LAST_NAME__', label: 'Last Name / Surname', category: 'Personal' },
  { id: '__FULL_NAME__', label: 'Full Name', category: 'Personal' },
  { id: '__EMAIL__', label: 'Email', category: 'Personal' },
  { id: '__PHONE__', label: 'Phone', category: 'Personal' },
  { id: '__STUDENT_ID__', label: 'Student ID', category: 'Academic' },
  { id: '__GRADE_LEVEL__', label: 'Grade Level', category: 'Academic' },
  { id: '__SECTION__', label: 'Section', category: 'Academic' },
  { id: '__CAMPUS__', label: 'Campus Name', category: 'School' },
  { id: '__DATE__', label: 'Current Date', category: 'System' },
];

// Group fields by category
const GROUPED_FIELDS = PLACEHOLDER_FIELDS.reduce((acc, field) => {
  if (!acc[field.category]) acc[field.category] = [];
  acc[field.category].push(field);
  return acc;
}, {} as Record<string, typeof PLACEHOLDER_FIELDS>);

export default function PrintLettersPage() {
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;
  
  // State for filters
  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // State for selections
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedField, setSelectedField] = useState<string>("");
  
  // State for data
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Letter content
  const [letterContent, setLetterContent] = useState<string>("");
  
  // Hooks for academics data
  const { gradeLevels } = useGradeLevels();
  const { sections } = useSections();
  
  // Filter sections by selected grade level
  const filteredSections = useMemo(() => {
    if (!selectedGradeLevel) return sections;
    return sections.filter(s => s.grade_level_id === selectedGradeLevel);
  }, [sections, selectedGradeLevel]);
  
  // Rich text editor ref
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Load students when filters change
  useEffect(() => {
    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const response = await getStudents({
          page: 1,
          limit: 500,
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
  }, [selectedGradeLevel, searchQuery, selectedCampus?.id]);
  
  // Filter students by section
  const filteredStudents = useMemo(() => {
    if (!selectedSection) return students;
    return students.filter(s => {
      const studentWithSection = s as Student & { section_id?: string };
      return studentWithSection.section_id === selectedSection;
    });
  }, [students, selectedSection]);
  
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
  
  // Format commands for rich text editor
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);
  
  // Insert placeholder at cursor position
  const insertPlaceholder = (placeholder: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertText', false, placeholder);
    }
    setSelectedField("");
  };
  
  // Copy placeholder to clipboard
  const copyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(placeholder);
    toast.success(`Copied ${placeholder} to clipboard`);
  };
  
  // Get student display name
  const getStudentName = (student: Student) => {
    const profile = student.profile;
    if (!profile) return student.student_number;
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || student.student_number;
  };
  
  // Get full name for a student
  const getFullName = (student: Student) => {
    const profile = student.profile;
    if (!profile) return '';
    const parts = [
      profile.first_name,
      profile.father_name,
      profile.grandfather_name,
      profile.last_name
    ].filter(Boolean);
    return parts.join(' ');
  };
  
  // Replace placeholders with student data
  const replacePlaceholders = (content: string, student: Student): string => {
    const profile = student.profile || {};
    const studentWithAcademics = student as Student & { 
      grade_level_name?: string; 
      section_name?: string;
      grade_level?: string;
    };
    
    return content
      .replace(/__FIRST_NAME__/g, profile.first_name || '')
      .replace(/__FATHER_NAME__/g, profile.father_name || '')
      .replace(/__GRANDFATHER_NAME__/g, profile.grandfather_name || '')
      .replace(/__LAST_NAME__/g, profile.last_name || '')
      .replace(/__FULL_NAME__/g, getFullName(student))
      .replace(/__EMAIL__/g, profile.email || '')
      .replace(/__PHONE__/g, profile.phone || '')
      .replace(/__STUDENT_ID__/g, student.student_number || '')
      .replace(/__GRADE_LEVEL__/g, studentWithAcademics.grade_level_name || studentWithAcademics.grade_level || '')
      .replace(/__SECTION__/g, studentWithAcademics.section_name || '')
      .replace(/__CAMPUS__/g, selectedCampus?.name || '')
      .replace(/__DATE__/g, new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }));
  };
  
  // Handle print
  const handlePrint = () => {
    if (selectedStudentIds.length === 0) {
      toast.error('Please select at least one student');
      return;
    }
    
    const content = editorRef.current?.innerHTML || '';
    if (!content.trim()) {
      toast.error('Please write a letter first');
      return;
    }
    
    setLetterContent(content);
    setIsPrinting(true);
    
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      toast.success('Print dialog opened');
    }, 100);
  };
  
  // Get selected students for printing
  const selectedStudents = useMemo(() => {
    return students.filter(s => selectedStudentIds.includes(s.id));
  }, [students, selectedStudentIds]);
  
  return (
    <>
      {/* Print Area - Only visible when printing */}
      {letterContent && (
        <div className="hidden print:block">
          {selectedStudents.map((student, index) => (
            <div 
              key={student.id} 
              className="letter-page"
              style={{ 
                pageBreakAfter: index < selectedStudents.length - 1 ? 'always' : 'avoid'
              }}
            >
              <div 
                className="letter-content"
                dangerouslySetInnerHTML={{ 
                  __html: replacePlaceholders(letterContent, student) 
                }}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Main UI - Hidden when printing */}
      <div className="container mx-auto py-6 space-y-6 print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link href="/admin/students" className="hover:text-foreground">
                Students
              </Link>
              <span>/</span>
              <span>Print Letters</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Print Letters</h1>
            <p className="text-muted-foreground">
              Write a letter template and print personalized letters for selected students
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
          {/* Left Panel - Letter Editor */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Letter Editor
              </CardTitle>
              <CardDescription>
                Write your letter and use placeholders for personalized content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Placeholder Field Selector */}
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <Label className="text-sm font-medium whitespace-nowrap">Insert Field:</Label>
                <Select 
                  value={selectedField} 
                  onValueChange={(value) => {
                    if (value) {
                      insertPlaceholder(value);
                    }
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a field to insert" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GROUPED_FIELDS).map(([category, fields]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {category}
                        </div>
                        {fields.map((field) => (
                          <SelectItem key={field.id} value={field.id}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2 ml-auto">
                  {selectedField && (
                    <>
                      <code className="px-2 py-1 bg-background rounded text-sm">
                        {selectedField}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyPlaceholder(selectedField)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Formatting Toolbar */}
              <div className="flex items-center gap-1 p-2 border rounded-t-lg bg-muted/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => execCommand('bold')}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => execCommand('italic')}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => execCommand('underline')}
                  title="Underline"
                >
                  <Underline className="h-4 w-4" />
                </Button>
                
                <Separator orientation="vertical" className="h-6 mx-1" />
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => execCommand('justifyLeft')}
                  title="Align Left"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => execCommand('justifyCenter')}
                  title="Align Center"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => execCommand('justifyRight')}
                  title="Align Right"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
                
                <Separator orientation="vertical" className="h-6 mx-1" />
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => execCommand('insertUnorderedList')}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => execCommand('insertOrderedList')}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
                
                <Separator orientation="vertical" className="h-6 mx-1" />
                
                <Select onValueChange={(value) => execCommand('fontSize', value)}>
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Small</SelectItem>
                    <SelectItem value="3">Normal</SelectItem>
                    <SelectItem value="5">Large</SelectItem>
                    <SelectItem value="7">Huge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Rich Text Editor */}
              <div
                ref={editorRef}
                contentEditable
                className="min-h-[400px] p-4 border border-t-0 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-primary/20 prose max-w-none"
                style={{ minHeight: '400px' }}
                onInput={() => {
                  // Keep content in sync if needed
                }}
                suppressContentEditableWarning
              >
                <p>Dear __FIRST_NAME__,</p>
                <br />
                <p>Write your letter content here...</p>
                <br />
                <p>Best regards,</p>
                <p>__CAMPUS__</p>
              </div>
              
              {/* Available Fields Reference */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Available Placeholders (click to copy):
                </p>
                <div className="flex flex-wrap gap-2">
                  {PLACEHOLDER_FIELDS.map((field) => (
                    <Badge
                      key={field.id}
                      variant="secondary"
                      className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900"
                      onClick={() => copyPlaceholder(field.id)}
                    >
                      {field.id}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Right Panel - Student Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Students
              </CardTitle>
              <CardDescription>
                Choose students to receive the letter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                <div>
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
                
                <div>
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
              
              <Separator />
              
              {/* Select All */}
              <div className="flex items-center justify-between">
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
                      Select All
                    </>
                  )}
                </Button>
                <Badge variant="outline">
                  {selectedStudentIds.length} selected
                </Badge>
              </div>
              
              {/* Student List */}
              <div className="h-64 overflow-y-auto space-y-2">
                {loadingStudents ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Users className="h-8 w-8 mb-2" />
                    <p className="text-sm">No students found</p>
                  </div>
                ) : (
                  filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedStudentIds.includes(student.id)
                          ? 'bg-primary/5 border-primary/20'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleStudent(student.id)}
                    >
                      <Checkbox
                        checked={selectedStudentIds.includes(student.id)}
                        onCheckedChange={() => toggleStudent(student.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{getStudentName(student)}</p>
                        <p className="text-xs text-muted-foreground">{student.student_number}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Action Bar */}
        <Card className="bg-muted/30">
          <CardContent className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedStudentIds.length}</span> students selected
            </div>
            <Button 
              onClick={handlePrint}
              disabled={isPrinting || selectedStudentIds.length === 0}
              size="lg"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Letters ({selectedStudentIds.length})
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
          .letter-page {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.6;
          }
          .letter-content p {
            margin: 0 0 1em 0;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
        }
      `}</style>
    </>
  );
}
