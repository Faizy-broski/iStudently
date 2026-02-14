import { Router } from "express";
import { EntryExitController } from "../controllers/entryExit.controller";
import { EveningLeaveController } from "../controllers/eveningLeave.controller";
import { PackageController } from "../controllers/package.controller";

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
router.get("/stats", EntryExitController.getStats);

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

export default router;
