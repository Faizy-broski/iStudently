"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, PieChart, List, Loader2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getLoansBreakdown } from "@/lib/api/library";

interface ChartDataPoint {
    period: string;
    count: number;
    category?: string;
}

interface LoansBreakdownChartProps {
    className?: string;
}

type ViewMode = "bar" | "list";
type TimeRange = "7d" | "30d" | "90d" | "12m";

export function LoansBreakdownChart({ className }: LoansBreakdownChartProps) {
    const { user } = useAuth();
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [totalLoans, setTotalLoans] = useState(0);
    const [categories, setCategories] = useState<{ name: string; color: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("bar");
    const [timeRange, setTimeRange] = useState<TimeRange>("30d");
    const [byCategory, setByCategory] = useState(false);

    useEffect(() => {
        loadData();
    }, [timeRange, byCategory]);

    const { startDate, endDate } = useMemo(() => {
        const end = new Date();
        const start = new Date();
        switch (timeRange) {
            case "7d": start.setDate(end.getDate() - 7); break;
            case "30d": start.setDate(end.getDate() - 30); break;
            case "90d": start.setDate(end.getDate() - 90); break;
            case "12m": start.setFullYear(end.getFullYear() - 1); break;
        }
        return {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
        };
    }, [timeRange]);

    const loadData = async () => {
        if (!user?.access_token) return;
        try {
            setIsLoading(true);
            const res = await getLoansBreakdown(startDate, endDate, byCategory, user.access_token);
            if (res.success && res.data) {
                setChartData(res.data.chart_data || []);
                setCategories(res.data.categories || []);
                setTotalLoans(res.data.total_loans || 0);
            }
        } catch (error) {
            console.error("Error loading breakdown:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const maxCount = Math.max(...chartData.map((d) => d.count), 1);

    return (
        <Card className={cn("shadow-sm", className)}>
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Loans Breakdown</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {totalLoans} total loan{totalLoans !== 1 ? "s" : ""} in period
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Time Range */}
                        <div className="flex gap-0.5 p-0.5 bg-muted rounded-md">
                            {(["7d", "30d", "90d", "12m"] as TimeRange[]).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTimeRange(t)}
                                    className={cn(
                                        "px-2 py-1 rounded text-xs font-medium transition-all",
                                        timeRange === t
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* View Mode */}
                        <div className="flex gap-0.5 p-0.5 bg-muted rounded-md">
                            <button
                                onClick={() => setViewMode("bar")}
                                className={cn(
                                    "p-1.5 rounded transition-all",
                                    viewMode === "bar"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={cn(
                                    "p-1.5 rounded transition-all",
                                    viewMode === "list"
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <List className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <Button
                            size="sm"
                            variant={byCategory ? "default" : "outline"}
                            onClick={() => setByCategory(!byCategory)}
                            className="h-7 text-xs"
                        >
                            By Category
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        No loan data for this period.
                    </div>
                ) : viewMode === "bar" ? (
                    /* Simple CSS bar chart */
                    <div className="space-y-2">
                        {chartData.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-20 shrink-0 text-right font-mono">
                                    {item.period}
                                </span>
                                <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
                                    <div
                                        className="h-full rounded-md transition-all duration-500 relative"
                                        style={{
                                            width: `${Math.max((item.count / maxCount) * 100, 2)}%`,
                                            background: item.category
                                                ? categories.find((c) => c.name === item.category)?.color || "#6366F1"
                                                : "linear-gradient(to right, #57A3CC, #022172)",
                                        }}
                                    >
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow">
                                            {item.count}
                                        </span>
                                    </div>
                                </div>
                                {item.category && (
                                    <Badge variant="outline" className="text-[10px] shrink-0">
                                        {item.category}
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 font-medium text-muted-foreground">Period</th>
                                    {byCategory && <th className="text-left py-2 font-medium text-muted-foreground">Category</th>}
                                    <th className="text-right py-2 font-medium text-muted-foreground">Loans</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chartData.map((item, i) => (
                                    <tr key={i} className="border-b last:border-b-0 hover:bg-muted/50">
                                        <td className="py-2 font-mono text-xs">{item.period}</td>
                                        {byCategory && (
                                            <td className="py-2">
                                                <div className="flex items-center gap-1.5">
                                                    <div
                                                        className="h-2.5 w-2.5 rounded-full"
                                                        style={{
                                                            backgroundColor: categories.find((c) => c.name === item.category)?.color || "#6B7280",
                                                        }}
                                                    />
                                                    <span className="text-xs">{item.category || "Uncategorized"}</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="py-2 text-right font-semibold">{item.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Category Legend */}
                {byCategory && categories.length > 0 && viewMode === "bar" && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                        {categories.map((cat) => (
                            <div key={cat.name} className="flex items-center gap-1.5">
                                <div
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: cat.color }}
                                />
                                <span className="text-[11px] text-muted-foreground">{cat.name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
