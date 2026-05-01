"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getHostelStats, getVisits } from "@/lib/api/hostel";
import { HostelStats, HostelVisit } from "@/types";
import {
  Building2,
  DoorOpen,
  Users,
  BedDouble,
  TrendingUp,
  Eye,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function HostelDashboard() {
  const t = useTranslations("admin.hostel.dashboard");
  const { profile } = useAuth();
  const schoolId = profile?.school_id || "";
  const campusId = profile?.campus_id;

  const [stats, setStats] = useState<HostelStats>({
    total_buildings: 0,
    total_rooms: 0,
    total_capacity: 0,
    occupied_beds: 0,
    occupancy_rate: 0,
    active_visitors: 0,
  });
  const [recentVisits, setRecentVisits] = useState<HostelVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    loadData();
  }, [schoolId]);

  async function loadData() {
    try {
      setLoading(true);
      const [statsData, visitsData] = await Promise.all([
        getHostelStats(schoolId),
        getVisits(schoolId, campusId, { active_only: true }),
      ]);
      setStats(statsData);
      setRecentVisits(visitsData.slice(0, 10));
    } catch (err) {
      console.error("Failed to load hostel dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: t('stat_buildings'),
      value: stats.total_buildings,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: t('stat_rooms'),
      value: stats.total_rooms,
      icon: DoorOpen,
      color: "text-emerald-600",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      title: t('stat_occupied_beds'),
      value: `${stats.occupied_beds}/${stats.total_capacity}`,
      icon: BedDouble,
      color: "text-purple-600",
      bg: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: t('stat_occupancy_rate'),
      value: `${stats.occupancy_rate}%`,
      icon: TrendingUp,
      color: "text-orange-600",
      bg: "bg-orange-100 dark:bg-orange-900/30",
    },
    {
      title: t('stat_active_visitors'),
      value: stats.active_visitors,
      icon: Eye,
      color: "text-rose-600",
      bg: "bg-rose-100 dark:bg-rose-900/30",
    },
  ];

  const quickLinks = [
    { title: t('stat_buildings'), href: "/admin/hostel/buildings", icon: Building2 },
    { title: t('stat_rooms'), href: "/admin/hostel/rooms", icon: DoorOpen },
    { title: t('card_assignments'), href: "/admin/hostel/assignments", icon: Users },
    { title: t('card_visits'), href: "/admin/hostel/visits", icon: Eye },
    { title: t('card_fees'), href: "/admin/hostel/fees", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('header_title')}</h1>
        <p className="text-muted-foreground">
          {t('header_subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => (
          <Card key={card.title} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {loading ? "—" : card.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-5">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5 flex items-center gap-3">
                <link.icon className="h-5 w-5 text-primary" />
                <span className="font-medium text-sm">{link.title}</span>
                <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Active Visitors */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg font-semibold">
            {t('stat_active_visitors')}
          </CardTitle>
          <Link
            href="/admin/hostel/visits"
            className="text-sm text-primary hover:underline"
          >
            {t('btn_view_all')}
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('msg_loading')}
            </div>
          ) : recentVisits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('msg_no_active_visitors')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      {t('th_visitor')}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      {t('th_student')}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      {t('th_room')}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      {t('th_check_in')}
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      {t('th_relation')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((v) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-medium">
                        {v.visitor_name}
                      </td>
                      <td className="py-2 px-3">
                        {v.student_name || v.student_id}
                      </td>
                      <td className="py-2 px-3">{v.room_number || "—"}</td>
                      <td className="py-2 px-3">
                        {new Date(v.check_in).toLocaleString()}
                      </td>
                      <td className="py-2 px-3">{v.visitor_relation || "—"}</td>
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
