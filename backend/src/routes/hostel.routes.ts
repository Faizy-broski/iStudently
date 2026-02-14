import { Router } from "express";
import { HostelController } from "../controllers/hostel.controller";

const router = Router();

// ─── STATS ────────────────────────────────────────────────
router.get("/stats", HostelController.getStats);

// ─── BUILDINGS ────────────────────────────────────────────
router.get("/buildings", HostelController.getBuildings);
router.post("/buildings", HostelController.createBuilding);
router.put("/buildings/:id", HostelController.updateBuilding);
router.delete("/buildings/:id", HostelController.deleteBuilding);

// ─── ROOMS ────────────────────────────────────────────────
router.get("/rooms", HostelController.getRooms);
router.post("/rooms", HostelController.createRoom);
router.put("/rooms/:id", HostelController.updateRoom);
router.delete("/rooms/:id", HostelController.deleteRoom);

// ─── ASSIGNMENTS ──────────────────────────────────────────
router.get("/assignments", HostelController.getAssignments);
router.post("/assignments", HostelController.assignStudent);
router.delete("/assignments/:id", HostelController.releaseStudent);
router.get("/assignments/student/:studentId", HostelController.getStudentRoom);

// ─── VISITS ───────────────────────────────────────────────
router.get("/visits", HostelController.getVisits);
router.post("/visits", HostelController.createVisit);
router.patch("/visits/:id/checkout", HostelController.checkOutVisit);

// ─── FEES ─────────────────────────────────────────────────
router.get("/fees", HostelController.getRentalFees);
router.post("/fees/generate", HostelController.generateRentalFees);
router.post("/fees/payment", HostelController.recordFeePayment);

// ─── FILES ────────────────────────────────────────────────
router.get("/files", HostelController.getFiles);
router.post("/files", HostelController.addFile);
router.delete("/files/:id", HostelController.deleteFile);

// ─── SEARCH ───────────────────────────────────────────────
router.get("/search/students", HostelController.searchStudents);

export default router;
