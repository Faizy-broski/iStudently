"use client";

import { useState, useEffect } from "react";
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
import { BookOpen, User, AlertTriangle, DollarSign } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { returnBook, getBookLoans, type BookLoan } from "@/lib/api/library";
import { toast } from "sonner";

const returnBookSchema = z.object({
  loan_id: z.string().min(1, "Loan selection is required"),
  return_condition: z.enum(["excellent", "good", "fair", "poor"], {
    required_error: "Return condition is required",
  }),
  damage_notes: z.string().optional(),
  collected_amount: z.number().min(0, "Collected amount cannot be negative"),
});

type ReturnBookFormData = z.infer<typeof returnBookSchema>;

interface ReturnBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookReturned: () => void;
}

export function ReturnBookDialog({ open, onOpenChange, onBookReturned }: ReturnBookDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookLoans, setBookLoans] = useState<BookLoan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<BookLoan | null>(null);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);

  const form = useForm<ReturnBookFormData>({
    resolver: zodResolver(returnBookSchema),
    defaultValues: {
      loan_id: "",
      return_condition: "good",
      damage_notes: "",
      collected_amount: 0,
    },
  });

  // Search loans when query changes
  useEffect(() => {
    const searchLoans = async () => {
      if (!searchQuery.trim() || !user?.access_token) {
        setBookLoans([]);
        return;
      }

      try {
        setIsLoadingLoans(true);
        console.log('Searching for loans:', searchQuery);
        
        const response = await getBookLoans({ search: searchQuery, status: "active" }, user.access_token);
        
        console.log('getBookLoans response:', { success: response.success, dataLength: response.data?.length });
        
        if (response.success) {
          setBookLoans(response.data || []);
        } else {
          setBookLoans([]);
          console.error('Error searching loans:', response.error);
        }
      } catch (error) {
        console.error("Error searching loans:", error);
        setBookLoans([]);
      } finally {
        setIsLoadingLoans(false);
      }
    };

    const timeoutId = setTimeout(searchLoans, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user?.access_token]);

  const handleLoanSelect = (loan: BookLoan) => {
    setSelectedLoan(loan);
    form.setValue("loan_id", loan.id);
    form.setValue("collected_amount", loan.fine_amount || 0);
    setSearchQuery(`${loan.book_title} - ${loan.student_name} (${loan.accession_number})`);
    setBookLoans([]);
  };

  const onSubmit = async (data: ReturnBookFormData) => {
    if (!user?.access_token || !selectedLoan) {
      toast.error('Missing required information');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Backend only expects collected_amount
      const response = await returnBook(
        selectedLoan.id,
        {
          return_condition: data.return_condition,
          damage_notes: data.damage_notes,
          collected_amount: data.collected_amount,
        },
        user.access_token
      );

      if (response.success) {
        toast.success("Book returned successfully!");
        form.reset();
        setSelectedLoan(null);
        setSearchQuery("");
        onBookReturned();
        onOpenChange(false);
      } else {
        toast.error(response.error || "Failed to return book");
      }
    } catch (error) {
      console.error("Error returning book:", error);
      toast.error("Failed to return book");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getFineAmount = (loan: BookLoan) => {
    if (!loan.due_date) return 0;
    const daysOverdue = calculateDaysOverdue(loan.due_date);
    // Assuming $0.50 per day fine
    return daysOverdue * 0.5;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-3 w-3 text-primary" />
            </div>
            Return Book
          </DialogTitle>
          <DialogDescription>
            Process book return and collect any outstanding fines.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Loan Search */}
            <div className="space-y-2">
              <FormLabel>Search Issued Book *</FormLabel>
              <div className="relative">
                <Input
                  placeholder="Search by book title, student name, or accession number..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedLoan) {
                      setSelectedLoan(null);
                      form.setValue("loan_id", "");
                    }
                  }}
                  className="pr-10"
                />
                <BookOpen className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>

              {/* Search Results */}
              {bookLoans.length > 0 && (
                <Card className="max-h-40 overflow-y-auto">
                  <CardContent className="p-2">
                    {bookLoans.map((loan) => (
                      <div
                        key={loan.id}
                        className="p-2 hover:bg-muted cursor-pointer rounded"
                        onClick={() => handleLoanSelect(loan)}
                      >
                        <div className="font-medium">{loan.book_title}</div>
                        <div className="text-sm text-muted-foreground">
                          {loan.student_name} | {loan.accession_number} | Due: {new Date(loan.due_date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {isLoadingLoans && (
                <div className="text-sm text-muted-foreground">Searching...</div>
              )}
            </div>

            {/* Selected Loan Info */}
            {selectedLoan && (
              <Card className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Loan Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Book:</span> {selectedLoan.book_title}
                    </div>
                    <div>
                      <span className="font-medium">Accession:</span> {selectedLoan.accession_number}
                    </div>
                    <div>
                      <span className="font-medium">Student:</span> {selectedLoan.student_name}
                    </div>
                    <div>
                      <span className="font-medium">Issue Date:</span> {new Date(selectedLoan.issue_date).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium">Due Date:</span> {new Date(selectedLoan.due_date).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>
                      <Badge variant={selectedLoan.status === "overdue" ? "destructive" : "secondary"} className="ml-2">
                        {selectedLoan.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Fine Calculation */}
                  {selectedLoan.status === "overdue" && (
                    <Alert className="mt-4 border-orange-200 bg-orange-50">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>
                              Overdue by {calculateDaysOverdue(selectedLoan.due_date)} days
                            </span>
                            <span className="font-medium">
                              Fine: ${getFineAmount(selectedLoan).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs mt-1">
                            This fine will be added to student's unpaid fines. Use "Collected Amount" below for condition/damage fines only.
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {selectedLoan && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="return_condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Return Condition *</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="excellent">Excellent</option>
                            <option value="good">Good</option>
                            <option value="fair">Fair</option>
                            <option value="poor">Poor</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="collected_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          Condition/Damage Fine ($)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          Collected immediately for poor condition/damage (separate from overdue fine)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="damage_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Damage/Condition Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any damage or condition notes (optional)"
                          className="min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

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
                disabled={isSubmitting || !selectedLoan}
                className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
              >
                {isSubmitting ? "Processing..." : "Return Book"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}