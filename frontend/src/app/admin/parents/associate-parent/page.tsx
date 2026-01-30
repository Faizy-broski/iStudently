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

export default function AssociateParentPage() {
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
              label: fullName || 'N/A',
              subtitle: `${p.profile?.email || 'No email'} • ${childrenCount} children`
            };
          });

          setParentOptions(options);
        } else {
          setParentOptions([]);
        }
      } catch (error) {
        console.error("Error fetching parents:", error);
        toast.error("Failed to fetch parents");
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
        toast.error("Failed to fetch students");
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
      toast.error("Please select a parent/guardian");
      return;
    }
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student");
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
        toast.success(`Successfully associated ${successCount} student(s) with parent`);
        setSelectedParent("");
        setSelectedStudents([]);
        setSearchStudent("");
        setGradeFilter("all");
      } else {
        toast.warning(`Associated ${successCount} of ${selectedStudents.length} students`);
      }
    } catch (error) {
      console.error("Error associating students:", error);
      toast.error("Failed to associate students");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedStudentObjects = students.filter((s) => selectedStudents.includes(s.id));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
          Associate Parent with Students
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Link existing parents/guardians with their children
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Select Parent */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-4">Select Parent/Guardian</h2>
              <div className="space-y-4">
                <div>
                  <Label>Search Parent/Guardian by Name or ID</Label>
                  <Combobox
                    options={parentOptions}
                    value={selectedParent}
                    onValueChange={setSelectedParent}
                    onSearchChange={setParentSearchQuery}
                    placeholder={isLoadingParents ? "Loading..." : "Search parent by name, email..."}
                    emptyMessage="No parents found. Try a different search."
                    searchPlaceholder="Type to search parents..."
                    disabled={isLoadingParents}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {isLoadingParents && (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Searching parents...
                      </span>
                    )}
                    {!isLoadingParents && parentOptions.length > 0 && (
                      <span>Found {parentOptions.length} parent(s)</span>
                    )}
                  </p>
                </div>

                {selectedParentDetails && (
                  <div className="p-4 bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10 rounded-lg">
                    <p className="text-sm font-medium">Selected Parent</p>
                    <p className="text-lg font-semibold">
                      {`${selectedParentDetails.profile?.first_name || ''} ${selectedParentDetails.profile?.last_name || ''}`.trim() || 'N/A'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedParentDetails.profile?.email || 'No email'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedParentDetails.profile?.phone || 'No phone'}
                    </p>
                    <Badge className="mt-2 bg-blue-100 text-blue-800">
                      {selectedParentDetails.children?.length || 0} Existing Children
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
              <h2 className="text-lg font-semibold mb-4">Select Students</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or ID..."
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    <SelectItem value="Grade 9">Grade 9</SelectItem>
                    <SelectItem value="Grade 10">Grade 10</SelectItem>
                    <SelectItem value="Grade 11">Grade 11</SelectItem>
                    <SelectItem value="Grade 12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(debouncedStudentSearch || gradeFilter !== "all") && (
                <p className="text-xs text-muted-foreground mb-2">
                  Found {students.length} student(s)
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
                    No students found
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
                      <p className="font-medium text-sm">{fullName || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">
                        {student.student_number} • {student.grade_level || 'N/A'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedStudents.includes(student.id) ? "secondary" : "outline"}
                      onClick={() => handleAddStudent(student.id)}
                      disabled={selectedStudents.includes(student.id)}
                    >
                      {selectedStudents.includes(student.id) ? "Added" : "Add"}
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
              Selected Students ({selectedStudents.length})
            </h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-linear-to-r from-[#57A3CC]/10 to-[#022172]/10">
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedStudentObjects.map((student) => {
                    const fullName = `${student.profile?.first_name || ''} ${student.profile?.last_name || ''}`.trim();
                    return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.student_number}</TableCell>
                      <TableCell>{fullName || 'N/A'}</TableCell>
                      <TableCell>{student.grade_level || 'N/A'}</TableCell>
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
              <h3 className="text-md font-semibold mb-4">Relationship Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">
                These settings will apply to all selected students
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Relationship</Label>
                  <Select value={relationship} onValueChange={(value: "mother" | "father" | "guardian") => setRelationship(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
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
                      Mark as Emergency Contact
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
          Clear All
        </Button>
        <Button
          onClick={handleAssociate}
          disabled={!selectedParent || selectedStudents.length === 0 || isSubmitting}
          className="w-full sm:w-auto bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Associating...
            </>
          ) : (
            <>
              <Link2 className="mr-2 h-4 w-4" />
              Associate Parent with {selectedStudents.length} Student(s)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
