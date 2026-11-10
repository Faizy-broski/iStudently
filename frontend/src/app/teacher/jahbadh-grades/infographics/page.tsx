"use client"

import { Suspense } from "react"
import { Infographics } from "@/components/jahbadh/Infographics"

export default function Page() {
  return <Suspense><Infographics base="/teacher/jahbadh-grades" /></Suspense>
}
