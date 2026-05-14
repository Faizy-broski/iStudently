"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scale, ChevronDown, ChevronRight } from "lucide-react";
import { useGradingScales, useGradingScaleGrades } from "@/hooks/useGradingScales";
import type { GradingScale } from "@/lib/api/teacher-setup";

function ScaleRow({ scale }: { scale: GradingScale }) {
  const [open, setOpen] = useState(false);
  const { grades, loading } = useGradingScaleGrades(open ? scale.id : null);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          <span className="font-medium text-gray-800">{scale.title}</span>
          {scale.is_default && (
            <Badge className="bg-blue-100 text-blue-700 text-xs">Default</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">View grades</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : grades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No grade entries defined.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wide border-b border-gray-200">
                  <th className="text-left py-1 pr-4">Letter</th>
                  <th className="text-left py-1 pr-4">Title</th>
                  <th className="text-right py-1 pr-4">Min %</th>
                  <th className="text-right py-1 pr-4">Max %</th>
                  <th className="text-right py-1 pr-4">GPA</th>
                  <th className="text-center py-1">Passing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grades.map((g) => (
                  <tr key={g.id} className="hover:bg-white transition-colors">
                    <td className="py-1.5 pr-4 font-semibold text-blue-700">{g.letter_grade}</td>
                    <td className="py-1.5 pr-4 text-gray-700">{g.title}</td>
                    <td className="py-1.5 pr-4 text-right text-gray-600">{g.min_percent}%</td>
                    <td className="py-1.5 pr-4 text-right text-gray-600">{g.max_percent}%</td>
                    <td className="py-1.5 pr-4 text-right text-gray-600">{g.gpa_value?.toFixed(2)}</td>
                    <td className="py-1.5 text-center">
                      {g.is_passing ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">Yes</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 text-xs">No</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeacherGradingScalesPage() {
  const { scales, loading, error } = useGradingScales();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Grading Scales</h1>
          <p className="text-sm text-muted-foreground">
            School-wide scales configured by your administrator — read only.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Scales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-500 text-center py-4">{error}</p>
          ) : scales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No grading scales have been configured yet.
            </p>
          ) : (
            scales.map((scale) => <ScaleRow key={scale.id} scale={scale} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
