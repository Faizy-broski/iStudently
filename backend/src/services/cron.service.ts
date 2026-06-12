import cron from "node-cron";
import { salaryService } from "./salary.service";
import { supabase } from "../config/supabase";
import { generateDailyAttendance } from "./attendance.service";
import { HostelService } from "./hostel.service";
import { diaryReminderService } from "./diary-reminder.service";
import { AutomaticRecordsService } from "./automaticRecords.service";

/**
 * AUTOMATED CRON SERVICE
 *
 * This service runs automated tasks for school management:
 * 1. Monthly Salary Generation - Generates salaries for all schools on the 1st of every month
 * 2. Daily Attendance Generation - Auto-marks all students as present every morning
 * 3. Advance Recovery - Marks advances as recovered when salary is generated
 * 4. Late Fee Automation (Future) - Can be extended for late fees
 */

class CronService {
  private isInitialized = false;

  /**
   * Initialize all cron jobs
   */
  init() {
    if (this.isInitialized) {
      return;
    }

    // Auto-Attendance: check every 5 minutes.
    // For each school/campus, generate attendance once per day after its
    // configured hour (mirrors RosarioSIS AUTOMATIC_ATTENDANCE_CRON_HOUR).
    // Per-campus settings stored in school_settings (auto_attendance_*).
    cron.schedule(
      "*/5 * * * *",
      async () => {
        await this.checkAndGenerateAttendanceForSchools();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi",
      },
    );

    // Monthly Salary Generation - Runs on 1st of every month at 2:00 AM
    cron.schedule(
      "0 2 1 * *",
      async () => {
        await this.generateMonthlySalariesForAllSchools();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi", // Change to your timezone
      },
    );

    // Daily reminder check - Runs every day at 9:00 AM
    // Can be used to send reminders about pending approvals
    cron.schedule(
      "0 9 * * *",
      async () => {
        await this.sendPendingApprovalReminders();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi",
      },
    );

    // Backup generation check - Runs on the 5th of every month at 3:00 AM
    // In case the 1st generation failed, retry on the 5th
    cron.schedule(
      "0 3 5 * *",
      async () => {
        await this.retryFailedGenerations();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi",
      },
    );

    // Hostel: Remove inactive students from rooms - Runs daily at 2:00 AM
    cron.schedule(
      "0 2 * * *",
      async () => {
        await this.removeInactiveHostelStudents();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi",
      },
    );

    // Class Diary Reminders - Runs daily at 7:00 AM
    // Emails teachers who did not add a diary entry for yesterday's classes
    cron.schedule(
      "0 7 * * *",
      async () => {
        await this.sendDiaryReminders();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi",
      },
    );

    // Entry & Exit — Automatic Records (Premium)
    // Runs every minute; applies any rules whose scheduled_time matches now ±1 min
    cron.schedule(
      "* * * * *",
      async () => {
        await this.applyAutomaticEntryExitRecords();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi",
      },
    );

    // Entry & Exit — Nightly record cleanup
    // Deletes records older than 365 days for all schools (3:30 AM daily)
    cron.schedule(
      "30 3 * * *",
      async () => {
        await AutomaticRecordsService.runNightlyCleanupAllSchools();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi",
      },
    );

    this.isInitialized = true;
  }

  /**
   * Apply Entry & Exit automatic record rules for all active schools.
   * Called every minute by the cron job.
   */
  async applyAutomaticEntryExitRecords() {
    const now = new Date();
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    try {
      // Get all active schools
      const { data: schools } = await supabase
        .from("schools")
        .select("id")
        .eq("is_active", true);

      for (const school of schools || []) {
        const results = await AutomaticRecordsService.applyAutomaticRecords(
          school.id,
          dayOfWeek,
          currentTime,
          today,
        );
        // results applied silently
      }
    } catch (error: any) {
      console.error("❌ [CRON] Entry/Exit automatic records error:", error.message);
    }
  }

  /**
   * Check each school/campus and generate daily attendance when:
   *   1. auto_attendance_enabled = true
   *   2. today is in auto_attendance_days (0=Mon … 6=Sun)
   *   3. current time (HH:MM) >= auto_attendance_hour
   *   4. auto_attendance_last_run < today  (prevents double-run)
   *
   * Mirrors RosarioSIS AUTOMATIC_ATTENDANCE_CRON_HOUR per-school logic.
   * Called every 5 minutes by the cron scheduler.
   */
  async checkAndGenerateAttendanceForSchools() {
    const now       = new Date();
    const today     = now.toISOString().split("T")[0];          // YYYY-MM-DD
    const currentTime = now.toTimeString().slice(0, 5);         // HH:MM
    // Convert JS getDay() (0=Sun) → 0=Mon … 6=Sun convention
    const dow = (now.getDay() + 6) % 7;

    try {
      const { data: settings, error } = await supabase
        .from("school_settings")
        .select(
          "school_id, auto_attendance_enabled, auto_attendance_hour, auto_attendance_days, auto_attendance_last_run"
        )
        .eq("auto_attendance_enabled", true);

      if (error) {
        console.error("❌ [AutoAttendance] Failed to fetch settings:", error.message);
        return;
      }

      for (const s of settings ?? []) {
        // Guard: today must be in this school's configured school days
        if (!s.auto_attendance_days?.includes(dow)) continue;

        // Guard: current time must be at or past the configured hour
        if (currentTime < s.auto_attendance_hour) continue;

        // Guard: must not have already run today
        if (s.auto_attendance_last_run >= today) continue;

        try {
          const result = await generateDailyAttendance(today, s.school_id);

          // Mark as done for today — prevents re-run within same day
          await supabase
            .from("school_settings")
            .update({ auto_attendance_last_run: today })
            .eq("school_id", s.school_id);

          if (result.success && result.data) {
            await this.logAutomationRun("daily_attendance_generation", {
              date: today,
              school_id: s.school_id,
              generated_count: result.data.generated_count,
              timetable_entries_processed: result.data.timetable_entries_processed,
            });
          } else {
            console.error(
              `❌ [AutoAttendance] school=${s.school_id} error:`, result.error
            );
          }
        } catch (schoolErr: any) {
          console.error(
            `❌ [AutoAttendance] school=${s.school_id} exception:`, schoolErr.message
          );
        }
      }
    } catch (error: any) {
      console.error("❌ [AutoAttendance] Critical error:", error.message);
    }
  }

  /**
   * @deprecated Use checkAndGenerateAttendanceForSchools() instead.
   * Kept for backward compatibility with manualTriggerDailyAttendance().
   */
  async generateDailyAttendanceForAllSchools() {
    await this.checkAndGenerateAttendanceForSchools();
  }

  /**
   * Generate salaries for all schools in the system
   */
  async generateMonthlySalariesForAllSchools() {
    const now = new Date();
    const month = now.getMonth() + 1; // Current month (1-12)
    const year = now.getFullYear();

    try {
      // Get all active schools
      const { data: schools, error } = await supabase
        .from("schools")
        .select("id, name")
        .eq("is_active", true);

      if (error) {
        console.error("❌ Failed to fetch schools:", error);
        return;
      }

      if (!schools || schools.length === 0) return;

      let totalSuccess = 0;
      let totalFailed = 0;
      const results: any[] = [];

      // Process each school
      for (const school of schools) {
        try {
          const result = await salaryService.generateBulkSalaries(
            school.id,
            month,
            year,
          );

          totalSuccess += result.success;
          totalFailed += result.failed;

          results.push({
            school_id: school.id,
            school_name: school.name,
            success: result.success,
            failed: result.failed,
            errors: result.errors,
          });

        } catch (schoolError: any) {
          console.error(
            `   ❌ Failed to process ${school.name}:`,
            schoolError.message,
          );
          results.push({
            school_id: school.id,
            school_name: school.name,
            success: 0,
            failed: 0,
            error: schoolError.message,
          });
        }
      }

      // Store automation log
      await this.logAutomationRun("monthly_salary_generation", {
        month,
        year,
        schools_processed: schools.length,
        total_success: totalSuccess,
        total_failed: totalFailed,
        results,
      });
    } catch (error: any) {
      console.error(
        "❌ Critical error in monthly salary generation:",
        error.message,
      );
    }
  }

  /**
   * Send reminders for pending salary approvals
   */
  async sendPendingApprovalReminders() {
    try {
      const { data: pendingRecords, error } = await supabase
        .from("salary_records")
        .select(
          `
                    id,
                    month,
                    year,
                    school_id,
                    schools!inner(name, id)
                `,
        )
        .eq("status", "pending");

      if (error) {
        console.error("❌ Failed to fetch pending records:", error);
        return;
      }

      if (!pendingRecords || pendingRecords.length === 0) return;

      // Group by school
      const schoolGroups = pendingRecords.reduce((acc: any, record: any) => {
        if (!acc[record.school_id]) {
          acc[record.school_id] = {
            school_name: record.schools.name,
            count: 0,
          };
        }
        acc[record.school_id].count++;
        return acc;
      }, {});

      // TODO: Implement email/notification sending here
      // For now, just logging
    } catch (error: any) {
      console.error("❌ Error checking pending approvals:", error.message);
    }
  }

  /**
   * Retry failed salary generations
   */
  async retryFailedGenerations() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      // Get all active schools
      const { data: schools } = await supabase
        .from("schools")
        .select("id, name")
        .eq("is_active", true);

      if (!schools || schools.length === 0) return;

      for (const school of schools) {
        // Check if school has staff with salary structures but no salary records for this month
        const { data: structuresWithoutSalary, error } = await supabase
          .from("salary_structures")
          .select(
            `
                        staff_id,
                        staff!inner(
                            profiles!inner(first_name, last_name)
                        )
                    `,
          )
          .eq("school_id", school.id)
          .eq("is_current", true)
          .not(
            "staff_id",
            "in",
            `(
                        SELECT staff_id FROM salary_records 
                        WHERE school_id = '${school.id}' 
                        AND month = ${month} 
                        AND year = ${year}
                    )`,
          );

        if (error) {
          console.error(`   ❌ Error checking ${school.name}:`, error);
          continue;
        }

        if (structuresWithoutSalary && structuresWithoutSalary.length > 0) {
          await salaryService.generateBulkSalaries(school.id, month, year);
        }
      }
    } catch (error: any) {
      console.error("❌ Error in retry generation:", error.message);
    }
  }

  /**
   * Store automation log in database
   */
  private async logAutomationRun(_jobName: string, _details: any) {
    // TODO: persist to automation_logs table
  }

  /**
   * Manual trigger for testing - Call this from API endpoint
   */
  async manualTriggerMonthlySalary(schoolId?: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    if (schoolId) {
      const result = await salaryService.generateBulkSalaries(
        schoolId,
        month,
        year,
      );
      return result;
    } else {
      await this.generateMonthlySalariesForAllSchools();
      return { message: "Batch generation started" };
    }
  }

  /**
   * Manual trigger for daily attendance - Call this from API endpoint
   * Teachers can use this to regenerate attendance if needed
   */
  async manualTriggerDailyAttendance(date?: string) {
    const targetDate = date || new Date().toISOString().split("T")[0];
    await this.generateDailyAttendanceForAllSchools();
    return { message: `Attendance generation triggered for ${targetDate}` };
  }

  /**
   * Remove inactive students from hostel rooms
   */
  async removeInactiveHostelStudents() {
    try {
      const result = await HostelService.removeInactiveStudents();
      await this.logAutomationRun("hostel_inactive_cleanup", result);
    } catch (error: any) {
      console.error("❌ Error in hostel inactive cleanup:", error.message);
    }
  }

  /**
   * Send Class Diary email reminders to teachers who missed yesterday's entries
   */
  async sendDiaryReminders() {
    try {
      const results = await diaryReminderService.sendDiaryReminders();

      const totalNotified = results.reduce((sum, r) => sum + r.teachers_notified, 0);
      const totalEmails = results.reduce((sum, r) => sum + r.emails_sent, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      await this.logAutomationRun("diary_email_reminders", {
        schools_processed: results.length,
        teachers_notified: totalNotified,
        emails_sent: totalEmails,
        errors: totalErrors,
        details: results,
      });
    } catch (error: any) {
      console.error("❌ Error in diary reminders:", error.message);
    }
  }
}

export const cronService = new CronService();
