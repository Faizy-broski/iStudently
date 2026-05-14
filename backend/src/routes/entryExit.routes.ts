import { Router } from "express";
import { EntryExitController } from "../controllers/entryExit.controller";
import { EveningLeaveController } from "../controllers/eveningLeave.controller";
import { PackageController } from "../controllers/package.controller";
import { AutomaticRecordsController } from "../controllers/automaticRecords.controller";

const router = Router();

// ========================
// CHECKPOINTS
// ========================
router.get("/checkpoints", EntryExitController.getCheckpoints);
router.post("/checkpoints", EntryExitController.createCheckpoint);
router.get("/checkpoints/:id", EntryExitController.getCheckpointById);
router.put("/checkpoints/:id", EntryExitController.updateCheckpoint);
router.delete("/checkpoints/:id", EntryExitController.deleteCheckpoint);
router.get("/checkpoints/:id/times", EntryExitController.getAuthorizedTimes);
router.post("/checkpoints/:id/times", EntryExitController.setAuthorizedTimes);

// ========================
// RECORDS
// ========================
router.post("/records", EntryExitController.createRecord);
router.post("/records/bulk", EntryExitController.createBulkRecords);
router.get("/records", EntryExitController.getRecords);
router.delete("/records/:id", EntryExitController.deleteRecord);
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
router.get("/evening-leaves/:id", EveningLeaveController.getById);
router.put("/evening-leaves/:id", EveningLeaveController.update);
router.delete("/evening-leaves/:id", EveningLeaveController.delete);

// ========================
// PACKAGES
// ========================
router.get("/packages", PackageController.getAll);
router.post("/packages", PackageController.create);
router.get("/packages/pending", PackageController.getPending);
router.patch("/packages/:id/pickup", PackageController.pickup);

// ========================
// AUTOMATIC RECORDS (Premium)
// ========================
router.get("/automatic-records", AutomaticRecordsController.getAll);
router.post("/automatic-records", AutomaticRecordsController.create);
router.get("/automatic-records/:id", AutomaticRecordsController.getById);
router.put("/automatic-records/:id", AutomaticRecordsController.update);
router.delete("/automatic-records/:id", AutomaticRecordsController.delete);
router.get("/automatic-records/:id/exceptions", AutomaticRecordsController.getExceptions);
router.post("/automatic-records/:id/exceptions", AutomaticRecordsController.createException);
router.delete("/automatic-records/:id/exceptions/:exceptionId", AutomaticRecordsController.deleteException);

// School-wide exceptions (used by Exceptions page)
router.get("/exceptions", AutomaticRecordsController.getSchoolExceptions);
router.post("/exceptions/bulk", AutomaticRecordsController.bulkCreateExceptions);
router.delete("/exceptions/:id", AutomaticRecordsController.deleteExceptionById);

export default router;
