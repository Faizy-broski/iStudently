"use client";

import Link from "next/link";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";
import { getMissingSummary } from "@/lib/api/textbook-deliveries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, BookX, Users } from "lucide-react";

export default function MissingBooksDashboardPage() {
  const t = useTranslations("textbooks.dashboard");
  const { user } = useAuth();
  const campusContext = useCampus();

  const cacheKey = user ? ["textbook-missing-summary", campusContext?.selectedCampus?.id] : null;
  const { data, error, isLoading } = useSWR(
    cacheKey,
    async () => {
      const res = await getMissingSummary(campusContext?.selectedCampus?.id);
      if (!res.success) throw new Error(res.error || t("loadError"));
      return res.data!;
    },
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#022172] dark:text-white">{t("pageTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        <Link href="/admin/textbooks/matrix" className="text-sm underline text-[#022172] dark:text-white">
          {t("goToMatrix")}
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      )}
      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.by_book.map((b) => (
              <Card key={b.book_id} className={`border-t-4 ${b.missing_count > 0 ? "border-t-red-500" : "border-t-green-500"}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.grade_level_name || "—"}</p>
                    </div>
                    <BookX className={`h-5 w-5 ${b.missing_count > 0 ? "text-red-500" : "text-green-500"}`} />
                  </div>
                  <p className={`text-2xl font-bold mt-2 ${b.missing_count > 0 ? "text-red-600" : "text-green-600"}`}>
                    {b.missing_count}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("missingOf", { count: b.total_students })}</p>
                </CardContent>
              </Card>
            ))}
            {data.by_book.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">{t("noActiveTextbooks")}</p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> {t("bySection")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-medium">{t("thSection")}</th>
                      <th className="px-3 py-2 font-medium">{t("thStudents")}</th>
                      <th className="px-3 py-2 font-medium">{t("thMissing")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_section.map((s) => (
                      <tr key={s.section_id} className="border-b">
                        <td className="px-3 py-2">{s.section_name}</td>
                        <td className="px-3 py-2">{s.total_students}</td>
                        <td className={`px-3 py-2 font-medium ${s.missing_count > 0 ? "text-red-600" : "text-green-600"}`}>
                          {s.missing_count}
                        </td>
                      </tr>
                    ))}
                    {data.by_section.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">{t("noSections")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
