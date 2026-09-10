"use client"

// Soroban mental-math trainer — full feature set ported from the reference
// "سوروبان جهبذ" app: a progressive curriculum, multiplication/division
// drills, kyu-style level exams with printable certificates, an error-hunt
// game, printable worksheets, a complements speed drill, anzan (flash) with
// an optional voice/board mode plus a standardized exam, dictation,
// slip/chain calculation, number formation/reading drills, a step-by-step
// explainer, and a session report with localStorage-persisted cross-session
// progress. Bilingual via the same inline tt(en, ar) convention the other
// Edu Resources tools use — no messages.json namespace for this family.

import { Calculator } from "lucide-react"
import { useTranslations } from "next-intl"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useTT } from "./mental-math/useTT"
import { useSessionLog } from "./mental-math/useSessionLog"
import { useProgress } from "./mental-math/useProgress"
import { FreePractice } from "./mental-math/FreePractice"
import { TimedDrill } from "./mental-math/TimedDrill"
import { Course } from "./mental-math/Course"
import { Multiplication } from "./mental-math/Multiplication"
import { Division } from "./mental-math/Division"
import { LevelExam } from "./mental-math/LevelExam"
import { ErrorHunt } from "./mental-math/ErrorHunt"
import { Worksheet } from "./mental-math/Worksheet"
import { Complements } from "./mental-math/Complements"
import { Anzan } from "./mental-math/Anzan"
import { Dictation } from "./mental-math/Dictation"
import { Slips } from "./mental-math/Slips"
import { NumberFormation } from "./mental-math/NumberFormation"
import { StepExplainer } from "./mental-math/StepExplainer"
import { SessionReport } from "./mental-math/SessionReport"

export function MentalMath() {
  const tt = useTT()
  const tSidebar = useTranslations("sidebar")
  const session = useSessionLog()
  const progress = useProgress()

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <h1 className="flex items-center gap-2 text-xl font-bold text-blue-900 dark:text-blue-300">
        <Calculator className="h-5 w-5" />
        {tSidebar("mental_math")}
      </h1>

      <Tabs defaultValue="practice">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="practice">{tt("Free Practice", "تمرين حر")}</TabsTrigger>
          <TabsTrigger value="course">{tt("Course", "المنهج المتدرج")}</TabsTrigger>
          <TabsTrigger value="drill">{tt("Timed Drill", "تمرين موقوت")}</TabsTrigger>
          <TabsTrigger value="mult">{tt("Multiplication", "الضرب")}</TabsTrigger>
          <TabsTrigger value="div">{tt("Division", "القسمة")}</TabsTrigger>
          <TabsTrigger value="exam">{tt("Level Exam", "اختبار المستوى")}</TabsTrigger>
          <TabsTrigger value="hunt">{tt("Error Hunt", "اكتشاف الخطأ")}</TabsTrigger>
          <TabsTrigger value="sheet">{tt("Worksheet", "ورقة عمل")}</TabsTrigger>
          <TabsTrigger value="comp">{tt("Complements", "المكوّنات")}</TabsTrigger>
          <TabsTrigger value="anzan">{tt("Anzan", "الأنزان")}</TabsTrigger>
          <TabsTrigger value="dict">{tt("Dictation", "الإملاء")}</TabsTrigger>
          <TabsTrigger value="slips">{tt("Slips", "القسائم")}</TabsTrigger>
          <TabsTrigger value="form">{tt("Formation/Reading", "تكوين وقراءة")}</TabsTrigger>
          <TabsTrigger value="calc">{tt("Step Explainer", "شرح خطوة بخطوة")}</TabsTrigger>
          <TabsTrigger value="report">{tt("Session Report", "تقرير الجلسة")}</TabsTrigger>
        </TabsList>

        <TabsContent value="practice"><FreePractice /></TabsContent>
        <TabsContent value="course"><Course session={session} progress={progress} /></TabsContent>
        <TabsContent value="drill"><TimedDrill session={session} /></TabsContent>
        <TabsContent value="mult"><Multiplication session={session} /></TabsContent>
        <TabsContent value="div"><Division session={session} /></TabsContent>
        <TabsContent value="exam"><LevelExam session={session} /></TabsContent>
        <TabsContent value="hunt"><ErrorHunt session={session} /></TabsContent>
        <TabsContent value="sheet"><Worksheet /></TabsContent>
        <TabsContent value="comp"><Complements session={session} /></TabsContent>
        <TabsContent value="anzan"><Anzan session={session} /></TabsContent>
        <TabsContent value="dict"><Dictation session={session} /></TabsContent>
        <TabsContent value="slips"><Slips session={session} /></TabsContent>
        <TabsContent value="form"><NumberFormation session={session} /></TabsContent>
        <TabsContent value="calc"><StepExplainer /></TabsContent>
        <TabsContent value="report"><SessionReport session={session} progress={progress} level={progress.progress.level} /></TabsContent>
      </Tabs>
    </div>
  )
}
