"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X, Eye, EyeOff } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { schoolApi } from "@/lib/api/schools";

interface EditAdminModalProps {
  schoolId: string;
  schoolName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditAdminModal({ schoolId, schoolName, onClose, onSuccess }: EditAdminModalProps) {
  const [formData, setFormData] = useState({
    admin_name: "",
    admin_email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, [schoolId]);

  const fetchAdminData = async () => {
    try {
      setFetching(true);
      const response = await schoolApi.getAdmin(schoolId);
      
      if (response.success && response.data) {
        setFormData({
          admin_name: response.data.admin_name || "",
          admin_email: response.data.admin_email || "",
          password: "", // Never populate password field
        });
      } else {
        toast.error("Failed to load admin information", {
          description: response.error
        });
      }
    } catch (error: any) {
      console.error("Error fetching admin data:", error);
      toast.error("Error loading admin information", {
        description: error.message
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.admin_email.trim()) {
      toast.error("Admin email is required");
      return;
    }

    if (formData.password && formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    try {
      setLoading(true);
      
      const updateData: any = {
        admin_email: formData.admin_email,
      };

      if (formData.admin_name.trim()) {
        updateData.admin_name = formData.admin_name;
      }

      if (formData.password.trim()) {
        updateData.password = formData.password;
      }

      const response = await schoolApi.updateAdmin(schoolId, updateData);
      
      if (response.success) {
        toast.success("Admin information updated successfully");
        onSuccess();
      } else {
        toast.error("Failed to update admin information", {
          description: response.error
        });
      }
    } catch (error: any) {
      toast.error("Error updating admin information", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Admin Information</h2>
            <p className="text-sm text-gray-600 mt-1">{schoolName}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        {fetching ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <Spinner size="md" className="text-[#57A3CC] mb-4" />
            <p className="text-gray-600">Loading admin information...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin_name">Admin Name</Label>
              <Input
                id="admin_name"
                value={formData.admin_name}
                onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                placeholder="Enter admin name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_email">
                Admin Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="admin_email"
                type="email"
                value={formData.admin_email}
                onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                placeholder="admin@school.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                New Password
                <span className="text-sm text-gray-500 ml-2">(Leave empty to keep current)</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formData.password && formData.password.length < 8 && (
                <p className="text-sm text-amber-600">Password should be at least 8 characters</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 gradient-blue"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
