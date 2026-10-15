import { Router } from "express";
import { HostelController } from "../controllers/hostel.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { requireRowInSchoolFamily } from "../middlewares/row-school-scope.middleware";

const router = Router();

// Admin back office only (staff through their User Profile). Was mounted with no auth at all:
// anyone could read or change any school's hostel data by passing its school_id.
// authenticate() also checks every school_id / campus_id in the query or body.
router.use(authenticate, requireRole("admin"));

// Rows addressed by id (path or body) must belong to the caller's school family.
const building = requireRowInSchoolFamily("hostel_buildings");
const bodyBuilding = requireRowInSchoolFamily("hostel_buildings", "building_id", "school_id", "body");
const room = requireRowInSchoolFamily("hostel_rooms");
const bodyRoom = requireRowInSchoolFamily("hostel_rooms", "room_id", "school_id", "body");
const assignment = requireRowInSchoolFamily("hostel_room_assignments");
const bodyStudent = requireRowInSchoolFamily("students", "student_id", "school_id", "body");
const pathStudent = requireRowInSchoolFamily("students", "studentId");
const visit = requireRowInSchoolFamily("hostel_visits");
const bodyFee = requireRowInSchoolFamily("hostel_rental_fees", "fee_id", "school_id", "body");

// ─── STATS ────────────────────────────────────────────────
router.get("/stats", HostelController.getStats);

// ─── BUILDINGS ────────────────────────────────────────────
router.get("/buildings", HostelController.getBuildings);
router.post("/buildings", HostelController.createBuilding);
router.put("/buildings/:id", building, HostelController.updateBuilding);
router.delete("/buildings/:id", building, HostelController.deleteBuilding);

// ─── ROOMS ────────────────────────────────────────────────
router.get("/rooms", HostelController.getRooms);
router.post("/rooms", bodyBuilding, HostelController.createRoom);
router.put("/rooms/:id", room, HostelController.updateRoom);
router.delete("/rooms/:id", room, HostelController.deleteRoom);

// ─── ASSIGNMENTS ──────────────────────────────────────────
router.get("/assignments", HostelController.getAssignments);
router.post("/assignments", bodyRoom, bodyStudent, HostelController.assignStudent);
router.delete("/assignments/:id", assignment, HostelController.releaseStudent);
router.get("/assignments/student/:studentId", pathStudent, HostelController.getStudentRoom);

// ─── VISITS ───────────────────────────────────────────────
router.get("/visits", HostelController.getVisits);
router.post("/visits", bodyStudent, bodyRoom, HostelController.createVisit);
router.patch("/visits/:id/checkout", visit, HostelController.checkOutVisit);

// ─── RENTAL FEES ──────────────────────────────────────────
router.get("/fees", HostelController.getRentalFees);
router.post("/fees/generate", HostelController.generateRentalFees);
router.post("/fees/payment", bodyFee, HostelController.recordFeePayment);

// ─── FILES ────────────────────────────────────────────────
router.get("/files", HostelController.getFiles);
router.post("/files", HostelController.addFile);
router.delete("/files/:id", HostelController.deleteFile);

// ─── SEARCH ───────────────────────────────────────────────
router.get("/search/students", HostelController.searchStudents);

export default router;
