"use client"

import LessonPlansList from "@/components/scheduling/LessonPlansList"

export default function LessonPlansListPage() {
  return <LessonPlansList readBasePath="/admin/scheduling/lesson-plan-read" />
}
