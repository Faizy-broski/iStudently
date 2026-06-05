"use client";

import { useState, useEffect, useRef } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { updateBook, getCategories, type Book } from "@/lib/api/library";
import { uploadLibraryCoverImage, uploadLibraryDocument } from "@/lib/api/storage";
import { LibraryCategory } from "@/types";
import { toast } from "sonner";
import { ImageIcon, X, Loader2, FileText, Upload, ExternalLink } from "lucide-react";

const bookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  isbn: z.string().optional(),
  category_id: z.string().optional(),
  reference: z.string().optional(),
  document_type: z.string().optional(),
  publisher: z.string().optional(),
  publication_year: z.number().optional(),
  description: z.string().optional(),
});

type BookFormData = z.infer<typeof bookSchema>;

interface EditBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book: Book | null;
  onBookUpdated: () => void;
}

export function EditBookDialog({ open, onOpenChange, book, onBookUpdated }: EditBookDialogProps) {
  const { user, profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [digitalFile, setDigitalFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const digitalFileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      title: "",
      author: "",
      isbn: "",
      category_id: "",
      reference: "",
      document_type: "book",
      publisher: "",
      publication_year: undefined,
      description: "",
    },
  });

  // Populate form and cover when book changes
  useEffect(() => {
    if (book && open) {
      form.reset({
        title: book.title || "",
        author: book.author || "",
        isbn: book.isbn || "",
        category_id: book.category_id || "",
        reference: book.reference || "",
        document_type: book.document_type || "book",
        publisher: book.publisher || "",
        publication_year: book.publication_year ?? undefined,
        description: book.description || "",
      });
      setCoverImageUrl(book.cover_image_url || null);
      setExistingFileUrl(book.file_url || null);
      setDigitalFile(null);
    }
  }, [book, open]);

  // Load categories when dialog opens
  useEffect(() => {
    if (open && user?.access_token) {
      getCategories(user.access_token).then((res) => {
        if (res.success && res.data) setCategories(res.data);
      });
    }
  }, [open, user?.access_token]);

  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.school_id) return;
    setCoverUploading(true);
    const res = await uploadLibraryCoverImage(file, profile.school_id);
    setCoverUploading(false);
    if (res.success && res.url) {
      setCoverImageUrl(res.url);
    } else {
      toast.error(res.error || "Failed to upload cover image");
    }
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const handleDigitalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast.error('File too large. Maximum 50 MB.'); return; }
    setDigitalFile(file);
    if (digitalFileInputRef.current) digitalFileInputRef.current.value = '';
  };

  const onSubmit = async (data: BookFormData) => {
    if (!user?.access_token || !book) return;
    try {
      setIsSubmitting(true);

      // Upload new digital file if selected
      let fileUrl: string | null | undefined = existingFileUrl;
      if (digitalFile && profile?.school_id) {
        setFileUploading(true);
        const uploadRes = await uploadLibraryDocument(digitalFile, profile.school_id, data.category_id || undefined);
        setFileUploading(false);
        if (!uploadRes.success || !uploadRes.url) {
          toast.error(uploadRes.error || 'Failed to upload digital file');
          return;
        }
        fileUrl = uploadRes.url;
      }

      const response = await updateBook(
        book.id,
        {
          ...data,
          // Send null instead of empty string so the DB unique constraint on isbn isn't violated
          isbn: data.isbn?.trim() || null,
          reference: data.reference?.trim() || undefined,
          category_id: data.category_id || undefined,
          publication_year: data.publication_year || null,
          cover_image_url: coverImageUrl ?? undefined,
          file_url: fileUrl ?? undefined,
        },
        user.access_token
      );
      if (response.success) {
        toast.success("Book updated successfully!");
        onBookUpdated();
        onOpenChange(false);
      } else {
        toast.error(response.error || "Failed to update book");
      }
    } catch (error) {
      console.error("Error updating book:", error);
      toast.error("Failed to update book");
    } finally {
      setIsSubmitting(false);
      setFileUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-primary text-sm font-bold">✎</span>
            </div>
            Edit Book
          </DialogTitle>
          <DialogDescription>
            Update book details and cover image. Required fields are marked with an asterisk (*).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Cover Image Upload */}
            <div className="flex items-start gap-4">
              <div
                className="relative flex-shrink-0 w-24 h-32 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors overflow-hidden"
                onClick={() => !coverUploading && coverInputRef.current?.click()}
              >
                {coverUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverImageUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground text-center px-1">Cover</span>
                  </>
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-medium">Cover Image</p>
                <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · max 5 MB</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={coverUploading}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {coverUploading ? "Uploading…" : coverImageUrl ? "Change" : "Upload"}
                  </Button>
                  {coverImageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCoverImageUrl(null)}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleCoverImageChange}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl><Input placeholder="Enter book title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="author"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author *</FormLabel>
                    <FormControl><Input placeholder="Enter author name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isbn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ISBN</FormLabel>
                    <FormControl><Input placeholder="Enter ISBN (optional)" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">No category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Code</FormLabel>
                    <FormControl><Input placeholder="e.g. LIB-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="book">Book</option>
                        <option value="magazine">Magazine</option>
                        <option value="cd">CD / DVD</option>
                        <option value="periodical">Periodical</option>
                        <option value="thesis">Thesis</option>
                        <option value="other">Other</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publisher"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publisher</FormLabel>
                    <FormControl><Input placeholder="Enter publisher name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="publication_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publication Year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 2023"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter book description (optional)"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Digital File Upload */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Digital File
                <span className="text-xs text-muted-foreground ml-1">(optional — makes book available in E-Library)</span>
              </p>

              {/* Existing file */}
              {existingFileUrl && !digitalFile && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                  <FileText className="h-5 w-5 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">File already uploaded</p>
                    <a href={existingFileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline flex items-center gap-1 truncate">
                      View current file <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => digitalFileInputRef.current?.click()}>
                      Replace
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7"
                      onClick={() => setExistingFileUrl(null)}>
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              )}

              {/* New file selected */}
              {digitalFile && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <FileText className="h-5 w-5 text-[#57A3CC] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{digitalFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(digitalFile.size / (1024 * 1024)).toFixed(1)} MB · Will replace existing file</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDigitalFile(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Drop zone — shown when no existing file and no new file selected */}
              {!existingFileUrl && !digitalFile && (
                <div
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-[#57A3CC]/50 hover:bg-muted/20 transition-colors"
                  onClick={() => digitalFileInputRef.current?.click()}
                >
                  <Upload className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground text-center">Click to upload PDF, Word, Excel, PowerPoint, image · max 50 MB</p>
                </div>
              )}

              <input
                ref={digitalFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleDigitalFileChange}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#57A3CC] to-[#022172] text-white hover:opacity-90"
              >
                {fileUploading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading file…</>
                ) : isSubmitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                ) : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
