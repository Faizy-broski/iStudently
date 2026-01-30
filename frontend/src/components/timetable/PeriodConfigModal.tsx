"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Clock, Settings } from "lucide-react";
import { toast } from "sonner";
import * as teachersApi from "@/lib/api/teachers";
import { useCampus } from "@/context/CampusContext";

interface PeriodConfigModalProps {
    periods: teachersApi.Period[];
    academicYearId: string;
    onPeriodsChange: () => void;
    trigger?: React.ReactNode;
}

export function PeriodConfigModal({
    periods,
    academicYearId,
    onPeriodsChange,
    trigger
}: PeriodConfigModalProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [localPeriods, setLocalPeriods] = useState<Partial<teachersApi.Period>[]>([]);
    
    // Campus context for campus-specific period creation
    const campusContext = useCampus();
    const selectedCampus = campusContext?.selectedCampus;

    const handleOpen = () => {
        // Clone periods for editing
        setLocalPeriods(periods.map(p => ({ ...p })));
        setOpen(true);
    };

    const addPeriod = () => {
        const highestNumber = Math.max(0, ...localPeriods.map(p => p.period_number || 0));
        const lastPeriod = localPeriods[localPeriods.length - 1];
        let startTime = "09:00";

        if (lastPeriod?.end_time) {
            startTime = lastPeriod.end_time;
        }

        setLocalPeriods([...localPeriods, {
            period_number: highestNumber + 1,
            period_name: `Period ${highestNumber + 1}`,
            start_time: startTime,
            end_time: incrementTime(startTime, 45),
            is_break: false
        }]);
    };

    const incrementTime = (time: string, minutes: number): string => {
        const [h, m] = time.split(':').map(Number);
        const totalMinutes = h * 60 + m + minutes;
        const newH = Math.floor(totalMinutes / 60) % 24;
        const newM = totalMinutes % 60;
        return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
    };

    const removePeriod = (index: number) => {
        setLocalPeriods(localPeriods.filter((_, i) => i !== index));
    };

    const updatePeriod = (index: number, field: keyof teachersApi.Period, value: any) => {
        setLocalPeriods(prev => prev.map((p, i) =>
            i === index ? { ...p, [field]: value } : p
        ));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Get existing period IDs
            const existingIds = new Set(periods.map(p => p.id));
            const localIds = new Set(localPeriods.filter(p => p.id).map(p => p.id));

            // Find periods to delete (exist in original but not in local)
            const toDelete = periods.filter(p => !localIds.has(p.id));

            // Find periods to create (no ID) or update (has ID)
            const toCreate = localPeriods.filter(p => !p.id);
            const toUpdate = localPeriods.filter(p => p.id && existingIds.has(p.id));

            // Delete removed periods
            for (const period of toDelete) {
                await teachersApi.deletePeriod(period.id);
            }

            // Create new periods
            for (const period of toCreate) {
                await teachersApi.createPeriod({
                    period_number: period.period_number!,
                    start_time: period.start_time!,
                    end_time: period.end_time!,
                    period_name: period.period_name || undefined,
                    is_break: period.is_break || false,
                    campus_id: selectedCampus?.id
                });
            }

            // Update existing periods
            for (const period of toUpdate) {
                await teachersApi.updatePeriod(period.id!, {
                    period_number: period.period_number,
                    start_time: period.start_time,
                    end_time: period.end_time,
                    period_name: period.period_name || undefined,
                    is_break: period.is_break
                });
            }

            toast.success('Period configuration saved');
            onPeriodsChange();
            setOpen(false);
        } catch (error: any) {
            toast.error(error.message || 'Failed to save periods');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild onClick={handleOpen}>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure Periods
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Period Configuration
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Period List */}
                    <div className="space-y-2">
                        {localPeriods
                            .sort((a, b) => (a.period_number || 0) - (b.period_number || 0))
                            .map((period, index) => (
                                <div
                                    key={period.id || `new-${index}`}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${period.is_break ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-gray-800 dark:border-gray-700'
                                        }`}
                                >
                                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                                    <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                                        <Input
                                            value={period.period_name || `Period ${period.period_number}`}
                                            onChange={(e) => updatePeriod(index, 'period_name', e.target.value)}
                                            className="h-8 text-sm"
                                            placeholder="Period name"
                                        />

                                        <Input
                                            type="time"
                                            value={period.start_time || ''}
                                            onChange={(e) => updatePeriod(index, 'start_time', e.target.value)}
                                            className="h-8 text-sm"
                                        />

                                        <Input
                                            type="time"
                                            value={period.end_time || ''}
                                            onChange={(e) => updatePeriod(index, 'end_time', e.target.value)}
                                            className="h-8 text-sm"
                                        />

                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={period.is_break || false}
                                                onCheckedChange={(checked) => updatePeriod(index, 'is_break', checked)}
                                            />
                                            <Label className="text-xs">Break</Label>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removePeriod(index)}
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                    </div>

                    {/* Add Period Button */}
                    <Button variant="outline" className="w-full" onClick={addPeriod}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Period
                    </Button>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-[#022172] hover:bg-[#022172]/90"
                        >
                            Save Configuration
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
