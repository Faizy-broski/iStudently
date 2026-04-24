"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Award, Plus, Loader2, Paperclip, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import * as gradesApi from "@/lib/api/grades";
import type { AssignmentType, Assignment, CoursePeriod } from "@/lib/api/grades";
import { uploadTeacherAssignmentFile } from "@/lib/api/storage";

interface EditState {
  mode: "view" | "edit-type" | "add-type" | "edit-assignment" | "add-assignment";
  typeData: Partial<AssignmentType>;
  assignmentData: Partial<Assignment>;
}

export function TeacherAssignments() {
  const { user, profile } = useAuth();
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;

  // ── Context Selections ───────────────────────────────────────────────────
  const [coursePeriods, setCoursePeriods] = useState<CoursePeriod[]>([]);
  const [selectedCp, setSelectedCp] = useState<string>("");

  const [markingPeriods, setMarkingPeriods] = useState<{ id: string; title: string }[]>([]);
  const [selectedMp, setSelectedMp] = useState<string>("");

  // ── Data ─────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [assignmentTypes, setAssignmentTypes] = useState<AssignmentType[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // ── UI Edit State ────────────────────────────────────────────────────────
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<string | null>(null);
  
  const [editState, setEditState] = useState<EditState>({
    mode: "view",
    typeData: {},
    assignmentData: {}
  });

  // ── File upload ──────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // ── Apply to all periods ─────────────────────────────────────────────────
  const [applyToAllPeriods, setApplyToAllPeriods] = useState(false)

  // ── Load CP / MP ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    Promise.all([
      gradesApi.getCoursePeriods(selectedCampus?.id),
      gradesApi.getMarkingPeriods(selectedCampus?.id),
    ]).then(([cpRes, mpRes]) => {
      let filteredCps = cpRes.success && cpRes.data ? cpRes.data : [];
      if (profile?.staff_id) {
        filteredCps = filteredCps.filter((cp) => cp.teacher_id === profile.staff_id);
      }
      setCoursePeriods(filteredCps);
      if (filteredCps.length > 0) setSelectedCp(filteredCps[0].id);

      if (mpRes.success && mpRes.data) {
        setMarkingPeriods(mpRes.data);
        if (mpRes.data.length > 0) setSelectedMp(mpRes.data[0].id);
      }
      setLoading(false);
    });
  }, [user, selectedCampus?.id, profile?.staff_id]);

  // ── Load Assignment Types & Assignments ──────────────────────────────────
  useEffect(() => {
    if (!selectedCp) return;
    loadTypesAndAssignments();
  }, [selectedCp, selectedMp]);

  const loadTypesAndAssignments = async () => {
    setLoading(true);
    try {
      const [typeRes, assignRes] = await Promise.all([
        gradesApi.getAssignmentTypes(selectedCp),
        selectedMp ? gradesApi.getAssignmentsByStaff(selectedCp, selectedMp) : Promise.resolve({ success: true, data: [] })
      ]);
      
      if (typeRes.success && typeRes.data) {
        setAssignmentTypes(typeRes.data);
      }
      if (assignRes.success && assignRes.data) {
        setAssignments(assignRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Filtering Assignments ────────────────────────────────────────────────
  const filteredAssignments = activeType 
    ? assignments.filter(a => a.assignment_type_id === activeType)
    : [];

  const mpName = markingPeriods.find(m => m.id === selectedMp)?.title || "";

  // ── Click Handlers ───────────────────────────────────────────────────────
  const handleTypeClick = (type: AssignmentType) => {
    setActiveType(type.id);
    setActiveAssignment(null);
    setEditState({
      mode: "edit-type",
      typeData: { ...type },
      assignmentData: {}
    });
  };

  const handleAssignmentClick = (assignment: Assignment) => {
    setSelectedFile(null);
    setActiveType(assignment.assignment_type_id);
    setActiveAssignment(assignment.id);
    setEditState({
      mode: "edit-assignment",
      typeData: {},
      assignmentData: { ...assignment }
    });
  };

  const handleAddType = () => {
    setActiveType(null);
    setActiveAssignment(null);
    setEditState({
      mode: "add-type",
      typeData: { title: "", color: "#ffffff", sort_order: 0 },
      assignmentData: {}
    });
  };

  const handleAddAssignment = () => {
    if (!activeType) {
      toast.error("Please select an Assignment Type first.");
      return;
    }
    setSelectedFile(null);
    setApplyToAllPeriods(false);
    setActiveAssignment(null);
    setEditState({
      mode: "add-assignment",
      typeData: {},
      assignmentData: { 
        title: "", 
        points: 0, 
        weight: 1,
        assignment_type_id: activeType,
        course_period_id: selectedCp,
        marking_period_id: selectedMp,
        enable_submission: false
      }
    });
  };

  // ── Save Handlers ────────────────────────────────────────────────────────
  const handleSaveType = async () => {
    if (!editState.typeData.title) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      if (editState.mode === "add-type") {
        const payload = {
          ...editState.typeData,
          course_period_id: selectedCp,
          course_id: coursePeriods.find(c => c.id === selectedCp)?.course_id || "",
        };
        await gradesApi.createAssignmentType(payload);
        toast.success("Assignment Type created");
      } else {
        await gradesApi.updateAssignmentType(activeType!, editState.typeData);
        toast.success("Assignment Type updated");
      }
      await loadTypesAndAssignments();
      setEditState(prev => ({ ...prev, mode: "view" }));
      setActiveType(null);
    } catch (err) {
      toast.error("Failed to save assignment type");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!editState.assignmentData.title || editState.assignmentData.points === undefined) {
      toast.error("Title and Points are required");
      return;
    }
    setSaving(true);
    try {
      let fileUrl: string | undefined = editState.assignmentData.file_url as string | undefined;

      if (selectedFile) {
        const campusId = selectedCampus?.id;
        const schoolId = selectedCampus?.school_id || selectedCampus?.id;
        if (!campusId || !schoolId) {
          toast.error("Campus context required for file upload");
          setSaving(false);
          return;
        }
        toast.info("Uploading file...");
        const uploadResult = await uploadTeacherAssignmentFile(selectedFile, schoolId, campusId);
        if (!uploadResult.success || !uploadResult.url) {
          toast.error(uploadResult.error || "File upload failed");
          setSaving(false);
          return;
        }
        fileUrl = uploadResult.url;
        toast.success("File uploaded!");
      }

      const payload = { ...editState.assignmentData, ...(fileUrl !== undefined ? { file_url: fileUrl } : {}) };

      if (editState.mode === "add-assignment") {
        if (applyToAllPeriods) {
          // Find all course periods sharing the same course as the selected one
          const selectedCpData = coursePeriods.find(cp => cp.id === selectedCp)
          const siblingIds = coursePeriods
            .filter(cp => cp.course_id === selectedCpData?.course_id)
            .map(cp => cp.id)
          await gradesApi.massCreateAssignment({
            title: payload.title!,
            assignment_type_id: payload.assignment_type_id!,
            points: payload.points || 100,
            weight: payload.weight || 1,
            description: payload.description,
            assigned_date: payload.assigned_date || null,
            due_date: payload.due_date || null,
            enable_submission: payload.enable_submission,
            course_period_ids: siblingIds.length > 0 ? siblingIds : [selectedCp],
          })
          toast.success(`Assignment created for ${siblingIds.length || 1} period(s)`)
        } else {
          await gradesApi.createAssignment(payload);
          toast.success("Assignment created");
        }
      } else {
        await gradesApi.updateAssignment(activeAssignment!, payload);
        toast.success("Assignment updated");
      }
      setSelectedFile(null);
      setApplyToAllPeriods(false);
      await loadTypesAndAssignments();
      setEditState(prev => ({ ...prev, mode: "edit-type", typeData: assignmentTypes.find(t => t.id === activeType) || {} }));
      setActiveAssignment(null);
    } catch (err) {
      toast.error("Failed to save assignment");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!activeAssignment) return;
    setSaving(true);
    try {
      await gradesApi.deleteAssignment(activeAssignment);
      toast.success("Assignment deleted");
      await loadTypesAndAssignments();
      setEditState(prev => ({ ...prev, mode: "edit-type", typeData: assignmentTypes.find(t => t.id === activeType) || {} }));
      setActiveAssignment(null);
    } catch (err) {
      toast.error("Failed to delete assignment");
    } finally {
      setSaving(false);
    }
  };

  // ── Renders ──────────────────────────────────────────────────────────────
  const renderTopForm = () => {
    if (loading) return null;
    if (editState.mode === "view") return <div className="h-10 text-sm text-slate-500 py-2">Select an assignment type below.</div>;

    if (editState.mode === "add-type" || editState.mode === "edit-type") {
      return (
        <div className="border border-slate-200 bg-slate-50 shadow-sm p-4 w-full">
          <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-200">
            <h2 className="font-medium text-lg text-slate-700">
              {editState.typeData.title || "New Assignment Type"}
            </h2>
            <Button size="sm" onClick={handleSaveType} disabled={saving} className="bg-[#4A90E2] text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "SAVE"}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">{editState.typeData.title || "Title"}</Label>
              <Input 
                value={editState.typeData.title || ""} 
                onChange={e => setEditState(prev => ({ ...prev, typeData: { ...prev.typeData, title: e.target.value } }))}
                placeholder="Title"
                className="bg-white"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Sort Order</Label>
              <Input 
                type="number"
                value={editState.typeData.sort_order || ""}
                onChange={e => setEditState(prev => ({ ...prev, typeData: { ...prev.typeData, sort_order: parseInt(e.target.value) || 0 } }))}
                className="bg-white w-20"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Color</Label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={editState.typeData.color || "#0000ff"}
                  onChange={e => setEditState(prev => ({ ...prev, typeData: { ...prev.typeData, color: e.target.value } }))}
                  className="w-10 h-10 p-0 border-0 cursor-pointer rounded overflow-hidden" 
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (editState.mode === "add-assignment" || editState.mode === "edit-assignment") {
      return (
        <div className="border border-slate-200 bg-slate-50 shadow-sm p-4 w-full space-y-4">
          <div className="flex justify-between items-center border-b pb-2 border-slate-200">
            <h2 className="font-medium text-lg text-slate-700">
              {editState.assignmentData.title || "New Assignment"}
            </h2>
            <div className="flex gap-2">
              {editState.mode === "edit-assignment" && (
                <Button size="sm" variant="outline" onClick={handleDeleteAssignment} disabled={saving}>DELETE</Button>
              )}
              <Button size="sm" onClick={handleSaveAssignment} disabled={saving} className="bg-[#4A90E2] text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "SAVE"}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-x-12 gap-y-4">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">{editState.assignmentData.title || "Title"}</Label>
              <Input 
                value={editState.assignmentData.title || ""}
                onChange={e => setEditState(prev => ({ ...prev, assignmentData: { ...prev.assignmentData, title: e.target.value } }))}
                className="bg-white"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Assignment Type</Label>
              <Select 
                value={editState.assignmentData.assignment_type_id}
                onValueChange={v => setEditState(prev => ({ ...prev, assignmentData: { ...prev.assignmentData, assignment_type_id: v } }))}
              >
                <SelectTrigger className="bg-white"><SelectValue placeholder="Type..." /></SelectTrigger>
                <SelectContent>
                  {assignmentTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-24">
                <Label className="text-xs text-slate-500 mb-1 block">Points</Label>
                <Input 
                  type="number"
                  value={editState.assignmentData.points ?? ""}
                  onChange={e => setEditState(prev => ({ ...prev, assignmentData: { ...prev.assignmentData, points: parseInt(e.target.value) || 0 } }))}
                  className="bg-white"
                />
              </div>
              <div className="w-24">
                <Label className="text-xs text-slate-500 mb-1 block">Weight</Label>
                <Input 
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={editState.assignmentData.weight ?? 1}
                  onChange={e => setEditState(prev => ({ ...prev, assignmentData: { ...prev.assignmentData, weight: parseFloat(e.target.value) || 1 } }))}
                  className="bg-white"
                />
              </div>
              <div className="flex items-center space-x-2 mt-5">
                <Checkbox id="def-points" />
                <Label htmlFor="def-points" className="text-slate-500 text-xs">Default Points</Label>
              </div>
            </div>
            <div></div>

            <div className="col-span-2">
              <Label className="mb-2 block text-xs text-slate-500">Description</Label>
              <RichTextEditor
                value={editState.assignmentData.description || ""}
                onChange={(html) =>
                  setEditState(prev => ({ ...prev, assignmentData: { ...prev.assignmentData, description: html } }))
                }
                placeholder="Describe the assignment..."
                campusId={selectedCampus?.id}
                showEditorPlugins
              />
            </div>

            <div className="col-span-2">
              <Label className="text-xs text-slate-500 mb-1 block">File Attachment</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 border border-slate-300 rounded bg-white hover:bg-slate-50 text-sm text-slate-600">
                  <Paperclip className="h-4 w-4" />
                  <span>{selectedFile ? selectedFile.name : "Choose file..."}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </label>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
                {!selectedFile && (editState.assignmentData as any).file_url && (
                  <a
                    href={(editState.assignmentData as any).file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline"
                  >
                    View current file
                  </a>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Assigned</Label>
              <Input 
                type="date"
                value={editState.assignmentData.assigned_date?.substring(0, 10) || ""}
                onChange={e => setEditState(prev => ({ ...prev, assignmentData: { ...prev.assignmentData, assigned_date: e.target.value } }))}
                className="bg-white max-w-[200px]"
              />
            </div>
            <div className="flex items-center mt-5">
              <Checkbox
                id="apply-all"
                checked={applyToAllPeriods}
                disabled={editState.mode === "edit-assignment"}
                onCheckedChange={c => setApplyToAllPeriods(!!c)}
              />
              <Label htmlFor="apply-all" className="ml-2 text-sm">
                Apply to all Periods for this Course
                {applyToAllPeriods && editState.mode === "add-assignment" && (() => {
                  const selectedCpData = coursePeriods.find(cp => cp.id === selectedCp)
                  const count = coursePeriods.filter(cp => cp.course_id === selectedCpData?.course_id).length
                  return count > 1 ? <span className="ml-1 text-xs text-blue-600">({count} periods)</span> : null
                })()}
              </Label>
            </div>

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Due</Label>
              <Input 
                type="date"
                value={editState.assignmentData.due_date?.substring(0, 10) || ""}
                onChange={e => setEditState(prev => ({ ...prev, assignmentData: { ...prev.assignmentData, due_date: e.target.value } }))}
                className="bg-white max-w-[200px]"
              />
            </div>
            <div className="flex items-center mt-5">
              <Checkbox 
                id="enable-sub" 
                checked={editState.assignmentData.enable_submission}
                onCheckedChange={c => setEditState(prev => ({ ...prev, assignmentData: { ...prev.assignmentData, enable_submission: !!c } }))}  
              />
              <Label htmlFor="enable-sub" className="ml-2 text-sm">Enable Assignment Submission</Label>
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
             <h3 className="text-[#4A90E2] font-semibold text-sm">Grades</h3>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header Context */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Award className="h-8 w-8 text-[#51B4C9]" />
          <h1 className="text-3xl font-bold bg-linear-to-r from-teal-500 to-emerald-600 bg-clip-text text-transparent">
            Assignments - {mpName}
          </h1>
        </div>

        <div className="flex items-center gap-4 bg-muted/30 p-2 rounded-md border text-sm max-w-[500px]">
          <Select value={selectedCp} onValueChange={setSelectedCp}>
            <SelectTrigger className="w-full bg-white h-8"><SelectValue placeholder="Course Period" /></SelectTrigger>
            <SelectContent>
              {coursePeriods.map(cp => (
                <SelectItem key={cp.id} value={cp.id}>{cp.title || cp.course?.title || cp.first_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMp} onValueChange={setSelectedMp}>
            <SelectTrigger className="w-full bg-white h-8"><SelectValue placeholder="Marking Period" /></SelectTrigger>
            <SelectContent>
              {markingPeriods.map(mp => (
                <SelectItem key={mp.id} value={mp.id}>{mp.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Top Form Region */}
      {renderTopForm()}

      {/* Bottom Lists Region */}
      {!loading && (
        <div className="flex gap-8 items-start w-full opacity-80 hover:opacity-100 transition duration-200">
          
          {/* List 1: Assignment Types */}
          <div className="w-[300px]">
            <div className="text-xs text-slate-500 mb-1">{assignmentTypes.length} assignment type{assignmentTypes.length !== 1 ? 's' : ''} was found.</div>
            <div className="border rounded bg-white shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs">Assignment Type</td>
                    <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs text-right">Order</td>
                  </tr>
                </thead>
                <tbody>
                  {assignmentTypes.map(t => (
                    <tr 
                      key={t.id} 
                      className={`border-b cursor-pointer hover:bg-blue-50 transition ${activeType === t.id ? 'bg-blue-50' : ''}`}
                      onClick={() => handleTypeClick(t)}
                    >
                      <td className="p-2 text-[#4A90E2]">{t.title}</td>
                      <td className="p-2 text-slate-500 text-right">{t.sort_order || 0}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="p-2 cursor-pointer hover:bg-slate-50 text-center" onClick={handleAddType}>
                      <Plus className="h-5 w-5 font-bold inline-block" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* List 2: Assignments (only visible if a type is selected, per RosarioSIS logic) */}
          {activeType && (
            <div className="w-[350px]">
              <div className="text-xs text-slate-500 mb-1">{filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''} was found.</div>
              <div className="border rounded bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs">Assignment</td>
                      <td className="p-2 text-[#4A90E2] font-semibold uppercase text-xs text-right">Points</td>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map(a => (
                      <tr 
                        key={a.id} 
                        className={`border-b cursor-pointer hover:bg-blue-50 transition ${activeAssignment === a.id ? 'bg-blue-50' : ''}`}
                        onClick={() => handleAssignmentClick(a)}
                      >
                        <td className="p-2 text-[#4A90E2]">{a.title}</td>
                        <td className="p-2 text-slate-800 font-medium text-right">{a.points}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2} className="p-2 cursor-pointer hover:bg-slate-50 text-center" onClick={handleAddAssignment}>
                        <Plus className="h-5 w-5 font-bold inline-block" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
