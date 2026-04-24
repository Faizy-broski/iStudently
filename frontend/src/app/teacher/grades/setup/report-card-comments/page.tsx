"use client";

import { getTeacherRCComments, getTeacherRCCategories } from "@/lib/api/teacher-setup";
import { ReportCardCommentsManager } from "@/components/grades/ReportCardCommentsManager";

export default function TeacherReportCardCommentsPage() {
  return (
    <ReportCardCommentsManager
      readOnly
      getCategories={async (campusId) => {
        const res = await getTeacherRCCategories(campusId);
        return res.success && res.data ? res.data : [];
      }}
      getComments={async (categoryId) => {
        const res = await getTeacherRCComments(categoryId);
        return res.success && res.data ? res.data : [];
      }}
    />
  );
}
