"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  getBuildings,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from "@/lib/api/hostel";
import { HostelBuilding } from "@/types";
import { Plus, Building2, Edit, Trash2, MapPin } from "lucide-react";

export default function BuildingsPage() {
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";

  const [buildings, setBuildings] = useState<HostelBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<HostelBuilding | null>(
    null,
  );

  // Form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [floors, setFloors] = useState(1);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    loadData();
  }, [schoolId]);

  async function loadData() {
    try {
      setLoading(true);
      const data = await getBuildings(schoolId);
      setBuildings(data);
    } catch (err) {
      console.error("Failed to load buildings:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setAddress("");
    setFloors(1);
    setDescription("");
    setEditingBuilding(null);
  }

  function openEdit(b: HostelBuilding) {
    setEditingBuilding(b);
    setName(b.name);
    setAddress(b.address || "");
    setFloors(b.floors);
    setDescription(b.description || "");
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!name) return;
    try {
      setSubmitting(true);
      if (editingBuilding) {
        await updateBuilding(editingBuilding.id, schoolId, {
          name,
          address: address || undefined,
          floors,
          description: description || undefined,
        });
      } else {
        await createBuilding({
          school_id: schoolId,
          name,
          address: address || undefined,
          floors,
          description: description || undefined,
        });
      }
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error("Failed to save building:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this building and all its rooms?")) return;
    try {
      await deleteBuilding(id, schoolId);
      loadData();
    } catch (err) {
      console.error("Failed to delete building:", err);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buildings</h1>
          <p className="text-muted-foreground">
            Manage hostel buildings and dormitories
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
              Add Building
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBuilding ? "Edit Building" : "Add Building"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Block A"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Building address..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Floors</Label>
                  <Input
                    type="number"
                    min={1}
                    value={floors}
                    onChange={(e) => setFloors(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !name}
                className="w-full"
              >
                {submitting
                  ? "Saving..."
                  : editingBuilding
                    ? "Update Building"
                    : "Add Building"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : buildings.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No buildings yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first hostel building to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buildings.map((b) => (
            <Card key={b.id} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{b.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(b)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(b.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {b.address && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-3 w-3" />
                    {b.address}
                  </div>
                )}
                <div className="flex gap-2">
                  <Badge variant="secondary">{b.floors} floor(s)</Badge>
                  <Badge variant="outline">{b.room_count ?? 0} room(s)</Badge>
                  {b.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>
                {b.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {b.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
