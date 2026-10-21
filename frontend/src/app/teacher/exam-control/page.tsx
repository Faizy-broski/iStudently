"use client"

import { Suspense } from "react"
import { ExamControl } from "@/components/jahbadh/control/ExamControl"

export default function Page() {
  return <Suspense><ExamControl base="/teacher/exam-control" /></Suspense>
}
