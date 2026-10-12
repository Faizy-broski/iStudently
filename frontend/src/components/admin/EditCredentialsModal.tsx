import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, X, Lock } from "lucide-react";
import { toast } from "sonner";
import { updateStudent } from '@/lib/api/students';
import { updateParent } from '@/lib/api/parents';
import { updateTeacher } from '@/lib/api/teachers';
import { updateStaff } from '@/lib/api/staff';
import { getUsername, bulkGetOrCreateCredentials } from '@/lib/api/credentials';
import { useAuth } from "@/context/AuthContext";

interface EditCredentialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    entityId: string;
    entityName: string;
    entityType: 'student' | 'parent' | 'teacher' | 'staff';
    schoolId: string;
    campusId?: string; // NEW: For student campus context
    // profiles.id for this entity — used only to prefill the current username.
    // If omitted, the username field starts blank (still editable).
    profileId?: string;
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
    profileId,
    onSuccess
}: EditCredentialsModalProps) {
    const [loading, setLoading] = useState(false);
    const [loadingUsername, setLoadingUsername] = useState(false);
    const [username, setUsername] = useState('');
    const [originalUsername, setOriginalUsername] = useState('');
    const [password, setPassword] = useState('');
    // The password as it was prefilled (not sent anywhere) — lets submit tell
    // "admin left the prefilled password untouched" apart from "admin typed a
    // new one", so just opening and closing this modal never rotates a
    // password that was never actually changed.
    const [originalPassword, setOriginalPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Prefill the current username AND password so the admin can see them —
    // reuses the same admin-gated credentials lookup the Advanced Report's
    // Username/Password columns and the "view/print credentials" screens
    // already use, rather than leaving this one modal as the odd one out
    // that only ever showed the username.
    useEffect(() => {
        if (!isOpen || !profileId) {
            setUsername('');
            setOriginalUsername('');
            setPassword('');
            setOriginalPassword('');
            return;
        }
        setLoadingUsername(true);
        bulkGetOrCreateCredentials([profileId])
            .then((res) => {
                const cred = res.success ? res.data?.credentials?.[0] : undefined
                setUsername(cred?.username || '');
                setOriginalUsername(cred?.username || '');
                setPassword(cred?.password || '');
                setOriginalPassword(cred?.password || '');
            })
            .catch(() => {
                // Fall back to username-only if the credentials lookup fails
                // (e.g. this profile has no login_password_enc yet and
                // generation itself failed) — still better than a fully blank form.
                getUsername(profileId)
                    .then((res) => {
                        const u = (res.success && res.data?.username) || ''
                        setUsername(u);
                        setOriginalUsername(u);
                    })
                    .catch(() => {})
            })
            .finally(() => setLoadingUsername(false));
    }, [isOpen, profileId]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedUsername = username.trim();
        // Both fields are now prefilled with the current values, so "changed"
        // must compare against what was actually loaded — otherwise simply
        // opening and submitting this modal untouched would resend the same
        // username/password as a "change" every time.
        const usernameChanged = trimmedUsername.length > 0 && trimmedUsername !== originalUsername;
        const passwordChanged = password.length > 0 && password !== originalPassword;

        if (!usernameChanged && !passwordChanged) {
            setError('Enter a username and/or a new password to update');
            return;
        }
        if (passwordChanged && password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payload: { username?: string; password?: string } = {};
            if (usernameChanged) payload.username = trimmedUsername;
            if (passwordChanged) payload.password = password;

            if (entityType === 'student') {
                await updateStudent(entityId, payload, campusId);
            } else if (entityType === 'parent') {
                await updateParent(entityId, payload);
            } else if (entityType === 'teacher') {
                await updateTeacher(entityId, payload);
            } else if (entityType === 'staff') {
                await updateStaff(entityId, payload);
            }

            toast.success(`Credentials updated for ${entityName}`);
            setPassword('');
            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to update credentials:', err);
            toast.error(err.message || 'Failed to update credentials');
            setError(err.message || 'Failed to update credentials');
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
                        <Label htmlFor="edit-username">Username</Label>
                        <Input
                            id="edit-username"
                            type="text"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                if (error) setError(null);
                            }}
                            placeholder={loadingUsername ? "Loading current username…" : "Username"}
                            disabled={loading || loadingUsername}
                        />
                        <p className="text-xs text-muted-foreground">
                            This is what the user logs in with if they don&apos;t have a real email on file.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-password">Password</Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError(null);
                                }}
                                placeholder={loadingUsername ? "Loading current password…" : "Password"}
                                className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
                                disabled={loading || loadingUsername}
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
                            This is the current password. Edit it to set a new one — changes apply immediately. Must be at least 8 characters.
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
                            disabled={
                                loading ||
                                loadingUsername ||
                                (username.trim() === originalUsername && password === originalPassword)
                            }
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Update Credentials'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
