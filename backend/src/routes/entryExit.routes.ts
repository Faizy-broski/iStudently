import { Router } from "express";
import { EntryExitController } from "../controllers/entryExit.controller";
import { EveningLeaveController } from "../controllers/eveningLeave.controller";
import { PackageController } from "../controllers/package.controller";
import { AutomaticRecordsController } from "../controllers/automaticRecords.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/role.middleware";
import { requireRowInSchoolFamily } from "../middlewares/row-school-scope.middleware";

const router = Router();

// Admin-only. authenticate() also rejects any school_id/campus_id (query or body) outside the
// caller's school family; routes that act on a row by id check that row's school below.
router.use(authenticate, requireAdmin);

const checkpointRow = requireRowInSchoolFamily("checkpoints");
const recordRow = requireRowInSchoolFamily("entry_exit_records");
const leaveRow = requireRowInSchoolFamily("evening_leaves");
const packageRow = requireRowInSchoolFamily("package_deliveries");
const ruleRow = requireRowInSchoolFamily("automatic_records");
const exceptionRow = requireRowInSchoolFamily("automatic_record_exceptions", "id", "automatic_records!inner(school_id)");

// ========================
// CHECKPOINTS
// ========================
router.get("/checkpoints", EntryExitController.getCheckpoints);
router.post("/checkpoints", EntryExitController.createCheckpoint);
router.get("/checkpoints/:id", checkpointRow, EntryExitController.getCheckpointById);
router.put("/checkpoints/:id", checkpointRow, EntryExitController.updateCheckpoint);
router.delete("/checkpoints/:id", checkpointRow, EntryExitController.deleteCheckpoint);
router.get("/checkpoints/:id/times", checkpointRow, EntryExitController.getAuthorizedTimes);
router.post("/checkpoints/:id/times", checkpointRow, EntryExitController.setAuthorizedTimes);

// ========================
// RECORDS
// ========================
router.post("/records", EntryExitController.createRecord);
router.post("/records/bulk", EntryExitController.createBulkRecords);
router.get("/records", EntryExitController.getRecords);
router.delete("/records/:id", recordRow, EntryExitController.deleteRecord);
router.get("/stats", EntryExitController.getStats);

// ========================
// ATTENDANCE INTEGRATION (Premium)
// ========================
router.get("/attendance-integration", EntryExitController.getAttendanceIntegration);

// ========================
// STUDENT NOTES
// ========================
router.get("/students/:id/notes", EntryExitController.getStudentNotes);
router.put("/students/:id/notes", EntryExitController.upsertStudentNotes);

// ========================
// EVENING LEAVES
// ========================
router.get("/evening-leaves", EveningLeaveController.getAll);
router.post("/evening-leaves", EveningLeaveController.create);
router.get("/evening-leaves/report", EveningLeaveController.getReport);
router.get("/evening-leaves/:id", leaveRow, EveningLeaveController.getById);
router.put("/evening-leaves/:id", leaveRow, EveningLeaveController.update);
router.delete("/evening-leaves/:id", leaveRow, EveningLeaveController.delete);

// ========================
// PACKAGES
// ========================
router.get("/packages", PackageController.getAll);
router.post("/packages", PackageController.create);
router.get("/packages/pending", PackageController.getPending);
router.patch("/packages/:id/pickup", packageRow, PackageController.pickup);

// ========================
// AUTOMATIC RECORDS (Premium)
// ========================
router.get("/automatic-records", AutomaticRecordsController.getAll);
router.post("/automatic-records", AutomaticRecordsController.create);
router.get("/automatic-records/:id", ruleRow, AutomaticRecordsController.getById);
router.put("/automatic-records/:id", ruleRow, AutomaticRecordsController.update);
router.delete("/automatic-records/:id", ruleRow, AutomaticRecordsController.delete);
router.get("/automatic-records/:id/exceptions", ruleRow, AutomaticRecordsController.getExceptions);
router.post("/automatic-records/:id/exceptions", ruleRow, AutomaticRecordsController.createException);
router.delete("/automatic-records/:id/exceptions/:exceptionId", ruleRow, requireRowInSchoolFamily("automatic_record_exceptions", "exceptionId", "automatic_records!inner(school_id)"), AutomaticRecordsController.deleteException);

// School-wide exceptions (used by Exceptions page)
router.get("/exceptions", AutomaticRecordsController.getSchoolExceptions);
router.post("/exceptions/bulk", AutomaticRecordsController.bulkCreateExceptions);
router.delete("/exceptions/:id", exceptionRow, AutomaticRecordsController.deleteExceptionById);

export default router;
