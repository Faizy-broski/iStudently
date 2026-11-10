"use client"

import { Suspense } from "react"
import { NameImport } from "@/components/jahbadh/NameImport"

export default function Page() {
  return <Suspense><NameImport base="/admin/jahbadh-grades" /></Suspense>
}
