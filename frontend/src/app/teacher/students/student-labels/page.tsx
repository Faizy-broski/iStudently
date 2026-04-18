"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tag, Users, Search, CheckSquare, Square, Loader2, Building2, Printer } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useCampus } from "@/context/CampusContext";
import { useGradeLevels, useSections } from "@/hooks/useAcademics";
import { getStudents, Student } from "@/lib/api/students";

export default function TeacherStudentLabelsPage() {
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  const [selectedGradeLevel, setSelectedGradeLevel] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [columns, setColumns] = useState<string>("3");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const { gradeLevels } = useGradeLevels();
  const { sections } = useSections();

  const filteredSections = useMemo(() => {
    if (!selectedGradeLevel) return sections;
    return sections.filter(s => s.grade_level_id === selectedGradeLevel);
  }, [sections, selectedGradeLevel]);

  useEffect(() => {
    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const response = await getStudents({ page: 1, limit: 500, search: searchQuery || undefined, grade_level: selectedGradeLevel || undefined, campus_id: selectedCampus?.id });
        if (response.success && response.data) setStudents(response.data);
      } catch { toast.error('Failed to load students'); }
      finally { setLoadingStudents(false); }
    };
    const debounceTimer = setTimeout(loadStudents, 300);
    return () => clearTimeout(debounceTimer);
  }, [selectedGradeLevel, searchQuery, selectedCampus?.id]);

  const filteredStudents = useMemo(() => {
    if (!selectedSection) return students;
    return students.filter(s => (s as any).section_id === selectedSection);
  }, [students, selectedSection]);

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
  };

  const toggleAllStudents = () => {
    if (selectedStudentIds.length === filteredStudents.length) setSelectedStudentIds([]);
    else setSelectedStudentIds(filteredStudents.map(s => s.id));
  };

  const getStudentName = (student: Student) => {
    const profile = student.profile;
    if (!profile) return student.student_number;
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || student.student_number;
  };

  const selectedStudents = useMemo(() => students.filter(s => selectedStudentIds.includes(s.id)), [students, selectedStudentIds]);

  const handlePrint = () => {
    if (selectedStudentIds.length === 0) { toast.error('Please select at least one student'); return; }
    setIsPrinting(true);

    const cols = parseInt(columns);
    const labelWidth = 100 / cols;
    const labelsHtml = selectedStudents.map(student => {
      const name = getStudentName(student);
      const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
      return `
        <div style="width:${labelWidth}%; box-sizing:border-box; padding:8px; display:inline-block; vertical-align:top;">
          <div style="border:2px dashed #d1d5db; border-radius:8px; padding:12px; display:flex; align-items:center; gap:10px; page-break-inside:avoid;">
            <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#57A3CC,#022172);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0;">${initials}</div>
            <div style="min-width:0;">
              <p style="font-weight:600;font-size:13px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</p>
              <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">#${student.student_number}</p>
              ${student.grade_level ? `<p style="font-size:11px;color:#6b7280;margin:0;">${student.grade_level}</p>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Student Labels</title>
      <style>body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:20px;background:#fff;}
      @media print{body{margin:0;padding:10px;}.no-print{display:none!important;}}</style>
      </head><body>
      <div class="no-print" style="margin-bottom:16px;display:flex;gap:8px;align-items:center;">
        <span style="font-size:14px;color:#6b7280;">${selectedStudents.length} labels</span>
        <button onclick="window.print()" style="padding:8px 16px;background:#022172;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">Print</button>
        <button onclick="window.close()" style="padding:8px 16px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:14px;">Close</button>
      </div>
      <div style="font-size:0;">${labelsHtml}</div></body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    setIsPrinting(false);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/teacher/students" className="hover:text-foreground">Students</Link>
            <span>/</span>
            <span>Print Student Labels</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Print Student Labels</h1>
          <p className="text-muted-foreground">Select students and generate printable name labels</p>
        </div>
        {selectedCampus && (
          <Badge variant="outline" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {selectedCampus.name}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Label Settings */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" />Label Settings</CardTitle>
            <CardDescription>Configure how labels are laid out</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Columns per row</Label>
              <Select value={columns} onValueChange={setColumns}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 columns</SelectItem>
                  <SelectItem value="3">3 columns</SelectItem>
                  <SelectItem value="4">4 columns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Each label includes:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Student full name</li>
                <li>Student ID number</li>
                <li>Grade level</li>
              </ul>
            </div>
            <div className="pt-4">
              <Badge variant="secondary" className="w-full justify-center py-2">
                {selectedStudentIds.length} students selected
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Student Selection */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Select Students</CardTitle>
            <CardDescription>Filter and select students to print labels for</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Grade Level</Label>
                <Select value={selectedGradeLevel} onValueChange={(value) => { setSelectedGradeLevel(value === "all" ? "" : value); setSelectedSection(""); }}>
                  <SelectTrigger><SelectValue placeholder="All Grades" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {gradeLevels.map((grade) => (<SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Section</Label>
                <Select value={selectedSection} onValueChange={(value) => setSelectedSection(value === "all" ? "" : value)} disabled={!selectedGradeLevel}>
                  <SelectTrigger><SelectValue placeholder="All Sections" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {filteredSections.map((section) => (<SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <Button variant="ghost" size="sm" onClick={toggleAllStudents} className="text-sm">
                {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (<><CheckSquare className="mr-2 h-4 w-4" />Deselect All</>) : (<><Square className="mr-2 h-4 w-4" />Select All ({filteredStudents.length})</>)}
              </Button>
              <Badge variant="outline">{selectedStudentIds.length} of {filteredStudents.length} selected</Badge>
            </div>

            <div className="h-80 overflow-y-auto">
              {loadingStudents ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Users className="h-8 w-8 mb-2" /><p>No students found</p><p className="text-xs">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {filteredStudents.map((student) => (
                    <div key={student.id} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedStudentIds.includes(student.id) ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/50'}`} onClick={() => toggleStudent(student.id)}>
                      <div className="flex items-center gap-3">
                        <Checkbox checked={selectedStudentIds.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} />
                        <div>
                          <p className="font-medium">{getStudentName(student)}</p>
                          <p className="text-sm text-muted-foreground">{student.student_number} • {student.grade_level || 'No Grade'}</p>
                        </div>
                      </div>
                      {student.profile?.is_active ? (
                        <Badge variant="outline" className="text-green-600 border-green-200">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-200">Inactive</Badge>
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
            <span className="font-medium text-foreground">{selectedStudentIds.length}</span> students selected
          </div>
          <Button onClick={handlePrint} disabled={isPrinting || selectedStudentIds.length === 0} size="lg">
            {isPrinting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : (<><Printer className="mr-2 h-4 w-4" />Print Labels ({selectedStudentIds.length})</>)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
