'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowRight, Save, GraduationCap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface GradeLevel {
  id: string;
  school_id: string;
  name: string;
  order_index: number;
  base_fee: number;
  is_active: boolean;
  next_grade_id?: string | null;
  created_at: string;
  updated_at: string;
}

export default function GradeProgressionPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch grade levels
  useEffect(() => {
    if (user?.school_id) {
      fetchGrades();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.school_id]);

  async function fetchGrades() {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/academics/grades?school_id=${user?.school_id}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) throw new Error('Failed to fetch grade levels');

      const data = await response.json();
      setGrades(data.sort((a: GradeLevel, b: GradeLevel) => a.order_index - b.order_index));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load grades';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function updateGradeProgression(gradeId: string, nextGradeId: string | null) {
    try {
      setSaving(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/academics/grades/${gradeId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            next_grade_id: nextGradeId === 'GRADUATE' ? null : nextGradeId || null,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to update grade progression');

      // Update local state
      setGrades((prev) =>
        prev.map((g) =>
          g.id === gradeId
            ? { ...g, next_grade_id: nextGradeId === 'GRADUATE' ? null : nextGradeId || null }
            : g
        )
      );

      toast.success('Grade progression updated');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAllProgressions() {
    try {
      setSaving(true);
      let successCount = 0;

      for (const grade of grades) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/academics/grades/${grade.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              next_grade_id: grade.next_grade_id,
            }),
          }
        );

        if (response.ok) successCount++;
      }

      if (successCount === grades.length) {
        toast.success('All grade progressions saved');
      } else {
        toast.warning(`${successCount} of ${grades.length} grades updated`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save progressions';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  // Get available next grades for a given grade (must have higher order_index)
  function getAvailableNextGrades(currentGrade: GradeLevel): GradeLevel[] {
    return grades.filter((g) => g.order_index > currentGrade.order_index && g.is_active);
  }

  // Build progression chain visualization
  function buildProgressionChain(): string[] {
    const chain: string[] = [];
    const visited = new Set<string>();

    // Find first grade (lowest order_index)
    const firstGrade = grades.find((g) => g.order_index === Math.min(...grades.map((gr) => gr.order_index)));

    if (!firstGrade) return [];

    let current: GradeLevel | undefined = firstGrade;

    while (current && chain.length < 20) {
      // Prevent infinite loops
      if (visited.has(current.id)) break;

      visited.add(current.id);
      chain.push(current.name);

      if (!current.next_grade_id) {
        chain.push('GRADUATE');
        break;
      }

      current = grades.find((g) => g.id === current!.next_grade_id);
    }

    return chain;
  }

  const progressionChain = buildProgressionChain();

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading grade levels...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Grade Progression</h1>
            <p className="text-muted-foreground mt-1">
              Configure how students advance from one grade to the next during year-end rollover
            </p>
          </div>
          <Button onClick={saveAllProgressions} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save All
          </Button>
        </div>

        {/* Progression Chain Visualization */}
        {progressionChain.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Progression Path</CardTitle>
              <CardDescription>Visual representation of your grade progression chain</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                {progressionChain.map((grade, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div
                      className={`px-4 py-2 rounded-lg font-medium ${
                        grade === 'GRADUATE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {grade === 'GRADUATE' ? (
                        <span className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Graduate
                        </span>
                      ) : (
                        grade
                      )}
                    </div>
                    {index < progressionChain.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grade Progression Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configure Grade Progression</CardTitle>
            <CardDescription>
              Set the next grade for each level. Students will automatically be promoted to their next grade
              during rollover.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {grades.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No grade levels found. Create grade levels first from the Academics menu.
                </div>
              )}

              {grades.map((grade) => {
                const availableNextGrades = getAvailableNextGrades(grade);

                return (
                  <div
                    key={grade.id}
                    className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition"
                  >
                    {/* Current Grade Info */}
                    <div className="flex-1">
                      <div className="font-medium">{grade.name}</div>
                      <div className="text-sm text-muted-foreground">Order: {grade.order_index}</div>
                    </div>

                    <ArrowRight className="h-5 w-5 text-muted-foreground" />

                    {/* Next Grade Selector */}
                    <div className="flex-1">
                      <Label htmlFor={`next-grade-${grade.id}`} className="sr-only">
                        Next Grade
                      </Label>
                      <Select
                        value={grade.next_grade_id || 'GRADUATE'}
                        onValueChange={(value) => updateGradeProgression(grade.id, value)}
                        disabled={saving}
                      >
                        <SelectTrigger id={`next-grade-${grade.id}`}>
                          <SelectValue placeholder="Select next grade" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableNextGrades.map((nextGrade) => (
                            <SelectItem key={nextGrade.id} value={nextGrade.id}>
                              {nextGrade.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="GRADUATE">
                            <span className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4" />
                              Graduate (No Next Grade)
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status Badge */}
                    <div className="w-32 text-right">
                      {grade.next_grade_id ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Promotes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Graduates
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-blue-900">How Grade Progression Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p>
              <strong>Automatic Promotion:</strong> During year-end rollover, students will automatically advance
              to their grade&apos;s next grade.
            </p>
            <p>
              <strong>Graduation:</strong> If a grade has no next grade set, students in that grade will be
              marked as graduated (they won&apos;t receive a new enrollment for next year).
            </p>
            <p>
              <strong>Retention:</strong> You can override individual student promotions by setting their rollover
              status to &quot;Retained&quot; before executing rollover.
            </p>
            <p>
              <strong>Circular References:</strong> The system prevents circular progression chains (e.g., Grade 1
              → Grade 2 → Grade 1).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
