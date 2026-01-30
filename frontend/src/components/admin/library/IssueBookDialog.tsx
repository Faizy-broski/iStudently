"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, User, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { issueBook, checkStudentEligibility, type Book } from "@/lib/api/library";
import { getStudents, type Student } from "@/lib/api/students";
import { useDebounce } from "@/hooks/useDebounce";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";

const issueBookSchema = z.object({
  student_id: z.string().min(1, "Student selection is required"),
  due_date: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
});

type IssueBookFormData = z.infer<typeof issueBookSchema>;

interface EligibilityCheck {
  eligible: boolean;
  message: string;
  active_loans?: number;
  max_books?: number;
  unpaid_fines?: number;
  warnings?: string[];
}

interface IssueBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Book | null;
  onBookIssued: () => void;
}

export function IssueBookDialog({ open, onOpenChange, book, onBookIssued }: IssueBookDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const debouncedStudentSearch = useDebounce(studentSearch, 400);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [eligibilityCheck, setEligibilityCheck] = useState<EligibilityCheck | null>(null);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  const form = useForm<IssueBookFormData>({
    resolver: zodResolver(issueBookSchema),
    defaultValues: {
      student_id: "",
      due_date: "",
      notes: "",
    },
  });

  // Reset form and state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      // Clean up when closing
      setStudentSearch("");
      setSelectedStudent(null);
      setEligibilityCheck(null);
      setStudents([]);
      setIsSearchingStudents(false);
      setIsCheckingEligibility(false);
      form.reset();
    }
  }, [open, form]);

  // Fetch students with debouncing
  useEffect(() => {
    const fetchStudents = async () => {
      const trimmedSearch = debouncedStudentSearch.trim();
      
      // Don't search if empty or if a student is already selected
      if (!trimmedSearch || selectedStudent) {
        setStudents([]);
        setIsSearchingStudents(false);
        return;
      }

      try {
        setIsSearchingStudents(true);
        console.log('Searching for students:', trimmedSearch);
        
        const response = await getStudents({ search: trimmedSearch, limit: 50 });
        
        console.log('getStudents response:', { success: response.success, dataLength: response.data?.length, error: response.error });
        
        if (response.success && response.data) {
          setStudents(response.data);
          console.log('Found students:', response.data.length);
        } else {
          setStudents([]);
          if (response.error) {
            console.error('Error fetching students:', response.error);
          }
        }
      } catch (err) {
        console.error('Error fetching students:', err);
        setStudents([]);
      } finally {
        setIsSearchingStudents(false);
      }
    };

    fetchStudents();
  }, [debouncedStudentSearch, selectedStudent]);

  // Check student eligibility when selected
  useEffect(() => {
    const checkEligibility = async () => {
      if (!selectedStudent || !user?.access_token) {
        setEligibilityCheck(null);
        return;
      }

      try {
        setIsCheckingEligibility(true);
        // Use profile_id for eligibility check (library system uses profile IDs)
        const studentProfileId = selectedStudent.profile?.id || selectedStudent.profile_id || selectedStudent.id;
        
        const response = await checkStudentEligibility(studentProfileId, user.access_token);
        
        if (response.success && response.data) {
          setEligibilityCheck(response.data);
        } else {
          setEligibilityCheck({
            eligible: false,
            message: response.error || 'Failed to check eligibility'
          });
        }
      } catch (error) {
        console.error("Error checking eligibility:", error);
        setEligibilityCheck({
          eligible: false,
          message: 'Error checking student eligibility'
        });
      } finally {
        setIsCheckingEligibility(false);
      }
    };

    checkEligibility();
  }, [selectedStudent, user?.access_token]);

  // Handle student selection
  const handleStudentSelect = useCallback((student: Student) => {
    setSelectedStudent(student);
    form.setValue("student_id", student.id);
    // Clear search to stop searching
    setStudentSearch("");
    setStudents([]);
  }, [form]);

  // Handle search input change
  const handleSearchChange = useCallback((query: string) => {
    setStudentSearch(query);
    
    // If user starts typing and a student was selected, clear selection
    if (selectedStudent && query.trim()) {
      setSelectedStudent(null);
      form.setValue("student_id", "");
      setEligibilityCheck(null);
    }
  }, [selectedStudent, form]);

  // Submit form
  const onSubmit = async (data: IssueBookFormData) => {
    if (!user?.access_token || !book || !selectedStudent) {
      toast.error('Missing required information');
      return;
    }

    if (!eligibilityCheck?.eligible) {
      toast.error(eligibilityCheck?.message || 'Student is not eligible to borrow books');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Use profile_id for issuing (library_loans.student_id references profiles.id)
      const studentProfileId = selectedStudent.profile?.id || selectedStudent.profile_id || selectedStudent.id;
      const studentName = `${selectedStudent.profile?.first_name || selectedStudent.first_name || ''} ${selectedStudent.profile?.last_name || selectedStudent.last_name || ''}`.trim();

      const response = await issueBook(
        {
          book_id: book.id,
          student_id: studentProfileId,
          due_date: new Date(data.due_date),
          notes: data.notes,
        },
        user.access_token
      );

      if (response.success) {
        toast.success(`Book issued to ${studentName}!`);
        onBookIssued();
        onOpenChange(false);
      } else {
        toast.error(response.error || "Failed to issue book");
      }
    } catch (error) {
      console.error("Error issuing book:", error);
      toast.error("Failed to issue book");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!book) return null;

  // Prepare student options for Combobox
  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.profile?.first_name || ''} ${s.profile?.last_name || ''}`.trim() || 'N/A',
    subtitle: `${s.student_number || 'N/A'} • ${s.grade_level || 'N/A'}`
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-3 w-3 text-primary" />
            </div>
            Issue Book
          </DialogTitle>
          <DialogDescription>
            Issue this book to a student. Student eligibility will be verified automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Book Info */}
        <Card className="border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Book Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Title:</span> {book.title}
              </div>
              <div>
                <span className="font-medium">Author:</span> {book.author}
              </div>
              <div>
                <span className="font-medium">Available Copies:</span> {book.available_copies}
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Student Search */}
            <div className="space-y-2">
              <FormLabel>Search Student *</FormLabel>
              <Combobox
                options={studentOptions}
                value={selectedStudent?.id || ""}
                onValueChange={(val) => {
                  const student = students.find((st) => st.id === val);
                  if (student) {
                    handleStudentSelect(student);
                  }
                }}
                onSearchChange={handleSearchChange}
                placeholder={isSearchingStudents ? "Searching..." : "Type student name or number..."}
                emptyMessage={isSearchingStudents ? "Searching..." : "No students found."}
                searchPlaceholder="Search by name or admission number..."
                className="w-full"
              />
              {isSearchingStudents && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Searching students...
                </p>
              )}
              {!isSearchingStudents && studentOptions.length > 0 && !selectedStudent && (
                <p className="text-xs text-muted-foreground">
                  Found {studentOptions.length} student(s)
                </p>
              )}
            </div>

            {/* Selected Student Info */}
            {selectedStudent && (
              <Card className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Selected Student
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Name:</span>{" "}
                      {selectedStudent.profile?.first_name || selectedStudent.first_name || 'N/A'}{" "}
                      {selectedStudent.profile?.last_name || selectedStudent.last_name || ''}
                    </div>
                    <div>
                      <span className="font-medium">Student Number:</span>{" "}
                      {selectedStudent.student_number || 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Grade:</span>{" "}
                      {selectedStudent.grade_level || 'N/A'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Eligibility Check */}
            {isCheckingEligibility && (
              <Alert className="border-blue-200 bg-blue-50">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                <AlertDescription className="text-blue-800">
                  Checking student eligibility...
                </AlertDescription>
              </Alert>
            )}

            {!isCheckingEligibility && eligibilityCheck && (
              <Alert className={eligibilityCheck.eligible ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                <div className="flex items-start gap-2">
                  {eligibilityCheck.eligible ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={eligibilityCheck.eligible ? "text-green-800" : "text-red-800"}>
                      <div className="font-medium">{eligibilityCheck.message}</div>
                      {eligibilityCheck.active_loans !== undefined && (
                        <div className="text-xs mt-1">
                          Active loans: {eligibilityCheck.active_loans} / {eligibilityCheck.max_books || 3}
                        </div>
                      )}
                      {eligibilityCheck.unpaid_fines && eligibilityCheck.unpaid_fines > 0 && (
                        <div className="text-xs mt-1">
                          Unpaid fines: ${eligibilityCheck.unpaid_fines.toFixed(2)}
                        </div>
                      )}
                    </AlertDescription>
                    {eligibilityCheck.warnings && eligibilityCheck.warnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {eligibilityCheck.warnings.map((warning, index) => (
                          <Badge key={index} variant="outline" className="text-xs mr-1">
                            {warning}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date *</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      min={new Date().toISOString().split('T')[0]}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes..."
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !selectedStudent || !eligibilityCheck?.eligible || isCheckingEligibility}
                className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Issuing...
                  </>
                ) : (
                  "Issue Book"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}