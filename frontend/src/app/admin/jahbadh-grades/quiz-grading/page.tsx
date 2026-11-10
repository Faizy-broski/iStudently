"use client"

import { Suspense } from "react"
import { QuizGrading } from "@/components/jahbadh/QuizGrading"

export default function Page() {
  return <Suspense><QuizGrading base="/admin/jahbadh-grades" /></Suspense>
}
