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
import { BookOpen, AlertTriangle, DollarSign } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { markBookLost, getBookLoans, type BookLoan } from "@/lib/api/library";
import { toast } from "sonner";

const markLostSchema = z.object({
  loan_id: z.string().min(1, "Loan selection is required"),
  replacement_cost: z.number().min(0, "Replacement cost cannot be negative"),
  processing_fee: z.number().min(0, "Processing fee cannot be negative"),
  notes: z.string().optional(),
});

type MarkLostFormData = z.infer<typeof markLostSchema>;

interface MarkLostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookMarkedLost: () => void;
}

export function MarkLostDialog({ open, onOpenChange, onBookMarkedLost }: MarkLostDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookLoans, setBookLoans] = useState<BookLoan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<BookLoan | null>(null);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);

  const form = useForm<MarkLostFormData>({
    resolver: zodResolver(markLostSchema),
    defaultValues: {
      loan_id: "",
      replacement_cost: 0,
      processing_fee: 5.00, // Default processing fee
      notes: "",
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
        const response = await getBookLoans({ search: searchQuery, status: "active" }, user.access_token);
        if (response.success) {
          setBookLoans(response.data || []);
        }
      } catch (error) {
        console.error("Error searching loans:", error);
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
    // Set default replacement cost to book price if available, otherwise 0
    form.setValue("replacement_cost", loan.book_price || 0);
    setSearchQuery(`${loan.book_title} - ${loan.student_name} (${loan.accession_number})`);
    setBookLoans([]);
  };

  const onSubmit = async (data: MarkLostFormData) => {
    if (!user?.access_token || !selectedLoan) return;

    try {
      setIsSubmitting(true);
      const response = await markBookLost(
        selectedLoan.id,
        {
          replacement_cost: data.replacement_cost,
          processing_fee: data.processing_fee,
          notes: data.notes,
        },
        user.access_token
      );

      if (response.success) {
        toast.success("Book marked as lost and fee added to student account!");
        form.reset();
        setSelectedLoan(null);
        setSearchQuery("");
        onBookMarkedLost();
      } else {
        toast.error(response.error || "Failed to mark book as lost");
      }
    } catch (error) {
      console.error("Error marking book as lost:", error);
      toast.error("Failed to mark book as lost");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalFee = (form.watch("replacement_cost") || 0) + (form.watch("processing_fee") || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-3 w-3 text-red-600" />
            </div>
            Mark Book as Lost
          </DialogTitle>
          <DialogDescription>
            Mark this book as lost and add replacement cost plus processing fee to student's account.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Warning:</strong> This action will mark the book as lost, remove it from circulation,
            and add the calculated fee to the student's outstanding balance. This action cannot be undone.
          </AlertDescription>
        </Alert>

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
                </CardContent>
              </Card>
            )}

            {selectedLoan && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="replacement_cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          Replacement Cost ($)
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="processing_fee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          Processing Fee ($)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="5.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Total Fee Display */}
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Total Fee to Student:</span>
                      <span className="text-lg font-bold text-orange-800">
                        ${totalFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-orange-700 mt-1">
                      Replacement: ${form.watch("replacement_cost")?.toFixed(2) || "0.00"} +
                      Processing: ${form.watch("processing_fee")?.toFixed(2) || "0.00"}
                    </div>
                  </CardContent>
                </Card>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes about the lost book (optional)"
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
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isSubmitting ? "Processing..." : "Mark as Lost"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}