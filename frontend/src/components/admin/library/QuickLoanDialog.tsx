"use client";

import { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Search, User, BookOpen, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { searchBorrowers, globalSearchDocuments, quickLoan } from "@/lib/api/library";
import { toast } from "sonner";

interface QuickLoanDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLoanCreated: () => void;
}

type BorrowerTab = "student" | "user";

interface Borrower {
    id: string;
    first_name: string;
    last_name: string;
    admission_number?: string;
    class_name?: string;
    email?: string;
    role?: string;
}

interface DocumentResult {
    id: string;
    title: string;
    author: string;
    available_copies: number;
    reference?: string | null;
}

export function QuickLoanDialog({ open, onOpenChange, onLoanCreated }: QuickLoanDialogProps) {
    const { user } = useAuth();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [borrowerTab, setBorrowerTab] = useState<BorrowerTab>("student");
    const [borrowerSearch, setBorrowerSearch] = useState("");
    const [documentSearch, setDocumentSearch] = useState("");
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [documents, setDocuments] = useState<DocumentResult[]>([]);
    const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
    const [selectedDocument, setSelectedDocument] = useState<DocumentResult | null>(null);
    const [isSearchingBorrowers, setIsSearchingBorrowers] = useState(false);
    const [isSearchingDocuments, setIsSearchingDocuments] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleBorrowerSearchChange = (val: string) => {
        setBorrowerSearch(val);
        if (!val.trim()) setBorrowers([]);
    };

    const handleDocumentSearchChange = (val: string) => {
        setDocumentSearch(val);
        if (!val.trim()) setDocuments([]);
    };

    const handleSearchBorrowers = async () => {
        if (!borrowerSearch.trim() || !user?.access_token) return;
        try {
            setIsSearchingBorrowers(true);
            const res = await searchBorrowers(borrowerSearch, borrowerTab, user.access_token);
            if (res.success && res.data) setBorrowers(res.data);
            else setBorrowers([]);
        } catch {
            setBorrowers([]);
        } finally {
            setIsSearchingBorrowers(false);
        }
    };

    const handleSearchDocuments = async () => {
        if (!documentSearch.trim() || !user?.access_token) return;
        try {
            setIsSearchingDocuments(true);
            const res = await globalSearchDocuments(documentSearch, user.access_token);
            if (res.success && res.data) setDocuments(res.data);
            else setDocuments([]);
        } catch {
            setDocuments([]);
        } finally {
            setIsSearchingDocuments(false);
        }
    };

    const selectBorrower = (b: Borrower) => {
        setSelectedBorrower(b);
        setStep(2);
        setBorrowers([]);
        setBorrowerSearch("");
    };

    const selectDocument = (d: DocumentResult) => {
        setSelectedDocument(d);
        setStep(3);
        setDocuments([]);
        setDocumentSearch("");
    };

    const handleSubmit = async () => {
        if (!user?.access_token || !selectedBorrower || !selectedDocument) return;
        try {
            setIsSubmitting(true);
            const res = await quickLoan(
                {
                    borrower_type: borrowerTab,
                    borrower_id: selectedBorrower.id,
                    book_id: selectedDocument.id,
                },
                user.access_token
            );
            if (res.success) {
                toast.success("Quick loan created successfully!");
                onLoanCreated();
                resetAndClose();
            } else {
                toast.error(res.error || "Failed to create quick loan");
            }
        } catch {
            toast.error("Failed to create quick loan");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetAndClose = () => {
        setStep(1);
        setBorrowerTab("student");
        setBorrowerSearch("");
        setDocumentSearch("");
        setBorrowers([]);
        setDocuments([]);
        setSelectedBorrower(null);
        setSelectedDocument(null);
        onOpenChange(false);
    };

    const borrowerName = selectedBorrower
        ? `${selectedBorrower.first_name} ${selectedBorrower.last_name}`
        : "";

    return (
        <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : resetAndClose())}>
            <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                            <Zap className="h-3.5 w-3.5 text-white" />
                        </div>
                        Quick Loan
                    </DialogTitle>
                    <DialogDescription>
                        Quickly assign a document to a borrower in 3 steps.
                    </DialogDescription>
                </DialogHeader>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 py-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-2 flex-1">
                            <div
                                className={cn(
                                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                    step >= s
                                        ? "bg-gradient-to-br from-[#57A3CC] to-[#022172] text-white"
                                        : "bg-muted text-muted-foreground"
                                )}
                            >
                                {s}
                            </div>
                            <span className={cn("text-xs font-medium hidden sm:inline", step >= s ? "text-foreground" : "text-muted-foreground")}>
                                {s === 1 ? "Borrower" : s === 2 ? "Document" : "Confirm"}
                            </span>
                            {s < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Select Borrower */}
                {step === 1 && (
                    <div className="space-y-3">
                        <div className="flex gap-1 p-1 bg-muted rounded-lg">
                            {(["student", "user"] as BorrowerTab[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setBorrowerTab(tab);
                                        setBorrowers([]);
                                        setBorrowerSearch("");
                                    }}
                                    className={cn(
                                        "flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
                                        borrowerTab === tab
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {tab === "user" ? "Staff / Other" : tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Input
                                placeholder={`Search ${borrowerTab === "student" ? "students" : "staff/users"} by name...`}
                                value={borrowerSearch}
                                onChange={(e) => handleBorrowerSearchChange(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearchBorrowers()}
                            />
                            <Button size="icon" variant="outline" onClick={handleSearchBorrowers} disabled={isSearchingBorrowers}>
                                {isSearchingBorrowers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1">
                            {borrowers.map((b) => (
                                <div
                                    key={b.id}
                                    onClick={() => selectBorrower(b)}
                                    className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                                >
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{b.first_name} {b.last_name}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {b.admission_number || b.email || b.role || ""}
                                            {b.class_name ? ` • ${b.class_name}` : ""}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {!isSearchingBorrowers && borrowers.length === 0 && borrowerSearch && (
                                <p className="text-xs text-center text-muted-foreground py-4">No results found.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 2: Select Document */}
                {step === 2 && (
                    <div className="space-y-3">
                        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                            <CardContent className="p-3 flex items-center gap-2 text-sm">
                                <User className="h-4 w-4 text-green-600 shrink-0" />
                                <span className="font-medium text-green-800 dark:text-green-300">{borrowerName}</span>
                                <Badge variant="secondary" className="ml-auto capitalize text-xs">{borrowerTab}</Badge>
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setStep(1)}>
                                    Change
                                </Button>
                            </CardContent>
                        </Card>

                        <div className="flex gap-2">
                            <Input
                                placeholder="Search by title, author, reference..."
                                value={documentSearch}
                                onChange={(e) => handleDocumentSearchChange(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearchDocuments()}
                            />
                            <Button size="icon" variant="outline" onClick={handleSearchDocuments} disabled={isSearchingDocuments}>
                                {isSearchingDocuments ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1">
                            {documents.map((d) => (
                                <div
                                    key={d.id}
                                    onClick={() => d.available_copies > 0 && selectDocument(d)}
                                    className={cn(
                                        "flex items-center gap-3 p-2.5 rounded-md transition-colors",
                                        d.available_copies > 0
                                            ? "hover:bg-muted cursor-pointer"
                                            : "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <BookOpen className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{d.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {d.author}{d.reference ? ` • Ref: ${d.reference}` : ""}
                                        </p>
                                    </div>
                                    <Badge variant={d.available_copies > 0 ? "default" : "destructive"} className="text-xs shrink-0">
                                        {d.available_copies} avail.
                                    </Badge>
                                </div>
                            ))}
                            {!isSearchingDocuments && documents.length === 0 && documentSearch && (
                                <p className="text-xs text-center text-muted-foreground py-4">No documents found.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Confirm */}
                {step === 3 && selectedBorrower && selectedDocument && (
                    <div className="space-y-4">
                        <Card>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <User className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm font-medium">{borrowerName}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{borrowerTab}</p>
                                    </div>
                                </div>
                                <div className="border-t" />
                                <div className="flex items-center gap-3">
                                    <BookOpen className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="text-sm font-medium">{selectedDocument.title}</p>
                                        <p className="text-xs text-muted-foreground">{selectedDocument.author}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <p className="text-xs text-muted-foreground text-center">
                            An available copy will be automatically assigned and the default due date applied.
                        </p>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={resetAndClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    {step === 3 && (
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Lending...
                                </>
                            ) : (
                                <>
                                    <Zap className="mr-2 h-4 w-4" />
                                    Lend Now
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
