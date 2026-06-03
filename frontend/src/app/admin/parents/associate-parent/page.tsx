"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Link2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { searchParents, linkParentToStudent, type Parent } from "@/lib/api/parents";
import { getStudents, type Student } from "@/lib/api/students";
import { useTranslations } from "next-intl";

export default function AssociateParentPage() {
  const t = useTranslations("parents");
  const [selectedParent, setSelectedParent] = useState<string>("");
  const [parentSearchQuery, setParentSearchQuery] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [relationship, setRelationship] = useState<"mother" | "father" | "guardian">("mother");
  const [isEmergencyContact, setIsEmergencyContact] = useState(false);

  // Debounced search values
  const debouncedParentSearch = useDebounce(parentSearchQuery, 500);
  const debouncedStudentSearch = useDebounce(searchStudent, 500);

  const [parentOptions, setParentOptions] = useState<ComboboxOption[]>([]);

  // Fetch parents from API
  useEffect(() => {
    const fetchParents = async () => {
      setIsLoadingParents(true);
      
      try {
        const response = await searchParents(debouncedParentSearch ? debouncedParentSearch : '');

        if (response.success && response.data) {
          setParents(response.data);
          
          // Convert to combobox options
          const options: ComboboxOption[] = response.data.map(p => {
            const fullName = `${p.profile?.first_name || ''} ${p.profile?.last_name || ''}`.trim();
            const childrenCount = p.children?.length || 0;
            return {
              value: p.id,
              label: fullName || t("na"),
              subtitle: `${p.profile?.email || t("noEmail")} • ${t("childrenCount", { count: childrenCount })}`
            };
          });

          setParentOptions(options);
        } else {
          setParentOptions([]);
        }
      } catch (error) {
        console.error("Error fetching parents:", error);
        toast.error(t("toasts.failedFetchParents"));
        setParentOptions([]);
      } finally {
        setIsLoadingParents(false);
      }
    };

    fetchParents();
  }, [debouncedParentSearch]);

  // Fetch students from API
  useEffect(() => {
    const fetchStudents = async () => {
      setIsLoadingStudents(true);
      
      try {
        const response = await getStudents({
          search: debouncedStudentSearch || undefined,
          grade_level: gradeFilter !== "all" ? gradeFilter : undefined,
          limit: 100, // Get more students for selection
        });

        if (response.success && response.data) {
          setStudents(response.data);
        } else {
          setStudents([]);
        }
      } catch (error) {
        console.error("Error fetching students:", error);
        toast.error(t("toasts.failedFetchStudents"));
        setStudents([]);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [debouncedStudentSearch, gradeFilter]);

  // Get selected parent details
  const selectedParentDetails = parents.find(p => p.id === selectedParent);

  const handleAddStudent = (studentId: string) => {
    if (!selectedStudents.includes(studentId)) {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

  const handleRemoveStudent = (studentId: string) => {
    setSelectedStudents(selectedStudents.filter((id) => id !== studentId));
  };

  const handleAssociate = async () => {
    if (!selectedParent) {
      toast.error(t("validation.selectParent"));
      return;
    }
    if (selectedStudents.length === 0) {
      toast.error(t("validation.selectAtLeastOneStudent"));
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;

    try {
      // Link each selected student to the parent
      for (const studentId of selectedStudents) {
        const response = await linkParentToStudent(
          selectedParent,
          {
            student_id: studentId,
            relationship,
            is_emergency_contact: isEmergencyContact,
          }
        );

        if (response.success) {
          successCount++;
        }
      }

      if (successCount === selectedStudents.length) {
        toast.success(t("toasts.associatedSuccess", { count: successCount }));
        setSelectedParent("");
        setSelectedStudents([]);
        setSearchStudent("");
        setGradeFilter("all");
      } else {
        toast.warning(t("toasts.associatedPartial", { success: successCount, total: selectedStudents.length }));
      }
    } catch (error) {
      console.error("Error associating students:", error);
      toast.error(t("toasts.failedAssociate"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStudentObjects = students.filter((s) => selectedStudents.includes(s.id));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
          {t("associate.title")}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          {t("associate.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Select Parent */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-4">{t("selectParent")}</h2>
              <div className="space-y-4">
                <div>
                  <Label>{t("searchParent")}</Label>
                  <Combobox
                    options={parentOptions}
                    value={selectedParent}
                    onValueChange={setSelectedParent}
                    onSearchChange={setParentSearchQuery}
                    placeholder={isLoadingParents ? t("loading") : t("associate.parentSearchPlaceholder")}
                    emptyMessage={t("associate.noParentsFoundTryDifferent")}
                    searchPlaceholder={t("associate.typeToSearchParents")}
                    disabled={isLoadingParents}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {isLoadingParents && (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("associate.searchingParents")}
                      </span>
                    )}
                    {!isLoadingParents && parentOptions.length > 0 && (
                      <span>{t("associate.foundParentsCount", { count: parentOptions.length })}</span>
                    )}
                  </p>
                </div>

                {selectedParentDetails && (
                  <div className="p-4 bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10 rounded-lg">
                    <p className="text-sm font-medium">{t("selectedParent")}</p>
                    <p className="text-lg font-semibold">
                      {`${selectedParentDetails.profile?.first_name || ''} ${selectedParentDetails.profile?.last_name || ''}`.trim() || t("na")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedParentDetails.profile?.email || t("noEmail")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedParentDetails.profile?.phone || t("noPhone")}
                    </p>
                    <Badge className="mt-2 bg-blue-100 text-blue-800">
                      {t("associate.existingChildrenCount", { count: selectedParentDetails.children?.length || 0 })}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Select Students */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-4">{t("selectStudents")}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("associate.searchStudentsPlaceholder")}
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("associate.filterByGrade")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("associate.allGrades")}</SelectItem>
                    <SelectItem value="Grade 9">{t("associate.grade", { grade: 9 })}</SelectItem>
                    <SelectItem value="Grade 10">{t("associate.grade", { grade: 10 })}</SelectItem>
                    <SelectItem value="Grade 11">{t("associate.grade", { grade: 11 })}</SelectItem>
                    <SelectItem value="Grade 12">{t("associate.grade", { grade: 12 })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(debouncedStudentSearch || gradeFilter !== "all") && (
                <p className="text-xs text-muted-foreground mb-2">
                  {t("associate.foundStudentsCount", { count: students.length })}
                </p>
              )}

              {isLoadingStudents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {students.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    {t("associate.noStudentsFound")}
                  </div>
                ) : (
                  students.map((student: Student) => {
                    const fullName = `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`.trim();
                    return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 border-b last:border-b-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{fullName || t("na")}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.student_number} • {student.grade_level || t("na")}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedStudents.includes(student.id) ? "secondary" : "outline"}
                      onClick={() => handleAddStudent(student.id)}
                      disabled={selectedStudents.includes(student.id)}
                    >
                      {selectedStudents.includes(student.id) ? t("added") : t("add")}
                    </Button>
                  </div>
                  );
                })
                )}
              </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Students */}
      {selectedStudents.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">
              {t("associate.selectedStudentsCount", { count: selectedStudents.length })}
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                    <TableHead>{t("associate.table.studentId")}</TableHead>
                    <TableHead>{t("associate.table.name")}</TableHead>
                    <TableHead>{t("associate.table.grade")}</TableHead>
                    <TableHead className="text-right">{t("associate.table.action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedStudentObjects.map((student) => {
                    const fullName = `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`.trim();
                    return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.student_number}</TableCell>
                      <TableCell>{fullName || t("na")}</TableCell>
                      <TableCell>{student.grade_level || t("na")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveStudent(student.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>

            {/* Relationship and Emergency Contact Settings */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="text-md font-semibold mb-4">{t("relationshipSettings")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("associate.relationshipAppliesAll")}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{t("relationship")}</Label>
                  <Select value={relationship} onValueChange={(value: "mother" | "father" | "guardian") => setRelationship(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mother">{t("mother")}</SelectItem>
                      <SelectItem value="father">{t("father")}</SelectItem>
                      <SelectItem value="guardian">{t("guardian")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="emergencyContact"
                      checked={isEmergencyContact}
                      onChange={(e) => setIsEmergencyContact(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="emergencyContact" className="cursor-pointer text-sm">
                      {t("associate.markAsEmergencyContact")}
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setSelectedParent("");
            setSelectedStudents([]);
            setSearchStudent("");
          }}
          className="w-full sm:w-auto"
        >
          {t("clearAll")}
        </Button>
        <Button
          onClick={handleAssociate}
          disabled={!selectedParent || selectedStudents.length === 0 || isSubmitting}
          className="w-full sm:w-auto bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("associate.associating")}
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              {t("associate.associateWithStudentsCount", { count: selectedStudents.length })}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
