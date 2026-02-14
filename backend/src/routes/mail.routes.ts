import express from "express";
import { sendTestMail } from "../controllers/mail.controller";

const router = express.Router();

router.post("/send", sendTestMail);

export default router;