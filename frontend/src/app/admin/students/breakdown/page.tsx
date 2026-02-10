"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  BarChart3, 
  PieChartIcon, 
  List, 
  Loader2,
  Building2,
  Users
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useCampus } from "@/context/CampusContext";
import { getStudents, Student } from "@/lib/api/students";

// Color palette for charts
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#22c55e', '#0ea5e9'
];

// Available breakdown fields
const BREAKDOWN_FIELDS = [
  { id: 'grade_level', label: 'Grade Level' },
  { id: 'section', label: 'Section' },
  { id: 'gender', label: 'Gender' },
  { id: 'blood_group', label: 'Blood Group' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'status', label: 'Status (Active/Inactive)' },
];

// Extract field value from student
function getFieldValue(student: Student, fieldId: string): string {
  const studentExt = student as Student & {
    grade_level?: string;
    grade_level_name?: string;
    section_name?: string;
    section_id?: string;
    custom_fields?: Record<string, Record<string, unknown>>;
    medical_info?: { blood_group?: string; allergies?: string[] };
  };
  
  switch (fieldId) {
    case 'grade_level':
      return studentExt.grade_level_name || studentExt.grade_level || 'Not Assigned';
    case 'section':
      return studentExt.section_name || 'Not Assigned';
    case 'gender':
      const gender = studentExt.custom_fields?.personal?.gender;
      return typeof gender === 'string' ? gender : 'Not Specified';
    case 'blood_group':
      const bloodGroup = studentExt.custom_fields?.medical?.bloodGroup || 
                         studentExt.medical_info?.blood_group;
      return typeof bloodGroup === 'string' && bloodGroup ? bloodGroup : 'Not Specified';
    case 'allergies':
      const allergies = studentExt.custom_fields?.medical?.allergiesList || 
                        studentExt.medical_info?.allergies;
      if (Array.isArray(allergies) && allergies.length > 0) {
        return 'Has Allergies';
      }
      return 'No Allergies';
    case 'status':
      return student.profile?.is_active ? 'Active' : 'Inactive';
    default:
      return 'Unknown';
  }
}

// Aggregate data for charts
function aggregateData(students: Student[], fieldId: string): { name: string; value: number; percentage: string }[] {
  const counts: Record<string, number> = {};
  
  students.forEach(student => {
    const value = getFieldValue(student, fieldId);
    counts[value] = (counts[value] || 0) + 1;
  });
  
  const total = students.length;
  
  return Object.entries(counts)
    .map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.value - a.value);
}

export default function StudentBreakdownPage() {
  const campusContext = useCampus();
  const selectedCampus = campusContext?.selectedCampus;
  
  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState<string>('grade_level');
  const [chartType, setChartType] = useState<string>('pie');
  
  // Load all students
  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const response = await getStudents({
          page: 1,
          limit: 1000,
          campus_id: selectedCampus?.id
        });
        
        if (response.success && response.data) {
          setStudents(response.data);
        }
      } catch (error) {
        console.error('Failed to load students:', error);
        toast.error('Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    
    loadStudents();
  }, [selectedCampus?.id]);
  
  // Aggregated data for selected field
  const chartData = useMemo(() => {
    return aggregateData(students, selectedField);
  }, [students, selectedField]);
  
  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; percentage: string } }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Count: <span className="font-medium text-foreground">{data.value}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Percentage: <span className="font-medium text-foreground">{data.percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/admin/students" className="hover:text-foreground">
              Students
            </Link>
            <span>/</span>
            <span>Student Breakdown</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Student Breakdown</h1>
          <p className="text-muted-foreground">
            Visualize student data distribution across different categories
          </p>
        </div>
        <div className="flex items-center gap-4">
          {selectedCampus && (
            <Badge variant="outline" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {selectedCampus.name}
            </Badge>
          )}
          <Badge variant="secondary" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {students.length} Students
          </Badge>
        </div>
      </div>
      
      {/* Controls */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap font-medium">Breakdown By:</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BREAKDOWN_FIELDS.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-3 ml-auto">
              <Label className="whitespace-nowrap font-medium">View:</Label>
              <Tabs value={chartType} onValueChange={setChartType}>
                <TabsList>
                  <TabsTrigger value="pie" className="flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4" />
                    Pie
                  </TabsTrigger>
                  <TabsTrigger value="bar" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Column
                  </TabsTrigger>
                  <TabsTrigger value="list" className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    List
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Chart Display */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : chartData.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96 text-muted-foreground">
            <Users className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No Data Available</p>
            <p className="text-sm">No students found for the selected criteria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {BREAKDOWN_FIELDS.find(f => f.id === selectedField)?.label} Distribution
              </CardTitle>
              <CardDescription>
                Showing breakdown of {students.length} students
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartType === 'pie' && (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={150}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${name} (${percentage}%)`}
                    >
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
              
              {chartType === 'bar' && (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              
              {chartType === 'list' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {chartData.map((item, index) => (
                    <div 
                      key={item.name} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary">{item.value} students</Badge>
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                Quick statistics for {BREAKDOWN_FIELDS.find(f => f.id === selectedField)?.label}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold">{students.length}</p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-3xl font-bold">{chartData.length}</p>
              </div>
              
              {chartData.length > 0 && (
                <>
                  <div className="p-4 rounded-lg bg-primary/10">
                    <p className="text-sm text-muted-foreground">Largest Group</p>
                    <p className="text-lg font-bold">{chartData[0].name}</p>
                    <p className="text-sm text-muted-foreground">
                      {chartData[0].value} students ({chartData[0].percentage}%)
                    </p>
                  </div>
                  
                  {chartData.length > 1 && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Smallest Group</p>
                      <p className="text-lg font-bold">{chartData[chartData.length - 1].name}</p>
                      <p className="text-sm text-muted-foreground">
                        {chartData[chartData.length - 1].value} students ({chartData[chartData.length - 1].percentage}%)
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {/* Legend for colors */}
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">Legend</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {chartData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
