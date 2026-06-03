import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { updateStudent } from '@/lib/api/students';
import { updateParent } from '@/lib/api/parents';
import { updateTeacher } from '@/lib/api/teachers';
import { updateStaff } from '@/lib/api/staff';
import { useAuth } from "@/context/AuthContext";

interface EditCredentialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityId: string;
    entityName: string;
    entityType: 'student' | 'parent' | 'teacher' | 'staff';
    schoolId: string;
    campusId?: string; // NEW: For student campus context
    onSuccess?: () => void;
}

export function EditCredentialsModal({
    isOpen,
    onClose,
    entityId,
    entityName,
    entityType,
    schoolId,
    campusId, // NEW
    onSuccess
}: EditCredentialsModalProps) {
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) {
            setError('Password is required');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (entityType === 'student') {
                await updateStudent(entityId, { password }, campusId);
            } else if (entityType === 'parent') {
                await updateParent(entityId, { password });
            } else if (entityType === 'teacher') {
                await updateTeacher(entityId, { password });
            } else if (entityType === 'staff') {
                await updateStaff(entityId, { password });
            }

            toast.success(`Password updated for ${entityName}`);
            setPassword('');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to update credentials:', err);
            toast.error(err.message || 'Failed to update password');
            setError(err.message || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 dark:border dark:border-gray-700 rounded-lg shadow-xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <Lock className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Update Credentials</h2>
                            <p className="text-sm text-gray-500">For {entityName}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
                        disabled={loading}
                    >
                        <X className="h-4 w-4 text-gray-500" />
                    </Button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError(null);
                                }}
                                placeholder="Enter new password"
                                className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {error && (
                            <p className="text-sm text-red-500 animate-in slide-in-from-top-1">{error}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Password must be at least 8 characters long. This will update the user's login credentials immediately.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !password}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update Password'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
