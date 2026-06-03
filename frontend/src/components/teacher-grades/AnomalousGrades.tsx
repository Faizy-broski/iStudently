"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Award, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type { CoursePeriod } from "@/lib/api/grades";

interface AnomalousGradeRow {
  student_id: string;
  student_name: string;
  course_title: string;
  assignment_title: string;
  points_received: number;
  points_possible: number;
  anomaly_type: "Missing" | "Excused" | "Negative" | "Exceeds Max" | "Extra Credit";
}

export function AnomalousGrades() {
  const { user, profile } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Selections ─────────────────────────────────────────────────────────────
  const [includeAllCourses, setIncludeAllCourses] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [optMissing, setOptMissing] = useState(true);
  const [optExcusedNegative, setOptExcusedNegative] = useState(true);
  const [optExceedExtra, setOptExceedExtra] = useState(true);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [results, setResults] = useState<AnomalousGradeRow[]>([]);

  // We fetch results when the component mounts or filters change
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    gradesApi.getAnomalousGradesAdvanced({
      include_all_courses: includeAllCourses,
      include_inactive: includeInactive,
      missing: optMissing,
      negative: optExcusedNegative,
      exceed_max: optExceedExtra,
      extra_credit: optExceedExtra,
      advanced: true
    }).then((res) => {
      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setResults([]);
      }
      setLoading(false);
      setFirstLoad(false);
    }).catch(() => {
      setResults([]);
      setLoading(false);
      setFirstLoad(false);
    });
  }, [user, includeAllCourses, includeInactive, optMissing, optExcusedNegative, optExceedExtra, selectedCampus?.id]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Award className="h-8 w-8 text-[#51B4C9]" />
          <h1 className="text-3xl font-bold text-slate-800">
            Gradebook - Anomalous Grades
          </h1>
        </div>

        <div className="flex flex-col border border-slate-200 bg-white shadow-sm text-sm">
          <div className="flex items-center justify-between border-b p-2 bg-slate-50">
            <div className="flex items-center gap-2">
              <Checkbox
                id="all-courses"
                checked={includeAllCourses}
                onCheckedChange={(c) => setIncludeAllCourses(!!c)}
              />
              <label htmlFor="all-courses" className="font-medium cursor-pointer">
                Include All Courses
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="inactive"
                checked={includeInactive}
                onCheckedChange={(c) => setIncludeInactive(!!c)}
              />
              <label htmlFor="inactive" className="font-medium cursor-pointer">
                Include Inactive Students
              </label>
            </div>
          </div>
          <div className="flex items-center gap-4 p-2 bg-slate-50">
            <span className="font-medium">Include:</span>
            <div className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                id="inc-missing"
                checked={optMissing}
                onCheckedChange={(c) => setOptMissing(!!c)}
                className="data-[state=checked]:bg-[#4A90E2] data-[state=checked]:border-[#4A90E2]"
              />
              <label htmlFor="inc-missing" className="cursor-pointer">Missing Grades</label>
            </div>
            <div className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                id="inc-excused"
                checked={optExcusedNegative}
                onCheckedChange={(c) => setOptExcusedNegative(!!c)}
                className="data-[state=checked]:bg-[#4A90E2] data-[state=checked]:border-[#4A90E2]"
              />
              <label htmlFor="inc-excused" className="cursor-pointer">Excused and Negative Grades</label>
            </div>
            <div className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                id="inc-extra"
                checked={optExceedExtra}
                onCheckedChange={(c) => setOptExceedExtra(!!c)}
                className="data-[state=checked]:bg-[#4A90E2] data-[state=checked]:border-[#4A90E2]"
              />
              <label htmlFor="inc-extra" className="cursor-pointer">Exceed 100% and Extra Credit Grades</label>
            </div>
          </div>
        </div>
      </div>

      {loading && firstLoad ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : results.length === 0 ? (
        <div className="font-medium text-sm p-2 text-slate-800">
          No students with anomalous grades were found.
        </div>
      ) : (
        <div className="border rounded-md bg-white opacity-50 relative">
           {loading && (
             <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
               <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
             </div>
           )}
           <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-[200px] text-[#4A90E2] font-semibold">STUDENT</TableHead>
                <TableHead className="text-[#4A90E2] font-semibold">COURSE</TableHead>
                <TableHead className="text-[#4A90E2] font-semibold">ASSIGNMENT</TableHead>
                <TableHead className="text-[#4A90E2] font-semibold text-right">POINTS</TableHead>
                <TableHead className="text-[#4A90E2] font-semibold">ANOMALY TYPE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((row, idx) => (
                <TableRow key={`${row.student_id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <TableCell className="font-medium text-slate-800">
                    {row.student_name}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {row.course_title}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {row.assignment_title}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                     {row.points_received} / {row.points_possible}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium 
                      ${row.anomaly_type === 'Missing' ? 'bg-red-100 text-red-700' : ''}
                      ${row.anomaly_type === 'Excused' || row.anomaly_type === 'Negative' ? 'bg-orange-100 text-orange-700' : ''}
                      ${row.anomaly_type === 'Exceeds Max' || row.anomaly_type === 'Extra Credit' ? 'bg-green-100 text-green-700' : ''}
                    `}>
                      {row.anomaly_type}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
