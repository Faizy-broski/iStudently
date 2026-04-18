"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Award, CloudDownload, Search, Loader2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type { StudentCourseGradeSummary, StudentAssignmentGrade } from "@/lib/api/grades";
import { useTeacherStudents } from "@/hooks/useTeacherStudents";

export function StudentGradesDashboard() {
  const { user } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Flow State ────────────────────────────────────────────────────────
  // Levels: 0 = Students List, 1 = Courses for Student, 2 = Assignments for Course
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  
  // Selections
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<StudentCourseGradeSummary | null>(null);

  // Modal State
  const [modalAssignment, setModalAssignment] = useState<StudentAssignmentGrade | null>(null);

  // ── Level 0: Students ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const { students, loading: loadingStudents, refresh } = useTeacherStudents({
    search: searchQuery,
    limit: 100
  });

  // ── Level 1: Course Summaries ──────────────────────────────────────────
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSummaries, setCourseSummaries] = useState<StudentCourseGradeSummary[]>([]);

  // ── Level 2: Detailed Assignments ──────────────────────────────────────
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentGrades, setAssignmentGrades] = useState<StudentAssignmentGrade[]>([]);

  // View toggles
  const [includeAnonymous, setIncludeAnonymous] = useState(false);

  // Actions
  const handleStudentClick = async (student: any) => {
    setSelectedStudent(student);
    setLoadingCourses(true);
    try {
      const res = await gradesApi.getStudentGradesSummaryAPI(student.id, undefined, selectedCampus?.id);
      if (res.success && res.data) {
        setCourseSummaries(res.data);
      }
    } catch {
      setCourseSummaries([]);
    } finally {
      setLoadingCourses(false);
      setLevel(1);
    }
  };

  const handleCourseClick = async (course: StudentCourseGradeSummary) => {
    setSelectedCourse(course);
    setLoadingAssignments(true);
    try {
      const res = await gradesApi.getStudentCourseDetailedGrades(selectedStudent.id, course.course_period_id);
      if (res.success && res.data) {
        setAssignmentGrades(res.data);
      }
    } catch {
      setAssignmentGrades([]);
    } finally {
      setLoadingAssignments(false);
      setLevel(2);
    }
  };

  // ── Render Helpers ─────────────────────────────────────────────────────
  const renderBreadcrumb = () => {
    if (level === 0) return null;
    if (level === 1) {
      return (
        <div className="flex items-center justify-between bg-slate-50 border-b px-4 py-2 border-slate-200">
          <button className="text-slate-700 font-medium hover:text-[#4A90E2]" onClick={() => setLevel(0)}>
            Totals
          </button>
          <div className="flex items-center gap-4 text-sm">
            <button className="text-[#4A90E2] hover:underline">Expand All</button>
            <div className="flex items-center gap-2">
              <Checkbox id="anon-stats" checked={includeAnonymous} onCheckedChange={(c) => setIncludeAnonymous(!!c)} />
              <label htmlFor="anon-stats" className="cursor-pointer">Include Anonymous Statistics</label>
            </div>
          </div>
        </div>
      );
    }
    if (level === 2) {
      return (
        <div className="flex items-center justify-between bg-slate-50 border-b px-4 py-2 border-slate-200">
          <div className="font-semibold text-slate-800">
             {selectedCourse?.course_title} - {selectedCourse?.course_title}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button className="text-[#4A90E2] hover:underline" onClick={() => setLevel(1)}>
              Back to Totals
            </button>
            <div className="flex items-center gap-2">
              <Checkbox id="anon-stats-2" checked={includeAnonymous} onCheckedChange={(c) => setIncludeAnonymous(!!c)} />
              <label htmlFor="anon-stats-2" className="cursor-pointer">Include Anonymous Statistics</label>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-2">
        <Award className="h-8 w-8 text-[#51B4C9]" />
        <h1 className="text-3xl font-light text-slate-800">
          Student Grades <span className="text-slate-600 font-normal">- Quarter 4</span>
        </h1>
      </div>

      {level === 0 && (
        <div className="text-sm text-[#4A90E2]">
          <button className="hover:underline">Expanded View</button> | <button className="hover:underline">Group by Family</button>
        </div>
      )}

      {/* ── Dynamic Main Area ── */}
      <div className="border border-slate-200 shadow-sm bg-white min-h-[400px]">
        {renderBreadcrumb()}

        <div className="p-4">
          {/* LEVEL 0: Students List */}
          {level === 0 && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                   {students.length} students were found.
                   <CloudDownload className="h-5 w-5 text-black bg-white rounded cursor-pointer drop-shadow-md" />
                </div>
                <div className="relative">
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search" 
                    className="w-48 h-8 rounded-none border-slate-300 pr-8"
                  />
                  <Search className="h-4 w-4 absolute right-2 top-2 text-slate-500" />
                </div>
              </div>
              
              {loadingStudents ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <td className="p-2 text-[#4A90E2] font-semibold w-1/2 uppercase">Student</td>
                      <td className="p-2 text-[#4A90E2] font-semibold w-1/4 uppercase">Rosariosis ID</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase">Grade Level</td>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student: any, i: number) => (
                      <tr 
                        key={student.id} 
                        className={`border-b cursor-pointer hover:bg-blue-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                        onClick={() => handleStudentClick(student)}
                      >
                         <td className="p-2 text-[#4A90E2]">
                           {student.profile ? `${student.profile.first_name} ${student.profile.last_name || ""}` : "Student S Student"}
                         </td>
                         <td className="p-2 text-slate-700">{student.student_number || i + 1}</td>
                         <td className="p-2 text-slate-700">{student.grade_level || "Moyenne Section"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* LEVEL 1: Courses Summary */}
          {level === 1 && (
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                {courseSummaries.length} course{courseSummaries.length !== 1 ? 's' : ''} was found.
              </div>
              {loadingCourses ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase">Course Title</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase">Teacher</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase text-center">Ungraded</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase text-center">Percent</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase text-center">Letter</td>
                    </tr>
                  </thead>
                  <tbody>
                    {courseSummaries.length === 0 ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-500">No courses found with grades.</td></tr>
                    ) : (
                      courseSummaries.map((course, i) => (
                        <tr 
                          key={course.course_period_id} 
                          className="border-b cursor-pointer hover:bg-blue-50 transition"
                          onClick={() => handleCourseClick(course)}
                        >
                           <td className="p-2 text-[#4A90E2]">{course.course_title}</td>
                           <td className="p-2 text-slate-700">{course.teacher_name || "Teach T Teacher"}</td>
                           <td className="p-2 text-slate-700 text-center">{course.ungraded_count || ""}</td>
                           <td className="p-2 text-slate-700 text-center">{course.percent != null ? `${course.percent}%` : ""}</td>
                           <td className="p-2 font-bold text-slate-900 text-center">{course.letter || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* LEVEL 2: Detailed Assignment Grades */}
          {level === 2 && (
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                {assignmentGrades.length} assignment{assignmentGrades.length !== 1 ? 's' : ''} was found.
                <CloudDownload className="h-5 w-5 text-black bg-white rounded cursor-pointer drop-shadow-md" />
              </div>
              {loadingAssignments ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <td className="p-2 text-[#4A90E2] font-semibold w-1/4 uppercase">Title</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase">Category</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase text-center">Points / Possible</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase text-center">Percent</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase text-center">Letter</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase">Comment</td>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentGrades.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center text-slate-500">No assignments recorded.</td></tr>
                    ) : (
                      assignmentGrades.map((a, i) => (
                        <tr 
                          key={a.assignment_id} 
                          className="border-b cursor-pointer hover:bg-blue-50 transition"
                          onClick={() => setModalAssignment(a)}
                        >
                           <td className="p-2 text-[#4A90E2]">{a.title}</td>
                           <td className="p-2 text-slate-700">{a.category}</td>
                           <td className="p-2 text-slate-700 text-center">{a.points_received ?? "-"} / {a.points_possible}</td>
                           <td className="p-2 text-slate-700 text-center">{a.percent != null ? `${a.percent}%` : "-"}</td>
                           <td className="p-2 font-bold text-slate-900 text-center">{a.letter || "-"}</td>
                           <td className="p-2 text-slate-600 italic truncate max-w-[200px]">{a.comment || ""}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Popup Modal ── */}
      {modalAssignment && (
        <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-2xl overflow-hidden w-full max-w-2xl border border-slate-300 transform transition-all">
            <div className="border-b px-4 py-2 flex justify-end bg-slate-50">
              <button 
                onClick={() => setModalAssignment(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
               <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 border p-4 rounded">
                  <div className="space-y-2">
                    <div className="flex gap-2"><span className="text-slate-500 w-24 block">Due Date</span> <span className="font-medium">{modalAssignment.due_date?.substring(0,10) || "N/A"}</span></div>
                    <div className="flex gap-2"><span className="text-slate-500 w-24 block">Course Title</span> <span className="font-medium">{selectedCourse?.course_title || modalAssignment.course_title}</span></div>
                    <div className="flex gap-2"><span className="text-slate-500 w-24 block">Title</span> <span className="font-medium text-slate-800">{modalAssignment.title}</span></div>
                    <div className="flex gap-2"><span className="text-slate-500 w-24 block">Points</span> <span className="font-medium">{modalAssignment.points_possible}</span></div>
                  </div>
                  <div className="space-y-2 text-right">
                     <div className="flex justify-end gap-2"><span className="text-slate-500 block">Assigned Date</span> <span className="font-medium">{modalAssignment.assigned_date?.substring(0,10) || "N/A"}</span></div>
                     <div className="flex justify-end gap-2"><span className="text-slate-500 block">Teacher</span> <span className="font-medium">{selectedCourse?.teacher_name || modalAssignment.teacher_name}</span></div>
                     <div className="flex justify-end gap-2 items-center">
                        <span className="text-slate-500 block">Category</span> 
                        <span className="font-medium border-l-4 border-blue-600 pl-1">{modalAssignment.category}</span>
                     </div>
                  </div>
               </div>

               <div className="text-sm prose prose-sm max-w-none text-slate-700">
                  {/* Rich text is handled seamlessly */}
                  <div dangerouslySetInnerHTML={{ __html: modalAssignment.description || '<i>No description provided</i>' }} />
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
