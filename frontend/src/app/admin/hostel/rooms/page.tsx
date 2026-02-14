"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRooms,
  getBuildings,
  createRoom,
  updateRoom,
  deleteRoom,
} from "@/lib/api/hostel";
import { HostelRoom, HostelBuilding } from "@/types";
import { Plus, DoorOpen, Edit, Trash2 } from "lucide-react";

export default function RoomsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [buildings, setBuildings] = useState<HostelBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HostelRoom | null>(null);
  const [filterBuilding, setFilterBuilding] = useState("");

  // Form
  const [buildingId, setBuildingId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [floor, setFloor] = useState(1);
  const [capacity, setCapacity] = useState(1);
  const [roomType, setRoomType] = useState("standard");
  const [pricePerMonth, setPricePerMonth] = useState(0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    loadData();
  }, [schoolId, filterBuilding]);

  async function loadData() {
    try {
      setLoading(true);
      const [roomsData, buildingsData] = await Promise.all([
        getRooms(schoolId, filterBuilding || undefined),
        getBuildings(schoolId),
      ]);
      setRooms(roomsData);
      setBuildings(buildingsData);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setBuildingId("");
    setRoomNumber("");
    setFloor(1);
    setCapacity(1);
    setRoomType("standard");
    setPricePerMonth(0);
    setDescription("");
    setEditingRoom(null);
  }

  function openEdit(r: HostelRoom) {
    setEditingRoom(r);
    setBuildingId(r.building_id);
    setRoomNumber(r.room_number);
    setFloor(r.floor);
    setCapacity(r.capacity);
    setRoomType(r.room_type);
    setPricePerMonth(r.price_per_month);
    setDescription(r.description || "");
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!roomNumber || !buildingId) return;
    try {
      setSubmitting(true);
      if (editingRoom) {
        await updateRoom(editingRoom.id, schoolId, {
          room_number: roomNumber,
          floor,
          capacity,
          room_type: roomType,
          price_per_month: pricePerMonth,
          description: description || undefined,
        });
      } else {
        await createRoom({
          building_id: buildingId,
          school_id: schoolId,
          room_number: roomNumber,
          floor,
          capacity,
          room_type: roomType,
          price_per_month: pricePerMonth,
          description: description || undefined,
        });
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save room:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this room?")) return;
    try {
      await deleteRoom(id, schoolId);
      loadData();
    } catch (err) {
      console.error("Failed to delete room:", err);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground">
            Manage hostel rooms within buildings
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-visible">
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? "Edit Room" : "Add Room"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {!editingRoom && (
                <div className="space-y-2">
                  <Label>Building *</Label>
                  <Select value={buildingId} onValueChange={setBuildingId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select building" />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Room Number *</Label>
                  <Input
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 101"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Floor</Label>
                  <Input
                    type="number"
                    min={0}
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Capacity *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={roomType} onValueChange={setRoomType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="suite">Suite</SelectItem>
                      <SelectItem value="shared">Shared</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Price per Month</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pricePerMonth}
                  onChange={(e) => setPricePerMonth(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional..."
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={
                  submitting || !roomNumber || (!editingRoom && !buildingId)
                }
                className="w-full"
              >
                {submitting ? "Saving..." : editingRoom ? "Update" : "Add Room"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <Label className="text-sm">Filter by Building:</Label>
        <Select
          value={filterBuilding || "ALL"}
          onValueChange={(v) => setFilterBuilding(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Buildings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Buildings</SelectItem>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rooms Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12">
              <DoorOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No rooms found</h3>
              <p className="text-muted-foreground">
                Add rooms to your buildings
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-3 px-4 font-medium">Room</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Building
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Floor</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Occupancy
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Price</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">{r.room_number}</td>
                      <td className="py-3 px-4">{r.building_name || "—"}</td>
                      <td className="py-3 px-4">{r.floor}</td>
                      <td className="py-3 px-4 capitalize">{r.room_type}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.min(((r.occupancy || 0) / r.capacity) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {r.occupancy || 0}/{r.capacity}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {r.price_per_month > 0
                          ? `$${r.price_per_month.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {r.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(r)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
  );
}
