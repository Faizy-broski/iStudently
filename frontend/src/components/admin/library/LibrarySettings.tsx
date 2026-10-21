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
import { useTranslations } from "next-intl";

const makeSchema = (t: (k: string) => string) =>
  z.object({
    fine_per_day: z.number().min(0, t("v_fine_min")).max(100, t("v_fine_max")),
    max_books_per_student: z.number().int().min(1, t("v_books_min")).max(20, t("v_books_max")),
    loan_duration_days: z.number().int().min(1, t("v_days_min")).max(365, t("v_days_max")),
  });

type LibrarySettingsFormData = z.infer<ReturnType<typeof makeSchema>>;

export function LibrarySettings() {
  const t = useTranslations("library_settings");
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<LibrarySettingsFormData>({
    resolver: zodResolver(makeSchema(t)),
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
          `${API_URL}/schools/settings/library`,
          {
            headers: { Authorization: `Bearer ${user.access_token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          // GET /schools/settings/library returns the policies with defaults filled in.
          if (data.success && data.data) {
            form.reset({
              fine_per_day: Number(data.data.fine_per_day),
              max_books_per_student: Number(data.data.max_books_per_student),
              loan_duration_days: Number(data.data.loan_duration_days),
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
      toast.error(t("auth_required"));
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch(
        `${API_URL}/schools/settings/library`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.access_token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (response.ok) {
        toast.success(t("saved"));
      } else {
        const error = await response.json();
        toast.error(error.error || t("save_failed"));
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(t("save_failed"));
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
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t("policies")}
          </CardTitle>
          <CardDescription>
            {t("policies_desc")}
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
                          {t("fine")}
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
                          {t("fine_desc")}
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
                          {t("max_books")}
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
                          {t("max_books_desc")}
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
                          {t("loan_days")}
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
                          {t("loan_days_desc")}
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
                    {t("reset")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("saving")}
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {t("save")}
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
