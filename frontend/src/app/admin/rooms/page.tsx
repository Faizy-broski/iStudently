"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  DoorOpen,
  Search,
  Building2,
  Ban,
  RotateCcw,
} from "lucide-react"
import { useCampus } from "@/context/CampusContext"
import * as roomsApi from "@/lib/api/rooms"
import type { Room, RoomType } from "@/lib/api/rooms"

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  classroom: "Classroom",
  lab: "Lab",
  auditorium: "Auditorium",
  library: "Library",
  gym: "Gym",
  office: "Office",
  other: "Other",
}

const ROOM_TYPE_BADGE_CLASS: Record<RoomType, string> = {
  classroom: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  lab: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  auditorium: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  library: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  gym: "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  office: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

export default function RoomsPage() {
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)

  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<RoomType>("classroom")
  const [newCapacity, setNewCapacity] = useState("")
  const [newBuilding, setNewBuilding] = useState("")
  const [newFloor, setNewFloor] = useState("")

  const loadRooms = useCallback(async () => {
    setLoading(true)
    try {
      const data = await roomsApi.listRooms(selectedCampus?.id, !showInactive)
      setRooms(data)
    } catch (err: any) {
      toast.error(err.message || "Failed to load rooms")
    } finally {
      setLoading(false)
    }
  }, [selectedCampus?.id, showInactive])

  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.building || "").toLowerCase().includes(q) ||
        ROOM_TYPE_LABELS[r.room_type].toLowerCase().includes(q)
    )
  }, [rooms, search])

  const handleAddRoom = async () => {
    if (!newName.trim()) {
      toast.error("Room name is required")
      return
    }
    setSaving(true)
    try {
      await roomsApi.createRoom({
        name: newName.trim(),
        campus_id: selectedCampus?.id,
        room_type: newType,
        capacity: newCapacity ? parseInt(newCapacity) : undefined,
        building: newBuilding.trim() || undefined,
        floor: newFloor.trim() || undefined,
      })
      toast.success(`Room "${newName.trim()}" added`)
      setNewName("")
      setNewCapacity("")
      setNewBuilding("")
      setNewFloor("")
      setNewType("classroom")
      loadRooms()
    } catch (err: any) {
      toast.error(err.message || "Failed to add room")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (room: Room) => {
    try {
      await roomsApi.updateRoom(room.id, { is_active: !room.is_active })
      toast.success(room.is_active ? `"${room.name}" deactivated` : `"${room.name}" reactivated`)
      loadRooms()
    } catch (err: any) {
      toast.error(err.message || "Failed to update room")
    }
  }

  const handleDelete = async (room: Room) => {
    try {
      await roomsApi.deleteRoom(room.id)
      toast.success(`"${room.name}" deleted`)
      loadRooms()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete room")
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <Link href="/admin/timetable" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Timetable
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-[#022172] dark:text-white flex items-center gap-2">
            <DoorOpen className="h-7 w-7" /> Rooms
          </h1>
          <p className="text-muted-foreground">
            Classrooms, labs and other spaces used for the timetable{selectedCampus ? ` — ${selectedCampus.name}` : ""}.
            Distinct from hostel/dormitory rooms.
          </p>
        </div>
      </div>

      {/* Add room */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Add Room</CardTitle>
          <CardDescription>Rooms are used by the auto-generator for room-conflict checks and room-type matching (e.g. labs need a lab room).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Name *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Room 101" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as RoomType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Capacity</Label>
              <Input type="number" min={1} value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} placeholder="30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Building</Label>
              <Input value={newBuilding} onChange={(e) => setNewBuilding(e.target.value)} placeholder="Main" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Floor</Label>
              <Input value={newFloor} onChange={(e) => setNewFloor(e.target.value)} placeholder="1" />
            </div>
            <div className="col-span-2 md:col-span-6 flex justify-end">
              <Button onClick={handleAddRoom} disabled={saving} className="bg-[#022172] hover:bg-[#022172]/90 text-white gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Room
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms table */}
      <Card>
        <CardHeader className="py-3 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="text-base">Rooms ({filteredRooms.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={showInactive ? "default" : "outline"}
                size="sm"
                className={showInactive ? "bg-[#022172] text-white" : ""}
                onClick={() => setShowInactive((v) => !v)}
              >
                {showInactive ? "Showing inactive" : "Show inactive"}
              </Button>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rooms..."
                  className="pl-8 w-56"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-16 text-center px-6">
              <Building2 className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium text-muted-foreground">
                {rooms.length === 0 ? "No rooms defined yet" : "No rooms match your search"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {rooms.length === 0
                  ? "Add classrooms, labs, and other spaces above so the timetable generator can assign them and avoid double-booking."
                  : "Try a different search term."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Capacity</th>
                    <th className="p-3 text-left">Building</th>
                    <th className="p-3 text-left">Floor</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room) => (
                    <tr key={room.id} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-medium">{room.name}</td>
                      <td className="p-3">
                        <Badge className={ROOM_TYPE_BADGE_CLASS[room.room_type]}>
                          {ROOM_TYPE_LABELS[room.room_type]}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{room.capacity ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{room.building || "—"}</td>
                      <td className="p-3 text-muted-foreground">{room.floor || "—"}</td>
                      <td className="p-3">
                        {room.is_active ? (
                          <Badge variant="outline" className="text-green-700 border-green-300 dark:text-green-400 dark:border-green-800">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title={room.is_active ? "Deactivate" : "Reactivate"}
                            onClick={() => handleToggleActive(room)}
                          >
                            {room.is_active ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Delete" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete "{room.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the room. Any timetable entries currently using it will keep their
                                  slot but lose the room assignment. Consider "Deactivate" instead if you just want to stop
                                  new assignments while keeping history.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(room)} className="bg-destructive hover:bg-destructive/90 text-white">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
