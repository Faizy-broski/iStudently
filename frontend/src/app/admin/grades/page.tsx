"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GradesIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/grades/report-cards");
  }, [router]);

  return null;
}
