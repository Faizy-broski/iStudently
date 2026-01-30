"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddParentForm } from "@/components/admin/AddParentForm";

export default function AddParentPage() {
  const router = useRouter();

  const handleSuccess = async () => {
    // Small delay to allow cache invalidation to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    router.push("/admin/parents");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
            Add New Parent/Guardian
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Register a new parent or guardian to the system
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <AddParentForm onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </div>
  );
}
