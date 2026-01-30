"use client";

import { useState } from "react";
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
import { BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createBookCopies, type Book } from "@/lib/api/library";
import { toast } from "sonner";

const copiesSchema = z.object({
  numberOfCopies: z.number().min(1, "At least 1 copy is required").max(100, "Maximum 100 copies allowed"),
  purchase_date: z.string().optional(),
  price: z.number().optional(),
  condition_notes: z.string().optional(),
});

type CopiesFormData = z.infer<typeof copiesSchema>;

interface AddCopiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Book | null;
  onCopiesAdded: () => void;
}

export function AddCopiesDialog({ open, onOpenChange, book, onCopiesAdded }: AddCopiesDialogProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CopiesFormData>({
    resolver: zodResolver(copiesSchema),
    defaultValues: {
      numberOfCopies: 1,
      purchase_date: "",
      price: undefined,
      condition_notes: "",
    },
  });

  const onSubmit = async (data: CopiesFormData) => {
    if (!user?.access_token || !book) return;

    try {
      setIsSubmitting(true);
      const response = await createBookCopies(
        book.id,
        {
          numberOfCopies: data.numberOfCopies,
          purchase_date: data.purchase_date ? new Date(data.purchase_date) : undefined,
          price: data.price,
          condition_notes: data.condition_notes,
        },
        user.access_token
      );

      if (response.success) {
        toast.success(`${data.numberOfCopies} copies added successfully!`);
        form.reset();
        onCopiesAdded();
      } else {
        toast.error(response.error || "Failed to add copies");
      }
    } catch (error) {
      console.error("Error adding copies:", error);
      toast.error("Failed to add copies");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-primary text-sm font-bold">+</span>
            </div>
            Add Copies
          </DialogTitle>
          <DialogDescription>
            Add physical copies of this book to the library inventory.
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
                <span className="font-medium">Current Copies:</span> {book.total_copies} total, {book.available_copies} available
              </div>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="numberOfCopies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Copies *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Enter number of copies"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per Copy ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="condition_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any notes about the condition of these copies (optional)"
                      className="min-h-[60px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
              <p>
                <strong>Note:</strong> Accession numbers will be auto-generated (LIB-XXXXXX format)
                and must be unique within the school.
              </p>
            </div>

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
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
              >
                {isSubmitting ? "Adding..." : "Add Copies"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}