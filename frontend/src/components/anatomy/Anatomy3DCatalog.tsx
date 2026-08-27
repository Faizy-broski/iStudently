"use client"

// Standalone "browse all 3D anatomy models" page for the Edu Resources
// sidebar — reuses the exact same vendored organ data/viewer that already
// power the "3D Anatomy Label" quiz question type and the "3D Anatomy Model"
// Learning Resources entry type, just without needing a teacher to first
// create a resource/question for each organ. Pick an organ, view it; no
// grading, no hotspot answers — same read-only mode as AnatomyExplorer.

import { useMemo, useState } from "react"
import { useLocale } from "next-intl"
import { ArrowLeft, Dna } from "lucide-react"
import { AnatomyExplorer } from "./AnatomyExplorer"
import { buildOrgans } from "@/lib/anatomy/i18n/merge"
import { getOrganDictionary } from "@/lib/anatomy/i18n/organs"
import type { OrganId } from "@/lib/anatomy/anatomy-data"

type Props = {
  title?: string
}

export function Anatomy3DCatalog({ title = "3D Anatomy Models" }: Props) {
  const locale = useLocale()
  const organs = useMemo(() => buildOrgans(getOrganDictionary(locale)), [locale])
  const [selectedId, setSelectedId] = useState<OrganId | null>(null)
  const selectedOrgan = organs.find((o) => o.id === selectedId)

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b shrink-0">
        {selectedOrgan ? (
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {title}
          </button>
        ) : (
          <>
            <Dna className="h-4 w-4 text-[#022172]" />
            <span className="font-semibold text-sm text-gray-800">{title}</span>
          </>
        )}
      </div>

      {selectedOrgan ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 border-b bg-white">
            <h2 className="font-semibold text-lg flex items-center gap-2" style={{ color: selectedOrgan.accent }}>
              <span>{selectedOrgan.icon}</span>
              {selectedOrgan.name}
            </h2>
            <p className="text-xs text-muted-foreground italic">{selectedOrgan.scientificName}</p>
            {selectedOrgan.description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{selectedOrgan.description}</p>
            )}
          </div>
          <AnatomyExplorer
            organId={selectedOrgan.id}
            locale={locale}
            height={620}
            className="rounded-lg overflow-hidden border m-4"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {organs.map((organ) => (
              <button
                key={organ.id}
                onClick={() => setSelectedId(organ.id)}
                className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left hover:shadow-md hover:border-gray-300 transition-all bg-white"
              >
                <span className="text-3xl leading-none" style={{ color: organ.accent }}>{organ.icon}</span>
                <span className="font-semibold text-gray-800">{organ.name}</span>
                <span className="text-xs text-muted-foreground italic">{organ.scientificName}</span>
                {organ.description && (
                  <span className="text-xs text-muted-foreground line-clamp-2">{organ.description}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
