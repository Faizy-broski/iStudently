"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { API_URL } from "@/config/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Settings, DollarSign, BookOpen, Clock, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const librarySettingsSchema = z.object({
  fine_per_day: z.number().min(0, "Fine must be 0 or greater").max(100, "Fine cannot exceed $100"),
  max_books_per_student: z.number().int().min(1, "Must allow at least 1 book").max(20, "Cannot exceed 20 books"),
  loan_duration_days: z.number().int().min(1, "Must be at least 1 day").max(365, "Cannot exceed 365 days"),
});

type LibrarySettingsFormData = z.infer<typeof librarySettingsSchema>;

export function LibrarySettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<LibrarySettingsFormData>({
    resolver: zodResolver(librarySettingsSchema),
    defaultValues: {
      fine_per_day: 0.5,
      max_books_per_student: 3,
      loan_duration_days: 14,
    },
  });

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.access_token) return;

      try {
        setIsLoading(true);
        const response = await fetch(
          `${API_URL}/schools/settings`,
          {
            headers: { Authorization: `Bearer ${user.access_token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.library) {
            form.reset({
              fine_per_day: data.data.library.fine_per_day || 0.5,
              max_books_per_student: data.data.library.max_books_per_student || 3,
              loan_duration_days: data.data.library.loan_duration_days || 14,
            });
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user?.access_token, form]);

  const onSubmit = async (data: LibrarySettingsFormData) => {
    if (!user?.access_token) {
      toast.error("Authentication required");
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(
        `${API_URL}/schools/settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.access_token}`,
          },
          body: JSON.stringify({
            library: data,
          }),
        }
      );

      if (response.ok) {
        toast.success("Library settings saved successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Library Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure library policies and fine rates
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Library Policies
          </CardTitle>
          <CardDescription>
            Set rules and configurations for your library system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="fine_per_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Overdue Fine Per Day ($)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.50"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>
                          Amount charged for each day a book is overdue
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="max_books_per_student"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Maximum Books Per Student
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="3"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? '' : parseInt(value) || 0);
                            }}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum number of books a student can borrow at once
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="loan_duration_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Default Loan Duration (Days)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="14"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? '' : parseInt(value) || 0);
                            }}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          Default number of days for book loans
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={isSaving}
                  >
                    Reset
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
