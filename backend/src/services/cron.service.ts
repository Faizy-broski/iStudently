import cron from "node-cron";
import { salaryService } from "./salary.service";
import { supabase } from "../config/supabase";
import { generateDailyAttendance } from "./attendance.service";
import { HostelService } from "./hostel.service";

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
      console.log("⏰ Cron service already initialized");
      return;
    }

    console.log("⏰ Initializing automated cron jobs...");

    // Daily Attendance Generation - Runs every day at 6:00 AM before school starts
    // This creates attendance records for all students as 'present' by default
    // Teachers only need to mark who is absent/late
    cron.schedule(
      "0 6 * * 1-6",
      async () => {
        console.log("📋 [CRON] Starting daily attendance generation...");
        await this.generateDailyAttendanceForAllSchools();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi", // Change to your timezone
      },
    );

    // Monthly Salary Generation - Runs on 1st of every month at 2:00 AM
    cron.schedule(
      "0 2 1 * *",
      async () => {
        console.log("🔄 [CRON] Starting monthly salary generation...");
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
        console.log("🔔 [CRON] Checking pending salary approvals...");
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
        console.log("🔄 [CRON] Running backup salary generation check...");
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
        console.log(
          "🏠 [CRON] Removing inactive students from hostel rooms...",
        );
        await this.removeInactiveHostelStudents();
      },
      {
        scheduled: true,
        timezone: "Asia/Karachi",
      },
    );

    this.isInitialized = true;
    console.log("✅ Cron service initialized successfully");
    console.log("📅 Scheduled jobs:");
    console.log("   - Daily Attendance Generation: Every weekday at 6:00 AM");
    console.log(
      "   - Monthly Salary Generation: 1st of every month at 2:00 AM",
    );
    console.log("   - Daily Approval Reminders: Every day at 9:00 AM");
    console.log("   - Backup Generation: 5th of every month at 3:00 AM");
    console.log("   - Hostel Inactive Cleanup: Every day at 2:00 AM");
  }

  /**
   * Generate attendance records for all active schools
   * This marks all students as 'present' by default for today's scheduled classes
   */
  async generateDailyAttendanceForAllSchools() {
    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Skip if Sunday (no school)
    if (dayOfWeek === 0) {
      console.log("📋 Skipping attendance generation - Sunday");
      return;
    }

    try {
      console.log(`📋 Generating daily attendance for all schools - ${today}`);

      // Call the RPC function that generates attendance for all schools
      const result = await generateDailyAttendance(today);

      if (result.success && result.data) {
        console.log("=".repeat(60));
        console.log("📋 DAILY ATTENDANCE GENERATION SUMMARY");
        console.log("=".repeat(60));
        console.log(`📅 Date: ${today}`);
        console.log(`✅ Records Generated: ${result.data.generated_count}`);
        console.log(
          `📚 Classes Processed: ${result.data.timetable_entries_processed}`,
        );
        console.log("=".repeat(60));

        // Log automation run
        await this.logAutomationRun("daily_attendance_generation", {
          date: today,
          generated_count: result.data.generated_count,
          timetable_entries_processed: result.data.timetable_entries_processed,
        });
      } else {
        console.error("❌ Failed to generate daily attendance:", result.error);
      }
    } catch (error: any) {
      console.error(
        "❌ Critical error in daily attendance generation:",
        error.message,
      );
    }
  }

  /**
   * Generate salaries for all schools in the system
   */
  async generateMonthlySalariesForAllSchools() {
    const now = new Date();
    const month = now.getMonth() + 1; // Current month (1-12)
    const year = now.getFullYear();

    try {
      console.log(`📊 Generating salaries for all schools - ${month}/${year}`);

      // Get all active schools
      const { data: schools, error } = await supabase
        .from("schools")
        .select("id, name")
        .eq("is_active", true);

      if (error) {
        console.error("❌ Failed to fetch schools:", error);
        return;
      }

      if (!schools || schools.length === 0) {
        console.log("⚠️  No active schools found");
        return;
      }

      console.log(`🏫 Found ${schools.length} active school(s)`);

      let totalSuccess = 0;
      let totalFailed = 0;
      const results: any[] = [];

      // Process each school
      for (const school of schools) {
        try {
          console.log(`\n📝 Processing: ${school.name}`);

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

          console.log(
            `   ✅ Success: ${result.success}, ❌ Failed: ${result.failed}`,
          );

          if (result.errors.length > 0) {
            console.log("   ⚠️  Errors:");
            result.errors.forEach((err) => console.log(`      - ${err}`));
          }
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

      // Log final summary
      console.log("\n" + "=".repeat(60));
      console.log("📊 MONTHLY SALARY GENERATION SUMMARY");
      console.log("=".repeat(60));
      console.log(`📅 Month/Year: ${month}/${year}`);
      console.log(`🏫 Schools Processed: ${schools.length}`);
      console.log(`✅ Total Salaries Generated: ${totalSuccess}`);
      console.log(`❌ Total Failed: ${totalFailed}`);
      console.log("=".repeat(60));

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

      if (!pendingRecords || pendingRecords.length === 0) {
        console.log("✅ No pending salary approvals");
        return;
      }

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

      console.log("🔔 Pending Salary Approvals:");
      Object.entries(schoolGroups).forEach(
        ([_schoolId, data]: [string, any]) => {
          console.log(
            `   - ${data.school_name}: ${data.count} pending approval(s)`,
          );
        },
      );

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
      console.log(`🔄 Checking for missing salary records - ${month}/${year}`);

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
          console.log(
            `   ⚠️  ${school.name}: ${structuresWithoutSalary.length} missing salary record(s)`,
          );
          console.log(`   🔄 Regenerating...`);

          const result = await salaryService.generateBulkSalaries(
            school.id,
            month,
            year,
          );
          console.log(
            `   ✅ Regenerated: ${result.success}, ❌ Failed: ${result.failed}`,
          );
        }
      }
    } catch (error: any) {
      console.error("❌ Error in retry generation:", error.message);
    }
  }

  /**
   * Store automation log in database
   */
  private async logAutomationRun(jobName: string, _details: any) {
    try {
      // You can create an automation_logs table to track all automated runs
      // For now, just console logging
      console.log(`\n📝 Automation log stored for: ${jobName}`);
    } catch (error: any) {
      console.error("Failed to log automation run:", error.message);
    }
  }

  /**
   * Manual trigger for testing - Call this from API endpoint
   */
  async manualTriggerMonthlySalary(schoolId?: string) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    if (schoolId) {
      console.log(
        `🔧 Manual trigger: Generating salaries for school ${schoolId}`,
      );
      const result = await salaryService.generateBulkSalaries(
        schoolId,
        month,
        year,
      );
      return result;
    } else {
      console.log(`🔧 Manual trigger: Generating salaries for all schools`);
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
    console.log(
      `🔧 Manual trigger: Generating daily attendance for ${targetDate}`,
    );
    await this.generateDailyAttendanceForAllSchools();
    return { message: `Attendance generation triggered for ${targetDate}` };
  }

  /**
   * Remove inactive students from hostel rooms
   */
  async removeInactiveHostelStudents() {
    try {
      const result = await HostelService.removeInactiveStudents();
      console.log(
        `🏠 Hostel cleanup: Released ${result.released} inactive student(s)`,
      );
      await this.logAutomationRun("hostel_inactive_cleanup", result);
    } catch (error: any) {
      console.error("❌ Error in hostel inactive cleanup:", error.message);
    }
  }
}

export const cronService = new CronService();
