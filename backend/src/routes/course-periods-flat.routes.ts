import express from 'express'
import { getAllCoursePeriods } from '../controllers/courses.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = express.Router()

router.use(authenticate)

// GET /course-periods?campus_id=... - All course periods for the school/campus
router.get('/', getAllCoursePeriods)

export default router
