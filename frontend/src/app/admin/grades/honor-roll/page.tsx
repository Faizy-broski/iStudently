"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import * as academicsApi from "@/lib/api/academics";
import { toast } from "sonner";
import {
  Award,
  Loader2,
  Trophy,
  Medal,
  Copy,
  Check,
  Upload,
  FileText,
  ListOrdered,
  Printer,
  X,
  Image as ImageIcon,
  Users,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// ============================================================================
// SUBSTITUTION TOKENS
// ============================================================================

const SUBSTITUTION_TOKENS: Record<string, string> = {
  "__FIRST_NAME__": "First Name",
  "__LAST_NAME__": "Last Name",
  "__FULL_NAME__": "Full Name",
  "__EMAIL__": "Email",
  "__PHONE__": "Phone",
  "__PHOTO_URL__": "Photo URL",
  "__STUDENT_ID__": "Student ID",
  "__STUDENT_NUMBER__": "Student Number",
  "__ADMISSION_NUMBER__": "Admission Number",
  "__ROLL_NUMBER__": "Roll Number",
  "__REGISTRATION_NUMBER__": "Registration Number",
  "__GRADE_LEVEL__": "Grade Level",
  "__CLASS_NAME__": "Class Name",
  "__SECTION__": "Section",
  "__SECTION_NAME__": "Section Name",
  "__ACADEMIC_YEAR__": "Academic Year",
  "__HONOR_LEVEL__": "Honor Level",
  "__ADMISSION_DATE__": "Admission Date",
  "__JOINING_DATE__": "Joining Date",
  "__DATE_OF_BIRTH__": "Date of Birth",
  "__AGE__": "Age",
  "__GENDER__": "Gender",
  "__BLOOD_GROUP__": "Blood Group",
  "__NATIONALITY__": "Nationality",
  "__RELIGION__": "Religion",
  "__CASTE__": "Caste",
  "__MOTHER_TONGUE__": "Mother Tongue",
  "__ADDRESS__": "Address",
  "__STREET_ADDRESS__": "Street Address",
  "__CITY__": "City",
  "__STATE__": "State",
  "__COUNTRY__": "Country",
  "__POSTAL_CODE__": "Postal Code",
  "__PERMANENT_ADDRESS__": "Permanent Address",
  "__CURRENT_ADDRESS__": "Current Address",
  "__FATHER_NAME__": "Father Name",
  "__MOTHER_NAME__": "Mother Name",
  "__PARENT_NAME__": "Parent Name",
  "__GUARDIAN_NAME__": "Guardian Name",
  "__PARENT_PHONE__": "Parent Phone",
  "__FATHER_PHONE__": "Father Phone",
  "__MOTHER_PHONE__": "Mother Phone",
  "__PARENT_EMAIL__": "Parent Email",
  "__FATHER_OCCUPATION__": "Father Occupation",
  "__MOTHER_OCCUPATION__": "Mother Occupation",
  "__EMERGENCY_CONTACT__": "Emergency Contact",
  "__EMERGENCY_PHONE__": "Emergency Phone",
  "__EMERGENCY_NAME__": "Emergency Name",
  "__EMERGENCY_RELATION__": "Emergency Relation",
  "__MEDICAL_CONDITIONS__": "Medical Conditions",
  "__ALLERGIES__": "Allergies",
  "__MEDICATIONS__": "Medications",
  "__SPECIAL_NEEDS__": "Special Needs",
  "__BUS_ROUTE__": "Bus Route",
  "__TRANSPORT_MODE__": "Transport Mode",
  "__PICKUP_POINT__": "Pickup Point",
  "__DROP_POINT__": "Drop Point",
  "__CAMPUS_NAME__": "Campus Name",
  "__CAMPUS_ADDRESS__": "Campus Address",
  "__CAMPUS_PHONE__": "Campus Phone",
  "__CAMPUS_CODE__": "Campus Code",
  "__CAMPUS_EMAIL__": "Campus Email",
  "__SCHOOL_NAME__": "School Name",
  "__SCHOOL_ADDRESS__": "School Address",
  "__SCHOOL_PHONE__": "School Phone",
  "__SCHOOL_EMAIL__": "School Email",
  "__SCHOOL_LOGO__": "School Logo",
  "__SCHOOL_WEBSITE__": "School Website",
  "__SCHOOL_MOTTO__": "School Motto",
  "__CURRENT_DATE__": "Current Date",
  "__CURRENT_YEAR__": "Current Year",
  "__ISSUE_DATE__": "Issue Date",
};

const TOKEN_CATEGORIES: Record<string, string[]> = {
  "Basic Info": [
    "__FULL_NAME__", "__FIRST_NAME__", "__LAST_NAME__", "__EMAIL__",
    "__PHONE__", "__PHOTO_URL__",
  ],
  "Student ID": [
    "__STUDENT_ID__", "__STUDENT_NUMBER__", "__ADMISSION_NUMBER__",
    "__ROLL_NUMBER__", "__REGISTRATION_NUMBER__",
  ],
  "Academic": [
    "__GRADE_LEVEL__", "__CLASS_NAME__", "__SECTION__", "__SECTION_NAME__",
    "__ACADEMIC_YEAR__", "__HONOR_LEVEL__",
  ],
  "Personal": [
    "__ADMISSION_DATE__", "__JOINING_DATE__", "__DATE_OF_BIRTH__",
    "__AGE__", "__GENDER__", "__BLOOD_GROUP__", "__NATIONALITY__",
    "__RELIGION__", "__CASTE__", "__MOTHER_TONGUE__",
  ],
  "Address": [
    "__ADDRESS__", "__STREET_ADDRESS__", "__CITY__", "__STATE__",
    "__COUNTRY__", "__POSTAL_CODE__", "__PERMANENT_ADDRESS__",
    "__CURRENT_ADDRESS__",
  ],
  "Parent/Guardian": [
    "__FATHER_NAME__", "__MOTHER_NAME__", "__PARENT_NAME__",
    "__GUARDIAN_NAME__", "__PARENT_PHONE__", "__FATHER_PHONE__",
    "__MOTHER_PHONE__", "__PARENT_EMAIL__", "__FATHER_OCCUPATION__",
    "__MOTHER_OCCUPATION__",
  ],
  "Emergency": [
    "__EMERGENCY_CONTACT__", "__EMERGENCY_PHONE__",
    "__EMERGENCY_NAME__", "__EMERGENCY_RELATION__",
  ],
  "Medical": [
    "__MEDICAL_CONDITIONS__", "__ALLERGIES__", "__MEDICATIONS__",
    "__SPECIAL_NEEDS__",
  ],
  "Transport": [
    "__BUS_ROUTE__", "__TRANSPORT_MODE__", "__PICKUP_POINT__",
    "__DROP_POINT__",
  ],
  "Campus/School": [
    "__CAMPUS_NAME__", "__CAMPUS_ADDRESS__", "__CAMPUS_PHONE__",
    "__CAMPUS_CODE__", "__CAMPUS_EMAIL__", "__SCHOOL_NAME__",
    "__SCHOOL_ADDRESS__", "__SCHOOL_PHONE__", "__SCHOOL_EMAIL__",
    "__SCHOOL_LOGO__", "__SCHOOL_WEBSITE__", "__SCHOOL_MOTTO__",
  ],
  "Dates": [
    "__CURRENT_DATE__", "__CURRENT_YEAR__", "__ISSUE_DATE__",
  ],
};

const HONOR_LEVELS = [
  { value: "high_honor", label: "High Honor Roll", icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
  { value: "honor", label: "Honor Roll", icon: Medal, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
];

const DEFAULT_CERTIFICATE_HTML = `<div style="text-align: center; font-family: 'Times New Roman', serif; padding: 40px;">
  <h1 style="font-size: 36px; color: #022172; margin-bottom: 10px;">Certificate of Achievement</h1>
  <p style="font-size: 18px; color: #666; margin-bottom: 30px;">__SCHOOL_NAME__</p>
  <p style="font-size: 16px; margin-bottom: 10px;">This is to certify that</p>
  <h2 style="font-size: 28px; color: #0369a1; margin: 20px 0;">__FULL_NAME__</h2>
  <p style="font-size: 16px; margin-bottom: 5px;">of Grade __GRADE_LEVEL__ � Section __SECTION_NAME__</p>
  <p style="font-size: 16px; margin-bottom: 20px;">has been placed on the</p>
  <h3 style="font-size: 24px; color: #022172; margin: 15px 0;">__HONOR_LEVEL__</h3>
  <p style="font-size: 16px; margin-bottom: 30px;">for the Academic Year __ACADEMIC_YEAR__</p>
  <div style="display: flex; justify-content: space-between; margin-top: 50px; padding: 0 60px;">
    <div style="text-align: center;">
      <div style="border-top: 1px solid #333; width: 200px; margin-top: 40px; padding-top: 5px;">Principal</div>
    </div>
    <div style="text-align: center;">
      <p style="margin-bottom: 0;">__CURRENT_DATE__</p>
      <div style="border-top: 1px solid #333; width: 200px; margin-top: 5px; padding-top: 5px;">Date</div>
    </div>
  </div>
</div>`;

// ============================================================================
// COMPONENT
// ============================================================================

export default function HonorRollPage() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // Mode: list or certificates
  const [mode, setMode] = useState<"list" | "certificates">("list");

  // Filters
  const [markingPeriods, setMarkingPeriods] = useState<gradesApi.MarkingPeriodOption[]>([]);
  const [academicYears, setAcademicYears] = useState<academicsApi.AcademicYear[]>([]);
  const [selectedMp, setSelectedMp] = useState("");
  const [selectedAy, setSelectedAy] = useState("");

  // Data
  const [students, setStudents] = useState<gradesApi.HonorRollStudent[]>([]);
  const [loading, setLoading] = useState(false);

  // Certificate mode
  const [certificateHtml, setCertificateHtml] = useState(DEFAULT_CERTIFICATE_HTML);
  const [selectedToken, setSelectedToken] = useState("__FULL_NAME__");
  const [copied, setCopied] = useState(false);
  const [frameImage, setFrameImage] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Group students by honor level
  const groupedStudents = useMemo(() => {
    const groups: Record<string, gradesApi.HonorRollStudent[]> = {};
    students.forEach((s) => {
      const level = s.honor_level || "honor";
      if (!groups[level]) groups[level] = [];
      groups[level].push(s);
    });
    return groups;
  }, [students]);

  // --------------------------------------------------------------------------
  // Load reference data
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return;

    Promise.all([
      gradesApi.getMarkingPeriods(selectedCampus?.id),
      academicsApi.getAcademicYears(),
    ]).then(([mpRes, ayArr]) => {
      const mpData = Array.isArray(mpRes) ? mpRes : mpRes?.data || [];
      setMarkingPeriods(mpData);
      if (mpData.length > 0 && !selectedMp) setSelectedMp(mpData[0].id);

      setAcademicYears(ayArr);
      const current = ayArr.find((a: academicsApi.AcademicYear) => a.is_current);
      if (current && !selectedAy) setSelectedAy(current.id);
    }).catch((err: unknown) => {
      console.error("Failed to load reference data:", err);
      toast.error("Failed to load reference data");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedCampus?.id]);

  // --------------------------------------------------------------------------
  // Load honor roll students (auto-fetch when filters change)
  // --------------------------------------------------------------------------

  const loadStudents = useCallback(async () => {
    if (!user || !selectedMp) return;
    setLoading(true);
    try {
      const res = await gradesApi.getHonorRoll({
        marking_period_id: selectedMp,
        academic_year_id: selectedAy || undefined,
        campus_id: selectedCampus?.id,
      });
      const data = Array.isArray(res) ? res : res?.data || [];
      setStudents(data);
    } catch {
      toast.error("Failed to load honor roll students");
    } finally {
      setLoading(false);
    }
  }, [user, selectedMp, selectedAy, selectedCampus?.id]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // --------------------------------------------------------------------------
  // Certificate helpers
  // --------------------------------------------------------------------------

  const handleCopyToken = () => {
    navigator.clipboard.writeText(selectedToken);
    setCopied(true);
    toast.success(`Copied ${selectedToken} to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertTokenInEditor = () => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand("insertText", false, selectedToken);
      setCertificateHtml(editorRef.current.innerHTML);
    }
  };

  const handleFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFrameImage(ev.target?.result as string);
      toast.success("Frame image uploaded");
    };
    reader.readAsDataURL(file);
  };

  const removeFrameImage = () => {
    setFrameImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const selectAllStudents = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s) => s.student_id)));
    }
  };

  const execCmd = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setCertificateHtml(editorRef.current.innerHTML);
    }
  };

  // Substitute tokens in certificate HTML for a specific student
  const substituteForStudent = (html: string, student: gradesApi.HonorRollStudent): string => {
    let result = html;
    const currentAy = academicYears.find((a) => a.id === selectedAy);
    const honorInfo = HONOR_LEVELS.find((h) => h.value === student.honor_level);

    const replacements: Record<string, string> = {
      "__FIRST_NAME__": student.first_name || "N/A",
      "__LAST_NAME__": student.last_name || "N/A",
      "__FULL_NAME__": `${student.first_name} ${student.last_name}`.trim() || "N/A",
      "__STUDENT_NUMBER__": student.student_number || "N/A",
      "__GRADE_LEVEL__": student.grade_level || "N/A",
      "__CLASS_NAME__": student.section || "N/A",
      "__SECTION__": student.section || "N/A",
      "__SECTION_NAME__": student.section || "N/A",
      "__ACADEMIC_YEAR__": currentAy?.name || "N/A",
      "__HONOR_LEVEL__": honorInfo?.label || "Honor Roll",
      "__SCHOOL_NAME__": selectedCampus?.name || "N/A",
      "__CAMPUS_NAME__": selectedCampus?.name || "N/A",
      "__CURRENT_DATE__": new Date().toLocaleDateString(),
      "__CURRENT_YEAR__": new Date().getFullYear().toString(),
      "__ISSUE_DATE__": new Date().toLocaleDateString(),
    };

    Object.entries(replacements).forEach(([token, value]) => {
      result = result.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
    });

    // Replace any remaining tokens with N/A
    result = result.replace(/__[A-Z_]+__/g, "N/A");

    return result;
  };

  const handlePrintCertificates = () => {
    if (selectedStudents.size === 0) {
      toast.error("Please select at least one student");
      return;
    }

    const selectedList = students.filter((s) => selectedStudents.has(s.student_id));
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to print certificates");
      return;
    }

    let html = `<!DOCTYPE html><html><head><title>Honor Roll Certificates</title>
      <style>
        @page { size: landscape; margin: 0; }
        body { margin: 0; padding: 0; }
        .certificate-page {
          width: 100vw; height: 100vh;
          page-break-after: always;
          display: flex; align-items: center; justify-content: center;
          position: relative; box-sizing: border-box;
        }
        .certificate-page:last-child { page-break-after: auto; }
        .certificate-frame {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          width: 100%; height: 100%; object-fit: contain; z-index: 0;
        }
        .certificate-content {
          position: relative; z-index: 1;
          width: 80%; max-width: 900px;
        }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>`;

    selectedList.forEach((student) => {
      const content = substituteForStudent(certificateHtml, student);
      html += `<div class="certificate-page">`;
      if (frameImage) {
        html += `<img class="certificate-frame" src="${frameImage}" />`;
      }
      html += `<div class="certificate-content">${content}</div></div>`;
    });

    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };

    toast.success(`Generating ${selectedList.length} certificate(s)...`);
  };

  if (!user) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <Award className="h-8 w-8 text-[#57A3CC]" />
            Honor Roll
          </h1>
          <p className="text-muted-foreground mt-2">
            View honor roll students and generate certificates
            {selectedCampus && (
              <span className="ml-1">
                � <span className="font-medium">{selectedCampus.name}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Mode Toggle + Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "list" | "certificates")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="list" id="mode-list" />
                <Label htmlFor="mode-list" className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <ListOrdered className="h-4 w-4" /> List
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="certificates" id="mode-cert" />
                <Label htmlFor="mode-cert" className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <FileText className="h-4 w-4" /> Certificates
                </Label>
              </div>
            </RadioGroup>

            <div className="flex-1" />

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Marking Period</Label>
                <Select value={selectedMp} onValueChange={setSelectedMp}>
                  <SelectTrigger className="w-50">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    {markingPeriods.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>
                        {mp.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Academic Year</Label>
                <Select value={selectedAy} onValueChange={setSelectedAy}>
                  <SelectTrigger className="w-45">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((ay) => (
                      <SelectItem key={ay.id} value={ay.id}>
                        {ay.name} {ay.is_current && "(Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================== */}
      {/* LIST MODE */}
      {/* ================================================================== */}

      {mode === "list" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-[#0369a1] font-medium">
              {students.length} student{students.length !== 1 ? "s" : ""} on the honor roll
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#0369a1]" />
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">No students found</p>
                <p className="text-sm">
                  Make sure grading scales have Honor Roll GPA thresholds configured
                  and students have final grades entered.
                </p>
              </div>
            ) : (
              HONOR_LEVELS.map(({ value: level, label, icon: Icon, color }) => {
                const studs = groupedStudents[level];
                if (!studs || studs.length === 0) return null;
                return (
                  <div key={level} className="space-y-2">
                    <div className="flex items-center gap-2 pt-2">
                      <Icon className={`h-5 w-5 ${color}`} />
                      <h3 className="font-semibold text-base">{label}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {studs.length}
                      </Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#0369a1] hover:bg-[#0369a1]">
                          <TableHead className="text-white font-semibold w-12">#</TableHead>
                          <TableHead className="text-white font-semibold">Student Name</TableHead>
                          <TableHead className="text-white font-semibold">Student Number</TableHead>
                          <TableHead className="text-white font-semibold">Grade Level</TableHead>
                          <TableHead className="text-white font-semibold">Section</TableHead>
                          <TableHead className="text-white font-semibold">Teacher</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studs.map((s, idx) => (
                          <TableRow
                            key={s.student_id}
                            className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                          >
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium">
                              {s.last_name}, {s.first_name}
                            </TableCell>
                            <TableCell>{s.student_number || "\u2014"}</TableCell>
                            <TableCell>{s.grade_level || "\u2014"}</TableCell>
                            <TableCell>{s.section || "\u2014"}</TableCell>
                            <TableCell>{s.teacher || "\u2014"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* ================================================================== */}
      {/* CERTIFICATES MODE */}
      {/* ================================================================== */}

      {mode === "certificates" && (
        <>
          {/* Certificate Template Editor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#0369a1]" />
                Certificate Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Substitution Token Selector */}
              <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg border">
                <div className="space-y-1 flex-1 min-w-50">
                  <Label className="text-xs text-muted-foreground">Substitution Fields</Label>
                  <Select value={selectedToken} onValueChange={setSelectedToken}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-100">
                      {Object.entries(TOKEN_CATEGORIES).map(([category, tokens]) => (
                        <React.Fragment key={category}>
                          <SelectItem value={`__CAT_${category}__`} disabled>
                            � {category} �
                          </SelectItem>
                          {tokens.map((token) => (
                            <SelectItem key={token} value={token}>
                              {SUBSTITUTION_TOKENS[token]} ({token})
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={handleCopyToken} className="gap-1.5">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  COPY
                </Button>
                <Button variant="outline" onClick={insertTokenInEditor} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  INSERT
                </Button>
              </div>

              {/* Rich Text Toolbar */}
              <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 rounded-t-lg border border-b-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("bold")} title="Bold">
                  <Bold className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("italic")} title="Italic">
                  <Italic className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("underline")} title="Underline">
                  <Underline className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyLeft")} title="Align Left">
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyCenter")} title="Align Center">
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd("justifyRight")} title="Align Right">
                  <AlignRight className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-gray-300 mx-1" />
                <Select onValueChange={(v) => execCmd("fontSize", v)} defaultValue="3">
                  <SelectTrigger className="h-8 w-20 text-xs">
                    <Type className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Small</SelectItem>
                    <SelectItem value="3">Normal</SelectItem>
                    <SelectItem value="5">Large</SelectItem>
                    <SelectItem value="7">Huge</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={(v) => execCmd("foreColor", v)}>
                  <SelectTrigger className="h-8 w-25 text-xs">
                    <SelectValue placeholder="Color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="#000000">Black</SelectItem>
                    <SelectItem value="#022172">Navy</SelectItem>
                    <SelectItem value="#0369a1">Blue</SelectItem>
                    <SelectItem value="#dc2626">Red</SelectItem>
                    <SelectItem value="#16a34a">Green</SelectItem>
                    <SelectItem value="#ca8a04">Gold</SelectItem>
                    <SelectItem value="#7c3aed">Purple</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Editor */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-75 border rounded-b-lg p-4 focus:outline-none focus:ring-2 focus:ring-[#0369a1] bg-white prose max-w-none"
                dangerouslySetInnerHTML={{ __html: certificateHtml }}
                onInput={() => {
                  if (editorRef.current) {
                    setCertificateHtml(editorRef.current.innerHTML);
                  }
                }}
              />

              {/* Frame Image Upload */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
                <div className="flex-1">
                  <Label className="text-sm font-medium flex items-center gap-1.5 mb-1">
                    <ImageIcon className="h-4 w-4" />
                    Certificate Frame / Border Image
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload a decorative border image that will be placed behind the certificate content.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFrameUpload}
                />
                {frameImage ? (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frameImage} alt="Frame preview" className="h-12 w-16 object-cover rounded border" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={removeFrameImage}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                    <Upload className="h-4 w-4" />
                    Upload Frame
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Student Selection */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#0369a1]" />
                  Select Students for Certificates
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedStudents.size} selected</Badge>
                  <Button variant="outline" size="sm" onClick={selectAllStudents}>
                    {selectedStudents.size === students.length && students.length > 0
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0369a1]" />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No honor roll students found.</p>
                  <p className="text-xs mt-1">
                    Ensure grading scales have Honor Roll GPA thresholds and final grades are entered.
                  </p>
                </div>
              ) : (
                <>
                  {HONOR_LEVELS.map(({ value: level, label, icon: Icon, color }) => {
                    const studs = groupedStudents[level];
                    if (!studs || studs.length === 0) return null;
                    return (
                      <div key={level} className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <h4 className="font-semibold text-sm">{label}</h4>
                          <Badge variant="outline" className="text-xs">{studs.length}</Badge>
                        </div>
                        <div className="space-y-1">
                          {studs.map((s) => (
                            <div
                              key={s.student_id}
                              className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-50 cursor-pointer"
                              onClick={() => toggleStudentSelection(s.student_id)}
                            >
                              <Checkbox
                                checked={selectedStudents.has(s.student_id)}
                                onCheckedChange={() => toggleStudentSelection(s.student_id)}
                              />
                              <span className="flex-1 text-sm">
                                {s.last_name}, {s.first_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {s.grade_level} � {s.section}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Generate Button */}
                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      onClick={handlePrintCertificates}
                      disabled={selectedStudents.size === 0}
                      className="bg-[#0369a1] hover:bg-[#022172] gap-2"
                      size="lg"
                    >
                      <Printer className="h-5 w-5" />
                      CREATE HONOR ROLL FOR SELECTED STUDENTS
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
